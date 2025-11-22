import pool from '../database/db.js';

// 경기 후 선수 경험치 획득
export async function giveMatchExperience(matchId: number, teamId: number, won: boolean) {
  try {
    // 경기 참가 선수 가져오기
    const players = await pool.query(
      `SELECT p.* FROM players p
       INNER JOIN player_ownership po ON p.id = po.player_id
       WHERE po.team_id = ? AND po.is_starter = true`,
      [teamId]
    );

    // 승리 시 더 많은 경험치
    const baseExp = won ? 50 : 30;

    for (const player of players) {
      const expGain = baseExp + Math.floor(Math.random() * 20);
      const newExp = player.exp + expGain;

      // 레벨업 체크
      let newLevel = player.level;
      let remainingExp = newExp;
      let newExpToNext = player.exp_to_next;
      let newStatPoints = player.stat_points;

      while (remainingExp >= newExpToNext && newLevel < 100) {
        remainingExp -= newExpToNext;
        newLevel++;
        newExpToNext = Math.floor(newExpToNext * 1.5);
        newStatPoints += 5; // 레벨업 시 스탯 포인트 5 추가
      }

      await pool.query(
        `UPDATE players 
         SET exp = ?, exp_to_next = ?, level = ?, stat_points = ?
         WHERE id = ?`,
        [remainingExp, newExpToNext, newLevel, newStatPoints, player.id]
      );
    }
  } catch (error) {
    console.error('Error giving match experience:', error);
  }
}

