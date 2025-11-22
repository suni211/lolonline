import pool from '../database/db';
import cron from 'node-cron';

// 부상 시스템 초기화
export function initializeInjurySystem() {
  // 매 시간마다 부상 회복 체크
  cron.schedule('0 * * * *', async () => {
    await processInjuryRecovery();
  });

  console.log('Injury system initialized');
}

// 부상 회복 처리
async function processInjuryRecovery() {
  try {
    const injuredPlayers = await pool.query(
      `SELECT p.*, t.id as team_id 
       FROM players p
       INNER JOIN player_ownership po ON p.id = po.player_id
       INNER JOIN teams t ON po.team_id = t.id
       WHERE p.injury_status != 'NONE' AND p.injury_recovery_days > 0`
    );

    for (const player of injuredPlayers) {
      // 의료 시설 레벨 확인
      const facilities = await pool.query(
        'SELECT level FROM team_facilities WHERE team_id = ? AND facility_type = "MEDICAL"',
        [player.team_id]
      );

      const medicalLevel = facilities.length > 0 ? facilities[0].level : 0;
      const recoverySpeed = 1 + (medicalLevel * 0.2); // 의료 시설 레벨당 20% 회복 속도 증가

      // 회복 일수 감소
      const newRecoveryDays = Math.max(0, player.injury_recovery_days - recoverySpeed);

      if (newRecoveryDays === 0) {
        // 부상 완전 회복
        await pool.query(
          'UPDATE players SET injury_status = "NONE", injury_recovery_days = 0, injury_started_at = NULL WHERE id = ?',
          [player.id]
        );
      } else {
        await pool.query(
          'UPDATE players SET injury_recovery_days = ? WHERE id = ?',
          [newRecoveryDays, player.id]
        );
      }
    }
  } catch (error) {
    console.error('Error processing injury recovery:', error);
  }
}

// 경기 중 부상 발생
export async function checkInjuryAfterMatch(playerId: number, matchIntensity: number = 1): Promise<boolean> {
  try {
    const players = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) return false;

    const player = players[0];

    // 컨디션이 낮을수록 부상 확률 증가
    const baseInjuryChance = (100 - (player as any).condition) * 0.01 * matchIntensity;
    const injuryChance = Math.min(0.15, baseInjuryChance); // 최대 15%

    if (Math.random() < injuryChance) {
      // 부상 발생
      const injuryTypes: Array<'MINOR' | 'MODERATE' | 'SEVERE'> = ['MINOR', 'MODERATE', 'SEVERE'];
      const injuryWeights = [0.6, 0.3, 0.1]; // 경미 60%, 중상 30%, 중증 10%
      
      const random = Math.random();
      let injuryType: 'MINOR' | 'MODERATE' | 'SEVERE' = 'MINOR';
      let cumulative = 0;
      
      for (let i = 0; i < injuryTypes.length; i++) {
        cumulative += injuryWeights[i];
        if (random <= cumulative) {
          injuryType = injuryTypes[i];
          break;
        }
      }

      const recoveryDays = injuryType === 'MINOR' ? 1 : injuryType === 'MODERATE' ? 3 : 7;

      await pool.query(
        `UPDATE players 
         SET injury_status = ?, 
             injury_recovery_days = ?, 
             injury_started_at = NOW(),
             `condition` = GREATEST(`condition` - 20, 0)
         WHERE id = ?`,
        [injuryType, recoveryDays, playerId]
      );

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking injury:', error);
    return false;
  }
}

// 부상 상태에 따른 스탯 페널티 계산
export function getInjuryPenalty(injuryStatus: string): number {
  switch (injuryStatus) {
    case 'MINOR':
      return 0.95; // 5% 감소
    case 'MODERATE':
      return 0.85; // 15% 감소
    case 'SEVERE':
      return 0.70; // 30% 감소
    default:
      return 1.0; // 페널티 없음
  }
}

