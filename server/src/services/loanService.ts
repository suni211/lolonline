import pool from '../database/db.js';

export class LoanService {
  // 임대 가능한 선수 목록
  static async getAvailableForLoan(teamId: number) {
    try {
      // 다른 팀의 선수들 중 임대 가능한 선수
      const players = await pool.query(
        `SELECT pc.*, p.name, p.position, p.nationality, t.name as team_name, t.id as owner_team_id
         FROM player_cards pc
         JOIN players p ON pc.player_id = p.id
         JOIN teams t ON pc.team_id = t.id
         WHERE pc.team_id != ?
           AND pc.is_starter = false
           AND NOT EXISTS (
             SELECT 1 FROM player_loans pl
             WHERE pl.player_card_id = pc.id AND pl.status = 'ACTIVE'
           )
         ORDER BY pc.overall DESC`,
        [teamId]
      );

      return players;
    } catch (error) {
      console.error('Get available for loan error:', error);
      throw error;
    }
  }

  // 임대 요청
  static async requestLoan(
    toTeamId: number,
    playerCardId: number,
    loanMonths: number = 6,
    salarySharePercent: number = 50
  ) {
    try {
      // 선수 정보 확인
      const players = await pool.query(
        `SELECT pc.*, p.name, p.salary, t.name as team_name
         FROM player_cards pc
         JOIN players p ON pc.player_id = p.id
         JOIN teams t ON pc.team_id = t.id
         WHERE pc.id = ?`,
        [playerCardId]
      );

      if (players.length === 0) {
        throw new Error('선수를 찾을 수 없습니다');
      }

      const player = players[0];

      // 이미 임대 중인지 확인
      const existingLoan = await pool.query(
        `SELECT id FROM player_loans WHERE player_card_id = ? AND status = 'ACTIVE'`,
        [playerCardId]
      );

      if (existingLoan.length > 0) {
        throw new Error('이미 임대 중인 선수입니다');
      }

      // 자기 팀 선수인지 확인
      if (player.team_id === toTeamId) {
        throw new Error('자신의 팀 선수는 임대할 수 없습니다');
      }

      // 임대료 계산 (오버롤과 월급 기반)
      const loanFee = Math.floor(player.salary * loanMonths * 0.3);

      // 골드 확인
      const team = await pool.query('SELECT gold FROM teams WHERE id = ?', [toTeamId]);
      if (team.length === 0 || team[0].gold < loanFee) {
        throw new Error('골드가 부족합니다');
      }

      // 골드 차감 (임대 팀)
      await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [loanFee, toTeamId]);

      // 골드 추가 (원 소속팀)
      await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [loanFee, player.team_id]);

      // 임대 계약 생성
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + loanMonths);

      await pool.query(
        `INSERT INTO player_loans
         (player_card_id, from_team_id, to_team_id, loan_fee, salary_share_percent, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [playerCardId, player.team_id, toTeamId, loanFee, salarySharePercent, startDate, endDate]
      );

      // 선수 팀 변경
      await pool.query(
        'UPDATE player_cards SET team_id = ? WHERE id = ?',
        [toTeamId, playerCardId]
      );

      // 재정 기록 (임대 팀)
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'EXPENSE', 'LOAN_FEE', ?, ?)`,
        [toTeamId, loanFee, `${player.name} 임대료`]
      );

      // 재정 기록 (원 소속팀)
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'INCOME', 'LOAN_FEE', ?, ?)`,
        [player.team_id, loanFee, `${player.name} 임대료 수입`]
      );

      return {
        success: true,
        loanFee,
        message: `${player.name} 선수를 ${loanMonths}개월간 임대했습니다`
      };
    } catch (error) {
      console.error('Request loan error:', error);
      throw error;
    }
  }

  // 임대 중인 선수 목록 (내가 받은)
  static async getIncomingLoans(teamId: number) {
    try {
      const loans = await pool.query(
        `SELECT pl.*, pc.overall, p.name, p.position, t.name as from_team_name
         FROM player_loans pl
         JOIN player_cards pc ON pl.player_card_id = pc.id
         JOIN players p ON pc.player_id = p.id
         JOIN teams t ON pl.from_team_id = t.id
         WHERE pl.to_team_id = ? AND pl.status = 'ACTIVE'`,
        [teamId]
      );

      return loans;
    } catch (error) {
      console.error('Get incoming loans error:', error);
      throw error;
    }
  }

  // 임대 보낸 선수 목록
  static async getOutgoingLoans(teamId: number) {
    try {
      const loans = await pool.query(
        `SELECT pl.*, pc.overall, p.name, p.position, t.name as to_team_name
         FROM player_loans pl
         JOIN player_cards pc ON pl.player_card_id = pc.id
         JOIN players p ON pc.player_id = p.id
         JOIN teams t ON pl.to_team_id = t.id
         WHERE pl.from_team_id = ? AND pl.status = 'ACTIVE'`,
        [teamId]
      );

      return loans;
    } catch (error) {
      console.error('Get outgoing loans error:', error);
      throw error;
    }
  }

  // 임대 종료 (수동)
  static async endLoan(loanId: number, teamId: number) {
    try {
      const loan = await pool.query(
        `SELECT * FROM player_loans WHERE id = ? AND (from_team_id = ? OR to_team_id = ?)`,
        [loanId, teamId, teamId]
      );

      if (loan.length === 0) {
        throw new Error('임대 정보를 찾을 수 없습니다');
      }

      const loanData = loan[0];

      // 선수를 원 소속팀으로 복귀
      await pool.query(
        'UPDATE player_cards SET team_id = ? WHERE id = ?',
        [loanData.from_team_id, loanData.player_card_id]
      );

      // 임대 상태 변경
      await pool.query(
        `UPDATE player_loans SET status = 'COMPLETED' WHERE id = ?`,
        [loanId]
      );

      return {
        success: true,
        message: '임대가 종료되었습니다'
      };
    } catch (error) {
      console.error('End loan error:', error);
      throw error;
    }
  }

  // 만료된 임대 자동 종료 (스케줄러용)
  static async processExpiredLoans() {
    try {
      const expiredLoans = await pool.query(
        `SELECT * FROM player_loans WHERE status = 'ACTIVE' AND end_date <= CURDATE()`
      );

      for (const loan of expiredLoans) {
        // 선수 복귀
        await pool.query(
          'UPDATE player_cards SET team_id = ? WHERE id = ?',
          [loan.from_team_id, loan.player_card_id]
        );

        // 상태 변경
        await pool.query(
          `UPDATE player_loans SET status = 'COMPLETED' WHERE id = ?`,
          [loan.id]
        );
      }

      return { processed: expiredLoans.length };
    } catch (error) {
      console.error('Process expired loans error:', error);
      throw error;
    }
  }

  // 월급 분담 처리 (스케줄러용)
  static async processMonthlySalaryShare() {
    try {
      const activeLoans = await pool.query(
        `SELECT pl.*, p.salary
         FROM player_loans pl
         JOIN player_cards pc ON pl.player_card_id = pc.id
         JOIN players p ON pc.player_id = p.id
         WHERE pl.status = 'ACTIVE'`
      );

      for (const loan of activeLoans) {
        // 임대팀이 부담하는 월급
        const toTeamShare = Math.floor(loan.salary * loan.salary_share_percent / 100);
        // 원소속팀이 부담하는 월급
        const fromTeamShare = loan.salary - toTeamShare;

        // 임대팀 월급 차감
        await pool.query(
          'UPDATE teams SET gold = gold - ? WHERE id = ?',
          [toTeamShare, loan.to_team_id]
        );

        // 원소속팀 월급 차감
        if (fromTeamShare > 0) {
          await pool.query(
            'UPDATE teams SET gold = gold - ? WHERE id = ?',
            [fromTeamShare, loan.from_team_id]
          );
        }

        // 재정 기록
        await pool.query(
          `INSERT INTO financial_records (team_id, record_type, category, amount, description)
           VALUES (?, 'EXPENSE', 'PLAYER_SALARY', ?, ?)`,
          [loan.to_team_id, toTeamShare, '임대 선수 월급 분담']
        );

        if (fromTeamShare > 0) {
          await pool.query(
            `INSERT INTO financial_records (team_id, record_type, category, amount, description)
             VALUES (?, 'EXPENSE', 'PLAYER_SALARY', ?, ?)`,
            [loan.from_team_id, fromTeamShare, '임대 보낸 선수 월급 분담']
          );
        }
      }

      return { processed: activeLoans.length };
    } catch (error) {
      console.error('Process monthly salary share error:', error);
      throw error;
    }
  }
}

export default LoanService;
