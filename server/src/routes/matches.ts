import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { io } from '../index.js';

const router = express.Router();

// 경기 목록
router.get('/', async (req, res) => {
  try {
    const { league_id, status, match_type } = req.query;

    let query = `
      SELECT m.id, m.league_id, m.home_team_id, m.away_team_id, m.match_type, m.round,
             m.status, m.home_score, m.away_score, m.match_data,
             DATE_FORMAT(m.scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at,
             DATE_FORMAT(m.started_at, '%Y-%m-%d %H:%i:%s') as started_at,
             DATE_FORMAT(m.finished_at, '%Y-%m-%d %H:%i:%s') as finished_at,
             ht.name as home_team_name, ht.abbreviation as home_team_abbr, ht.logo_url as home_team_logo,
             at.name as away_team_name, at.abbreviation as away_team_abbr, at.logo_url as away_team_logo,
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

    query += ' ORDER BY m.scheduled_at ASC LIMIT 100';

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
              ht.name as home_team_name, ht.logo_url as home_team_logo,
              at.name as away_team_name, at.logo_url as away_team_logo,
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
    const rawEvents = await pool.query(
      'SELECT * FROM match_events WHERE match_id = ? ORDER BY event_time ASC',
      [matchId]
    );

    // 프론트엔드 형식으로 변환 (event_time -> time, event_type -> type)
    const events = rawEvents.map((e: any) => ({
      type: e.event_type,
      time: e.event_time,
      description: e.description,
      data: e.event_data ? (typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data) : {}
    }));

    // 경기 통계 (player_cards + pro_players 사용)
    const stats = await pool.query(
      `SELECT ms.*, pp.name as player_name, pp.position, t.name as team_name
       FROM match_stats ms
       INNER JOIN player_cards pc ON ms.player_id = pc.id
       INNER JOIN pro_players pp ON pc.pro_player_id = pp.id
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

