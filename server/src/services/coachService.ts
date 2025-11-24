import pool from '../database/db.js';

export class CoachService {
  // 고용 가능한 코치 목록
  static async getAvailableCoaches(teamId: number) {
    try {
      const coaches = await pool.query(
        `SELECT c.*,
                (SELECT COUNT(*) FROM team_coaches tc
                 WHERE tc.coach_id = c.id AND tc.status = 'ACTIVE') as is_hired
         FROM coaches c
         WHERE c.is_available = true
         ORDER BY c.skill_level DESC, c.salary ASC`
      );

      return coaches;
    } catch (error) {
      console.error('Get available coaches error:', error);
      throw error;
    }
  }

  // 팀의 현재 코치 목록
  static async getTeamCoaches(teamId: number) {
    try {
      const coaches = await pool.query(
        `SELECT tc.*, c.name, c.nationality, c.coach_type, c.skill_level, c.specialty
         FROM team_coaches tc
         JOIN coaches c ON tc.coach_id = c.id
         WHERE tc.team_id = ? AND tc.status = 'ACTIVE'
         ORDER BY c.coach_type`,
        [teamId]
      );

      return coaches;
    } catch (error) {
      console.error('Get team coaches error:', error);
      throw error;
    }
  }

  // 코치 고용
  static async hireCoach(teamId: number, coachId: number, contractMonths: number = 12) {
    try {
      // 코치 정보 확인
      const coaches = await pool.query(
        `SELECT * FROM coaches WHERE id = ? AND is_available = true`,
        [coachId]
      );

      if (coaches.length === 0) {
        throw new Error('코치를 찾을 수 없습니다');
      }

      const coach = coaches[0];

      // 같은 타입의 코치가 이미 있는지 확인
      const existing = await pool.query(
        `SELECT tc.id FROM team_coaches tc
         JOIN coaches c ON tc.coach_id = c.id
         WHERE tc.team_id = ? AND tc.status = 'ACTIVE' AND c.coach_type = ?`,
        [teamId, coach.coach_type]
      );

      if (existing.length > 0) {
        throw new Error(`이미 ${coach.coach_type} 코치가 있습니다`);
      }

      // 팀 골드 확인 (첫 달 급여)
      const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [teamId]);
      if (teams.length === 0 || teams[0].gold < coach.salary) {
        throw new Error('골드가 부족합니다');
      }

      // 골드 차감
      await pool.query(
        'UPDATE teams SET gold = gold - ? WHERE id = ?',
        [coach.salary, teamId]
      );

      // 계약 생성
      const contractEnd = new Date();
      contractEnd.setMonth(contractEnd.getMonth() + contractMonths);

      await pool.query(
        `INSERT INTO team_coaches (team_id, coach_id, contract_start, contract_end, monthly_salary)
         VALUES (?, ?, CURDATE(), ?, ?)`,
        [teamId, coachId, contractEnd, coach.salary]
      );

      // 재정 기록
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'EXPENSE', 'COACH_SALARY', ?, ?)`,
        [teamId, coach.salary, `${coach.name} 코치 첫 달 급여`]
      );

      return {
        success: true,
        message: `${coach.name} 코치를 고용했습니다`,
        coach
      };
    } catch (error) {
      console.error('Hire coach error:', error);
      throw error;
    }
  }

  // 코치 해고
  static async fireCoach(teamId: number, teamCoachId: number) {
    try {
      const coaches = await pool.query(
        `SELECT tc.*, c.name, c.salary FROM team_coaches tc
         JOIN coaches c ON tc.coach_id = c.id
         WHERE tc.id = ? AND tc.team_id = ? AND tc.status = 'ACTIVE'`,
        [teamCoachId, teamId]
      );

      if (coaches.length === 0) {
        throw new Error('코치를 찾을 수 없습니다');
      }

      const coach = coaches[0];

      // 위약금 계산 (남은 기간의 50%)
      const now = new Date();
      const contractEnd = new Date(coach.contract_end);
      const remainingMonths = Math.max(0, Math.ceil((contractEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      const penaltyFee = Math.floor(coach.monthly_salary * remainingMonths * 0.5);

      // 골드 확인
      const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [teamId]);
      if (teams.length === 0 || teams[0].gold < penaltyFee) {
        throw new Error(`위약금 ${penaltyFee.toLocaleString()} 골드가 부족합니다`);
      }

      // 위약금 차감
      if (penaltyFee > 0) {
        await pool.query(
          'UPDATE teams SET gold = gold - ? WHERE id = ?',
          [penaltyFee, teamId]
        );

        await pool.query(
          `INSERT INTO financial_records (team_id, record_type, category, amount, description)
           VALUES (?, 'EXPENSE', 'OTHER', ?, ?)`,
          [teamId, penaltyFee, `${coach.name} 코치 해고 위약금`]
        );
      }

      // 계약 종료
      await pool.query(
        `UPDATE team_coaches SET status = 'TERMINATED' WHERE id = ?`,
        [teamCoachId]
      );

      return {
        success: true,
        message: `${coach.name} 코치를 해고했습니다`,
        penaltyFee
      };
    } catch (error) {
      console.error('Fire coach error:', error);
      throw error;
    }
  }

  // 코치 효과 계산
  static async getCoachEffects(teamId: number) {
    try {
      const coaches = await pool.query(
        `SELECT c.coach_type, c.skill_level, c.specialty
         FROM team_coaches tc
         JOIN coaches c ON tc.coach_id = c.id
         WHERE tc.team_id = ? AND tc.status = 'ACTIVE'`,
        [teamId]
      );

      const effects = {
        trainingBonus: 0,       // 훈련 효율 보너스
        mentalBonus: 0,         // 멘탈 보너스
        strategyBonus: 0,       // 전략 보너스
        physicalBonus: 0,       // 체력 보너스
        analysisBonus: 0,       // 분석 보너스
        healingBonus: 0,        // 부상 회복 보너스
        overallBonus: 0         // 전체 보너스
      };

      for (const coach of coaches) {
        const bonus = Math.floor(coach.skill_level / 10); // 10레벨당 1% 보너스

        switch (coach.coach_type) {
          case 'HEAD':
            effects.overallBonus += bonus;
            effects.trainingBonus += Math.floor(bonus / 2);
            break;
          case 'STRATEGY':
            effects.strategyBonus += bonus * 2;
            break;
          case 'MENTAL':
            effects.mentalBonus += bonus * 2;
            break;
          case 'PHYSICAL':
            effects.physicalBonus += bonus * 2;
            effects.trainingBonus += bonus;
            break;
          case 'ANALYST':
            effects.analysisBonus += bonus * 2;
            effects.strategyBonus += bonus;
            break;
          case 'DOCTOR':
            effects.healingBonus += bonus * 3;
            break;
        }
      }

      return effects;
    } catch (error) {
      console.error('Get coach effects error:', error);
      throw error;
    }
  }

  // 월급 지급 (스케줄러용)
  static async payMonthlySalaries() {
    try {
      const activeContracts = await pool.query(
        `SELECT tc.team_id, tc.monthly_salary, c.name
         FROM team_coaches tc
         JOIN coaches c ON tc.coach_id = c.id
         WHERE tc.status = 'ACTIVE'`
      );

      for (const contract of activeContracts) {
        // 골드 차감
        await pool.query(
          'UPDATE teams SET gold = gold - ? WHERE id = ?',
          [contract.monthly_salary, contract.team_id]
        );

        // 재정 기록
        await pool.query(
          `INSERT INTO financial_records (team_id, record_type, category, amount, description)
           VALUES (?, 'EXPENSE', 'COACH_SALARY', ?, ?)`,
          [contract.team_id, contract.monthly_salary, `${contract.name} 코치 월급`]
        );
      }

      return { paid: activeContracts.length };
    } catch (error) {
      console.error('Pay monthly salaries error:', error);
      throw error;
    }
  }
}

export default CoachService;
