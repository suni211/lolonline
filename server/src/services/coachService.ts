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

  // 코치 협상
  static async negotiateCoach(teamId: number, coachId: number, offeredSalary: number, contractMonths: number = 12) {
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
      const expectedSalary = coach.salary;

      // 협상 성공 확률 계산
      // 제안 급여가 기대 급여의 몇 %인지 계산
      const offerRatio = offeredSalary / expectedSalary;

      // 기본 수락 확률 계산
      // 100% 이상 제안: 무조건 수락
      // 80-100%: 높은 확률로 수락
      // 60-80%: 중간 확률
      // 60% 미만: 낮은 확률
      let acceptProbability = 0;

      if (offerRatio >= 1.0) {
        acceptProbability = 100;
      } else if (offerRatio >= 0.9) {
        acceptProbability = 80 + (offerRatio - 0.9) * 200; // 80-100%
      } else if (offerRatio >= 0.8) {
        acceptProbability = 50 + (offerRatio - 0.8) * 300; // 50-80%
      } else if (offerRatio >= 0.7) {
        acceptProbability = 20 + (offerRatio - 0.7) * 300; // 20-50%
      } else if (offerRatio >= 0.6) {
        acceptProbability = (offerRatio - 0.6) * 200; // 0-20%
      } else {
        acceptProbability = 0;
      }

      // 스킬 레벨이 높을수록 협상이 어려움
      const skillPenalty = Math.floor(coach.skill_level / 20); // 20레벨당 5% 감소
      acceptProbability = Math.max(0, acceptProbability - skillPenalty * 5);

      // 계약 기간이 길수록 수락 확률 증가
      if (contractMonths >= 24) {
        acceptProbability += 10;
      } else if (contractMonths >= 18) {
        acceptProbability += 5;
      }

      // 최종 확률 제한
      acceptProbability = Math.min(100, Math.max(0, acceptProbability));

      // 협상 결과 결정
      const roll = Math.random() * 100;
      const accepted = roll < acceptProbability;

      if (accepted) {
        // 최종 급여 결정 (코치가 약간 반격할 수 있음)
        let finalSalary = offeredSalary;
        if (offerRatio < 0.9) {
          // 너무 낮은 제안은 코치가 약간 올림
          const counterOffer = offeredSalary + (expectedSalary - offeredSalary) * 0.2;
          finalSalary = Math.floor(counterOffer);
        }

        return {
          success: true,
          accepted: true,
          finalSalary,
          contractMonths,
          message: offerRatio < 0.9
            ? `${coach.name} 코치가 ${finalSalary.toLocaleString()}원에 수락했습니다.`
            : `${coach.name} 코치가 제안을 수락했습니다.`,
          coach
        };
      } else {
        // 거절 시 최소 요구 급여 알려줌
        const minimumAcceptable = Math.floor(expectedSalary * 0.8);
        return {
          success: true,
          accepted: false,
          minimumSalary: minimumAcceptable,
          message: `${coach.name} 코치가 제안을 거절했습니다. 최소 ${minimumAcceptable.toLocaleString()}원 이상을 원합니다.`,
          coach
        };
      }
    } catch (error) {
      console.error('Negotiate coach error:', error);
      throw error;
    }
  }

  // 코치 고용 (협상 후 또는 직접 고용)
  static async hireCoach(teamId: number, coachId: number, contractMonths: number = 12, negotiatedSalary?: number) {
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

      // 협상된 급여가 있으면 사용, 없으면 기본 급여
      const finalSalary = negotiatedSalary || coach.salary;

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
      if (teams.length === 0 || teams[0].gold < finalSalary) {
        throw new Error('원이 부족합니다');
      }

      // 골드 차감
      await pool.query(
        'UPDATE teams SET gold = gold - ? WHERE id = ?',
        [finalSalary, teamId]
      );

      // 계약 생성
      const contractEnd = new Date();
      contractEnd.setMonth(contractEnd.getMonth() + contractMonths);

      await pool.query(
        `INSERT INTO team_coaches (team_id, coach_id, contract_start, contract_end, monthly_salary)
         VALUES (?, ?, CURDATE(), ?, ?)`,
        [teamId, coachId, contractEnd, finalSalary]
      );

      // 재정 기록
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'EXPENSE', 'COACH_SALARY', ?, ?)`,
        [teamId, finalSalary, `${coach.name} 코치 첫 달 급여`]
      );

      return {
        success: true,
        message: `${coach.name} 코치를 고용했습니다 (월급: ${finalSalary.toLocaleString()}원)`,
        coach,
        monthlySalary: finalSalary
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
