import express from 'express';
import pool from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { io } from '../index';

const router = express.Router();

// 경기 목록
router.get('/', async (req, res) => {
  try {
    const { league_id, status, match_type } = req.query;

    let query = `
      SELECT m.*,
             ht.name as home_team_name,
             at.name as away_team_name,
             l.name as league_name
      FROM matches m
      INNER JOIN teams ht ON m.home_team_id = ht.id
      INNER JOIN teams at ON m.away_team_id = at.id
      LEFT JOIN leagues l ON m.league_id = l.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (league_id) {
      query += ' AND m.league_id = ?';
      params.push(league_id);
    }

    if (status) {
      query += ' AND m.status = ?';
      params.push(status);
    }

    if (match_type) {
      query += ' AND m.match_type = ?';
      params.push(match_type);
    }

    query += ' ORDER BY m.scheduled_at DESC LIMIT 100';

    const matches = await pool.query(query, params);

    res.json(matches);
  } catch (error: any) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

// 특정 경기 정보
router.get('/:matchId', async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);

    const matches = await pool.query(
      `       SELECT m.*,
              ht.name as home_team_name,
              at.name as away_team_name,
              l.name as league_name
       FROM matches m
       INNER JOIN teams ht ON m.home_team_id = ht.id
       INNER JOIN teams at ON m.away_team_id = at.id
       LEFT JOIN leagues l ON m.league_id = l.id
       WHERE m.id = ?`,
      [matchId]
    );

    if (matches.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // 경기 이벤트
    const events = await pool.query(
      'SELECT * FROM match_events WHERE match_id = ? ORDER BY event_time ASC',
      [matchId]
    );

    // 경기 통계
    const stats = await pool.query(
      `SELECT ms.*, p.name as player_name, p.position, t.name as team_name
       FROM match_stats ms
       INNER JOIN players p ON ms.player_id = p.id
       INNER JOIN teams t ON ms.team_id = t.id
       WHERE ms.match_id = ?`,
      [matchId]
    );

    res.json({
      match: matches[0],
      events,
      stats
    });
  } catch (error: any) {
    console.error('Get match error:', error);
    res.status(500).json({ error: 'Failed to get match' });
  }
});

// 경기 관전 시작
router.post('/:matchId/watch', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const matchId = parseInt(req.params.matchId);

    const matches = await pool.query('SELECT * FROM matches WHERE id = ?', [matchId]);
    if (matches.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Socket.IO를 통해 실시간 업데이트 구독
    res.json({ message: 'Watching match', matchId });
  } catch (error: any) {
    console.error('Watch match error:', error);
    res.status(500).json({ error: 'Failed to watch match' });
  }
});

export default router;

