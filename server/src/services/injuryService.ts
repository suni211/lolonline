import pool from '../database/db.js';
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

// 부상 유형별 상세 정보
const INJURY_DETAILS = {
  MINOR: { recoveryDays: 3, statPenalty: 0.95, description: '경미한 부상' },
  MODERATE: { recoveryDays: 7, statPenalty: 0.85, description: '중상' },
  SEVERE: { recoveryDays: 14, statPenalty: 0.70, description: '중증' },
  CRITICAL: { recoveryDays: 21, statPenalty: 0.50, description: '위중한 부상' }
};

// 경기 중 부상 발생
export async function checkInjuryAfterMatch(playerId: number, matchIntensity: number = 1): Promise<boolean> {
  try {
    const players = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) return false;

    const player = players[0];

    // 부상 확률 계산 (컨디션, 나이, 이전 부상 기록 반영)
    let baseInjuryChance = 0.05 * matchIntensity; // 기본 5%

    // 컨디션 낮으면 부상 확률 증가
    const conditionFactor = Math.max(0, 100 - (player as any).player_condition) * 0.001;

    // 나이가 높으면 부상 확률 증가 (30세 이상)
    const ageFactor = (player as any).age > 30 ? ((player as any).age - 30) * 0.01 : 0;

    // 이전 부상 이력 확인 (같은 부위 재부상 확률 높음)
    const injuryChance = Math.min(0.25, baseInjuryChance + conditionFactor + ageFactor); // 최대 25%

    if (Math.random() < injuryChance) {
      // 부상 유형 결정
      const injuryTypes = Object.keys(INJURY_DETAILS) as Array<keyof typeof INJURY_DETAILS>;
      const weights = [0.50, 0.30, 0.15, 0.05]; // MINOR 50%, MODERATE 30%, SEVERE 15%, CRITICAL 5%

      const random = Math.random();
      let injuryType: keyof typeof INJURY_DETAILS = 'MINOR';
      let cumulative = 0;

      for (let i = 0; i < injuryTypes.length; i++) {
        cumulative += weights[i];
        if (random <= cumulative) {
          injuryType = injuryTypes[i];
          break;
        }
      }

      const injuryInfo = INJURY_DETAILS[injuryType];

      // 부상 부위 결정
      const injuryLocations = ['왼쪽 무릎', '오른쪽 무릎', '왼쪽 발목', '오른쪽 발목', '왼쪽 어깨', '오른쪽 어깨', '허리', '발가락'];
      const injuryLocation = injuryLocations[Math.floor(Math.random() * injuryLocations.length)];

      // 의료 시설 레벨에 따른 회복 일수 감소
      const facilities = await pool.query(
        'SELECT level FROM team_facilities WHERE team_id = ? AND facility_type = "MEDICAL"',
        [player.team_id]
      );
      const medicalLevel = facilities.length > 0 ? facilities[0].level : 0;
      const recoveryDays = Math.max(1, injuryInfo.recoveryDays - (medicalLevel * 2)); // 의료시설 레벨당 2일 단축

      // 부상 기록
      await pool.query(
        `INSERT INTO injury_history (player_id, injury_type, injury_location, recovery_days_required, started_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [playerId, injuryType, injuryLocation, recoveryDays]
      );

      await pool.query(
        `UPDATE player_cards
         SET injury_status = ?,
             injury_recovery_days = ?,
             injury_location = ?,
             condition = GREATEST(condition - 25, 0)
         WHERE id = ?`,
        [injuryType, recoveryDays, injuryLocation, playerId]
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

