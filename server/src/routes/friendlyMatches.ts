import express from 'express';
import pool from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { io } from '../index';

const router = express.Router();

// 친선전 생성
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { opponent_team_id } = req.body;

    if (!opponent_team_id) {
      return res.status(400).json({ error: 'Opponent team ID required' });
    }

    if (opponent_team_id === req.teamId) {
      return res.status(400).json({ error: 'Cannot play against yourself' });
    }

    // 상대 팀 확인
    const opponentTeams = await pool.query('SELECT * FROM teams WHERE id = ?', [opponent_team_id]);
    if (opponentTeams.length === 0) {
      return res.status(404).json({ error: 'Opponent team not found' });
    }

    // 친선전 생성 (리그는 NULL)
    const scheduledAt = new Date();
    scheduledAt.setMinutes(scheduledAt.getMinutes() + 5); // 5분 후 시작

    const result = await pool.query(
      `INSERT INTO matches (league_id, home_team_id, away_team_id, match_type, scheduled_at, status)
       VALUES (NULL, ?, ?, 'FRIENDLY', ?, 'SCHEDULED')`,
      [req.teamId, opponent_team_id, scheduledAt]
    );

    res.json({ match_id: result.insertId, message: 'Friendly match created' });
  } catch (error: any) {
    console.error('Create friendly match error:', error);
    res.status(500).json({ error: 'Failed to create friendly match' });
  }
});

// 친선전 가능한 팀 목록
router.get('/available-teams', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teams = await pool.query(
      `SELECT t.id, t.name, t.league, 
              (SELECT COUNT(*) FROM player_ownership po WHERE po.team_id = t.id) as player_count
       FROM teams t
       WHERE t.id != ?
       ORDER BY t.name
       LIMIT 50`,
      [req.teamId]
    );

    res.json(teams);
  } catch (error: any) {
    console.error('Get available teams error:', error);
    res.status(500).json({ error: 'Failed to get available teams' });
  }
});

export default router;

