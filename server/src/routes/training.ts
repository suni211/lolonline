import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 개별 훈련 (카드 기반)
router.post('/individual', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { player_id, stat_type } = req.body;

    if (!player_id || !stat_type) {
      return res.status(400).json({ error: 'Card ID and stat type required' });
    }

    if (!['MENTAL', 'TEAMFIGHT', 'FOCUS', 'LANING'].includes(stat_type)) {
      return res.status(400).json({ error: 'Invalid stat type' });
    }

    // 카드 소유권 확인
    const cards = await pool.query(
      `SELECT pc.*, pp.name FROM player_cards pc
       JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.id = ? AND pc.team_id = ?`,
      [player_id, req.teamId]
    );

    if (cards.length === 0) {
      return res.status(404).json({ error: 'Card not found or not owned' });
    }

    const card = cards[0];

    // 계약되지 않은 카드는 훈련 불가
    if (!card.is_contracted) {
      return res.status(400).json({ error: '계약된 선수만 훈련할 수 있습니다' });
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
    const baseStatIncrease = 1 + Math.floor(trainingLevel / 2); // 시설 레벨 2당 +1

    // 스탯 증가 (한계 확인)
    const statField = stat_type.toLowerCase();
    const currentStat = card[statField as keyof typeof card] as number;
    const maxStat = 200;
    const actualStatIncrease = Math.min(baseStatIncrease, maxStat - currentStat);

    if (actualStatIncrease > 0) {
      // 스탯 증가 및 OVR 재계산
      await pool.query(
        `UPDATE player_cards
         SET ${statField} = LEAST(${statField} + ?, 200),
             ovr = ROUND((mental + teamfight + focus + laning + ?) / 4)
         WHERE id = ?`,
        [actualStatIncrease, statField === 'mental' ? actualStatIncrease : (statField === 'teamfight' ? actualStatIncrease : (statField === 'focus' ? actualStatIncrease : actualStatIncrease)), player_id]
      );

      // OVR 정확히 재계산
      const newStats = await pool.query('SELECT mental, teamfight, focus, laning FROM player_cards WHERE id = ?', [player_id]);
      if (newStats.length > 0) {
        const newOvr = Math.round((newStats[0].mental + newStats[0].teamfight + newStats[0].focus + newStats[0].laning) / 4);
        await pool.query('UPDATE player_cards SET ovr = ? WHERE id = ?', [newOvr, player_id]);
      }
    }

    // 훈련 기록
    await pool.query(
      `INSERT INTO player_training (player_id, team_id, training_type, stat_type, exp_gained, stat_increase)
       VALUES (?, ?, 'INDIVIDUAL', ?, 0, ?)`,
      [player_id, req.teamId, stat_type, actualStatIncrease]
    );

    res.json({
      message: 'Training completed',
      stat_increase: actualStatIncrease,
      cost
    });
  } catch (error: any) {
    console.error('Individual training error:', error);
    res.status(500).json({ error: 'Failed to train player' });
  }
});

// 팀 훈련 (카드 기반)
router.post('/team', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { stat_type } = req.body;

    if (!stat_type || !['MENTAL', 'TEAMFIGHT', 'FOCUS', 'LANING'].includes(stat_type)) {
      return res.status(400).json({ error: 'Valid stat type required' });
    }

    // 스타터 카드들 가져오기 (계약된 카드만)
    const cards = await pool.query(
      `SELECT pc.*, pp.name FROM player_cards pc
       JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.team_id = ? AND pc.is_starter = true AND pc.is_contracted = true`,
      [req.teamId]
    );

    if (cards.length === 0) {
      return res.status(400).json({ error: '훈련할 스타터가 없습니다' });
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
    const totalCost = costPerPlayer * cards.length;

    // 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0 || teams[0].gold < totalCost) {
      return res.status(400).json({ error: 'Insufficient gold' });
    }

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [totalCost, req.teamId]);

    // 팀 훈련 효과
    const baseStatIncrease = Math.floor(1 + trainingLevel / 3);

    let totalStatIncrease = 0;

    for (const card of cards) {
      // 스탯 증가
      const statField = stat_type.toLowerCase();
      const currentStat = card[statField as keyof typeof card] as number;
      const actualStatIncrease = Math.min(baseStatIncrease, 200 - currentStat);

      if (actualStatIncrease > 0) {
        await pool.query(
          `UPDATE player_cards
           SET ${statField} = LEAST(${statField} + ?, 200)
           WHERE id = ?`,
          [actualStatIncrease, card.id]
        );

        // OVR 재계산
        const newStats = await pool.query('SELECT mental, teamfight, focus, laning FROM player_cards WHERE id = ?', [card.id]);
        if (newStats.length > 0) {
          const newOvr = Math.round((newStats[0].mental + newStats[0].teamfight + newStats[0].focus + newStats[0].laning) / 4);
          await pool.query('UPDATE player_cards SET ovr = ? WHERE id = ?', [newOvr, card.id]);
        }
      }

      // 훈련 기록
      await pool.query(
        `INSERT INTO player_training (player_id, team_id, training_type, stat_type, exp_gained, stat_increase)
         VALUES (?, ?, 'TEAM', ?, 0, ?)`,
        [card.id, req.teamId, stat_type, actualStatIncrease]
      );

      totalStatIncrease += actualStatIncrease;
    }

    res.json({
      message: 'Team training completed',
      players_trained: cards.length,
      total_stat_increase: totalStatIncrease,
      cost: totalCost
    });
  } catch (error: any) {
    console.error('Team training error:', error);
    res.status(500).json({ error: 'Failed to train team' });
  }
});

// 훈련 기록 조회 (카드 기반)
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { player_id, limit } = req.query;

    let query = `
      SELECT pt.*, pp.name as player_name
      FROM player_training pt
      LEFT JOIN player_cards pc ON pt.player_id = pc.id
      LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
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

