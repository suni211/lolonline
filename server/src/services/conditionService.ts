import pool from '../database/db';
import cron from 'node-cron';

// 컨디션 자동 회복 시스템 초기화
export function initializeConditionRecovery() {
  // 매 30분마다 컨디션 회복 체크
  cron.schedule('*/30 * * * *', async () => {
    await processConditionRecovery();
  });

  console.log('Condition recovery system initialized');
}

// 컨디션 회복 처리
async function processConditionRecovery() {
  try {
    // 컨디션이 100 미만인 선수들
    const players = await pool.query(
      `SELECT p.*, po.team_id 
       FROM players p
       INNER JOIN player_ownership po ON p.id = po.player_id
       WHERE p.`condition` < 100 AND p.injury_status = 'NONE'`
    );

    for (const player of players) {
      // 의료 시설 레벨 확인
      const facilities = await pool.query(
        'SELECT level FROM team_facilities WHERE team_id = ? AND facility_type = "MEDICAL"',
        [player.team_id]
      );

      const medicalLevel = facilities.length > 0 ? facilities[0].level : 0;
      
      // 기본 회복량: 1%, 의료 시설 레벨당 추가 0.5%
      const recoveryAmount = 1 + (medicalLevel * 0.5);
      
      const newCondition = Math.min(100, (player as any).condition + recoveryAmount);

      await pool.query(
        'UPDATE players SET `condition` = ? WHERE id = ?',
        [newCondition, player.id]
      );
    }
  } catch (error) {
    console.error('Error processing condition recovery:', error);
  }
}

