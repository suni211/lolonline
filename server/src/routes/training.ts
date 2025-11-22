import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 개별 훈련
router.post('/individual', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { player_id, stat_type } = req.body;

    if (!player_id || !stat_type) {
      return res.status(400).json({ error: 'Player ID and stat type required' });
    }

    if (!['MENTAL', 'TEAMFIGHT', 'FOCUS', 'LANING'].includes(stat_type)) {
      return res.status(400).json({ error: 'Invalid stat type' });
    }

    // 선수 소유 확인
    const ownership = await pool.query(
      'SELECT * FROM player_ownership WHERE player_id = ? AND team_id = ?',
      [player_id, req.teamId]
    );

    if (ownership.length === 0) {
      return res.status(404).json({ error: 'Player not found or not owned' });
    }

    // 부상 확인
    const players = await pool.query('SELECT * FROM players WHERE id = ?', [player_id]);
    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = players[0];

    if (player.injury_status !== 'NONE') {
      return res.status(400).json({ error: 'Injured players cannot train' });
    }

    // 훈련 시설 레벨 확인
    const facilities = await pool.query(
      'SELECT level FROM team_facilities WHERE team_id = ? AND facility_type = "TRAINING"',
      [req.teamId]
    );

    const trainingLevel = facilities.length > 0 ? facilities[0].level : 0;
    
    // 훈련 비용 계산 (기본 500 골드, 시설 레벨당 100 골드 감소)
    const baseCost = 500;
    const cost = Math.max(100, baseCost - (trainingLevel * 100));

    // 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0 || teams[0].gold < cost) {
      return res.status(400).json({ error: 'Insufficient gold' });
    }

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [cost, req.teamId]);

    // 훈련 효과 계산
    const baseExp = 20 + (trainingLevel * 5); // 기본 20, 시설 레벨당 +5
    const baseStatIncrease = 1 + Math.floor(trainingLevel / 2); // 시설 레벨 2당 +1

    // 경험치 증가
    const newExp = player.exp + baseExp;
    let remainingExp = newExp;
    let newLevel = player.level;
    let newExpToNext = player.exp_to_next;
    let newStatPoints = player.stat_points;

    // 레벨업 체크
    while (remainingExp >= newExpToNext && newLevel < 100) {
      remainingExp -= newExpToNext;
      newLevel++;
      newExpToNext = Math.floor(newExpToNext * 1.5);
      newStatPoints += 5;
    }

    // 스탯 증가 (한계 확인)
    const statField = stat_type.toLowerCase();
    const currentStat = player[statField as keyof typeof player] as number;
    const maxStat = 300;
    const actualStatIncrease = Math.min(baseStatIncrease, maxStat - currentStat);

    if (actualStatIncrease > 0) {
      await pool.query(
        `UPDATE players 
         SET exp = ?, exp_to_next = ?, level = ?, stat_points = ?,
             ${statField} = LEAST(${statField} + ?, 300)
         WHERE id = ?`,
        [remainingExp, newExpToNext, newLevel, newStatPoints, actualStatIncrease, player_id]
      );
    } else {
      await pool.query(
        `UPDATE players 
         SET exp = ?, exp_to_next = ?, level = ?, stat_points = ?
         WHERE id = ?`,
        [remainingExp, newExpToNext, newLevel, newStatPoints, player_id]
      );
    }

    // 훈련 기록
    await pool.query(
      `INSERT INTO player_training (player_id, team_id, training_type, stat_type, exp_gained, stat_increase)
       VALUES (?, ?, 'INDIVIDUAL', ?, ?, ?)`,
      [player_id, req.teamId, stat_type, baseExp, actualStatIncrease]
    );

    res.json({
      message: 'Training completed',
      exp_gained: baseExp,
      stat_increase: actualStatIncrease,
      cost
    });
  } catch (error: any) {
    console.error('Individual training error:', error);
    res.status(500).json({ error: 'Failed to train player' });
  }
});

// 팀 훈련
router.post('/team', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { stat_type } = req.body;

    if (!stat_type || !['MENTAL', 'TEAMFIGHT', 'FOCUS', 'LANING'].includes(stat_type)) {
      return res.status(400).json({ error: 'Valid stat type required' });
    }

    // 스타터 선수들 가져오기
    const players = await pool.query(
      `SELECT p.* FROM players p
       INNER JOIN player_ownership po ON p.id = po.player_id
       WHERE po.team_id = ? AND po.is_starter = true AND p.injury_status = 'NONE'`,
      [req.teamId]
    );

    if (players.length === 0) {
      return res.status(400).json({ error: 'No available players for team training' });
    }

    // 훈련 시설 레벨 확인
    const facilities = await pool.query(
      'SELECT level FROM team_facilities WHERE team_id = ? AND facility_type = "TRAINING"',
      [req.teamId]
    );

    const trainingLevel = facilities.length > 0 ? facilities[0].level : 0;
    
    // 팀 훈련 비용 (선수 수 * 300 골드, 시설 레벨당 50 골드 감소)
    const baseCostPerPlayer = 300;
    const costPerPlayer = Math.max(100, baseCostPerPlayer - (trainingLevel * 50));
    const totalCost = costPerPlayer * players.length;

    // 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0 || teams[0].gold < totalCost) {
      return res.status(400).json({ error: 'Insufficient gold' });
    }

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [totalCost, req.teamId]);

    // 팀 훈련 효과 (개별 훈련보다 약간 낮지만 모든 선수에게 적용)
    const baseExp = 15 + (trainingLevel * 3);
    const baseStatIncrease = Math.floor(1 + trainingLevel / 3);

    let totalExpGained = 0;
    let totalStatIncrease = 0;

    for (const player of players) {
      // 경험치 증가
      const newExp = player.exp + baseExp;
      let remainingExp = newExp;
      let newLevel = player.level;
      let newExpToNext = player.exp_to_next;
      let newStatPoints = player.stat_points;

      // 레벨업 체크
      while (remainingExp >= newExpToNext && newLevel < 100) {
        remainingExp -= newExpToNext;
        newLevel++;
        newExpToNext = Math.floor(newExpToNext * 1.5);
        newStatPoints += 5;
      }

      // 스탯 증가
      const statField = stat_type.toLowerCase();
      const currentStat = player[statField as keyof typeof player] as number;
      const actualStatIncrease = Math.min(baseStatIncrease, 300 - currentStat);

      if (actualStatIncrease > 0) {
        await pool.query(
          `UPDATE players 
           SET exp = ?, exp_to_next = ?, level = ?, stat_points = ?,
               ${statField} = LEAST(${statField} + ?, 300)
           WHERE id = ?`,
          [remainingExp, newExpToNext, newLevel, newStatPoints, actualStatIncrease, player.id]
        );
      } else {
        await pool.query(
          `UPDATE players 
           SET exp = ?, exp_to_next = ?, level = ?, stat_points = ?
           WHERE id = ?`,
          [remainingExp, newExpToNext, newLevel, newStatPoints, player.id]
        );
      }

      // 훈련 기록
      await pool.query(
        `INSERT INTO player_training (player_id, team_id, training_type, stat_type, exp_gained, stat_increase)
         VALUES (?, ?, 'TEAM', ?, ?, ?)`,
        [player.id, req.teamId, stat_type, baseExp, actualStatIncrease]
      );

      totalExpGained += baseExp;
      totalStatIncrease += actualStatIncrease;
    }

    // 팀 시너지 증가 (만족도 증가)
    await pool.query(
      `UPDATE players 
       SET satisfaction = LEAST(satisfaction + 2, 100)
       WHERE id IN (${players.map(() => '?').join(',')})`,
      players.map((p: any) => p.id)
    );

    res.json({
      message: 'Team training completed',
      players_trained: players.length,
      total_exp_gained: totalExpGained,
      total_stat_increase: totalStatIncrease,
      cost: totalCost
    });
  } catch (error: any) {
    console.error('Team training error:', error);
    res.status(500).json({ error: 'Failed to train team' });
  }
});

// 훈련 기록 조회
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { player_id, limit } = req.query;

    let query = `
      SELECT pt.*, p.name as player_name
      FROM player_training pt
      INNER JOIN players p ON pt.player_id = p.id
      WHERE pt.team_id = ?
    `;

    const params: any[] = [req.teamId];

    if (player_id) {
      query += ' AND pt.player_id = ?';
      params.push(player_id);
    }

    query += ' ORDER BY pt.trained_at DESC LIMIT ?';
    params.push(limit ? parseInt(limit as string) : 50);

    const history = await pool.query(query, params);

    res.json(history);
  } catch (error: any) {
    console.error('Get training history error:', error);
    res.status(500).json({ error: 'Failed to get training history' });
  }
});

export default router;

