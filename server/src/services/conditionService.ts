import pool from '../database/db.js';
import cron from 'node-cron';

// 컨디션 자동 회복 시스템 초기화
export function initializeConditionRecovery() {
  // 매 30분마다 컨디션 회복 체크
  cron.schedule('*/30 * * * *', async () => {
    await processConditionRecovery();
  });

  console.log('Condition recovery system initialized');
}

// 포지션별 컨디션 소모율
const POSITION_CONDITION_DRAIN = {
  'TOP': 0.15,      // 라인전 피로
  'JUNGLE': 0.20,   // 높은 로밍 활동
  'MID': 0.18,      // 활발한 움직임
  'ADC': 0.16,      // 중간 피로
  'SUPPORT': 0.12   // 낮은 피로
};

// 컨디션 회복 처리 (30분마다)
async function processConditionRecovery() {
  try {
    // 컨디션이 100 미만인 선수들 (부상자 제외)
    const players = await pool.query(
      `SELECT pc.*, t.id as team_id
       FROM player_cards pc
       JOIN teams t ON pc.team_id = t.id
       WHERE pc.condition < 100 AND pc.injury_status = 'NONE'`
    );

    for (const player of players) {
      // 의료 시설 레벨 확인
      const facilities = await pool.query(
        'SELECT level FROM team_facilities WHERE team_id = ? AND facility_type = "MEDICAL"',
        [player.team_id]
      );

      const medicalLevel = facilities.length > 0 ? facilities[0].level : 0;

      // 기본 회복량: 2% (30분 주기이므로 충분한 회복)
      const baseRecovery = 2;

      // 의료 시설 보너스: 레벨당 1% 추가
      const medicalBonus = medicalLevel * 1;

      // 부상 여부: 부상 중이면 회복 속도 50% 감소
      const injuryPenalty = player.injury_status !== 'NONE' ? 0.5 : 1.0;

      const recoveryAmount = (baseRecovery + medicalBonus) * injuryPenalty;
      const newCondition = Math.min(100, player.condition + recoveryAmount);

      await pool.query(
        'UPDATE player_cards SET condition = ? WHERE id = ?',
        [newCondition, player.id]
      );

      // 컨디션 히스토리 기록 (그래프용)
      await pool.query(
        'INSERT INTO player_condition_history (player_id, condition_value, recorded_at) VALUES (?, ?, NOW())',
        [player.id, newCondition]
      );
    }
  } catch (error) {
    console.error('Error processing condition recovery:', error);
  }
}

// 경기 후 컨디션 소모
export async function applyMatchConditionDrain(playerId: number, position: string, minutesPlayed: number = 90): Promise<number> {
  try {
    const player = await pool.query(
      'SELECT condition FROM player_cards WHERE id = ?',
      [playerId]
    );

    if (player.length === 0) return 100;

    // 포지션별 기본 소모율
    const drainRate = (POSITION_CONDITION_DRAIN[position as keyof typeof POSITION_CONDITION_DRAIN] || 0.15);

    // 플레이 시간에 따른 추가 소모 (90분 기준 = 1.0)
    const timeFactor = minutesPlayed / 90;

    // 총 컨디션 소모
    const totalDrain = drainRate * 100 * timeFactor;
    const newCondition = Math.max(20, player[0].condition - totalDrain);

    await pool.query(
      'UPDATE player_cards SET condition = ? WHERE id = ?',
      [newCondition, playerId]
    );

    return newCondition;
  } catch (error) {
    console.error('Error applying match condition drain:', error);
    return 100;
  }
}

