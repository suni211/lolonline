import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 선수 조합 목록
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const combinations = await pool.query(
      `SELECT pc.*, 
              CASE WHEN cc.team_id IS NOT NULL THEN true ELSE false END as completed
       FROM player_combinations pc
       LEFT JOIN combination_completions cc ON pc.id = cc.combination_id AND cc.team_id = ?
       ORDER BY pc.id`,
      [req.teamId]
    );

    res.json(combinations);
  } catch (error: any) {
    console.error('Get combinations error:', error);
    res.status(500).json({ error: 'Failed to get combinations' });
  }
});

// 선수 조합 완성 확인 및 보상 지급
router.post('/check', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const combinations = await pool.query('SELECT * FROM player_combinations');

    for (const combination of combinations) {
      // 이미 완성했는지 확인
      const completed = await pool.query(
        'SELECT * FROM combination_completions WHERE combination_id = ? AND team_id = ?',
        [combination.id, req.teamId]
      );

      if (completed.length > 0) {
        continue; // 이미 완성함
      }

      // 필요한 선수 ID 목록
      const requiredPlayerIds = JSON.parse(combination.required_player_ids);

      // 내가 소유한 선수 ID 목록
      const myPlayers = await pool.query(
        `SELECT p.id FROM players p
         INNER JOIN player_ownership po ON p.id = po.player_id
         WHERE po.team_id = ?`,
        [req.teamId]
      );

      const myPlayerIds = myPlayers.map((p: any) => p.id);

      // 모든 필요한 선수를 소유하고 있는지 확인
      const hasAllPlayers = requiredPlayerIds.every((id: number) => myPlayerIds.includes(id));

      if (hasAllPlayers) {
        // 조합 완성 기록
        await pool.query(
          'INSERT INTO combination_completions (combination_id, team_id) VALUES (?, ?)',
          [combination.id, req.teamId]
        );

        // 보상 지급
        if (combination.reward_gold > 0) {
          await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [combination.reward_gold, req.teamId]);
        }
        if (combination.reward_diamond > 0) {
          await pool.query('UPDATE teams SET diamond = diamond + ? WHERE id = ?', [combination.reward_diamond, req.teamId]);
        }

        res.json({
          combination_id: combination.id,
          combination_name: combination.combination_name,
          reward_gold: combination.reward_gold,
          reward_diamond: combination.reward_diamond,
          message: 'Combination completed!'
        });
        return;
      }
    }

    res.json({ message: 'No new combinations completed' });
  } catch (error: any) {
    console.error('Check combinations error:', error);
    res.status(500).json({ error: 'Failed to check combinations' });
  }
});

export default router;

