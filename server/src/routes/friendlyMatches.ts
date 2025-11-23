import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// AI 팀 목록 조회
router.get('/ai-opponents', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // AI 팀 목록 조회 (is_ai = true인 팀들) - player_cards 테이블 사용
    const aiTeams = await pool.query(
      `SELECT t.id, t.name, t.league, t.logo_url, t.team_color,
              (SELECT COUNT(*) FROM player_cards pc
               WHERE pc.team_id = t.id AND pc.is_starter = true AND pc.is_contracted = true) as starter_count,
              (SELECT COALESCE(AVG(pc.ovr), 0)
               FROM player_cards pc
               WHERE pc.team_id = t.id AND pc.is_starter = true AND pc.is_contracted = true) as avg_overall
       FROM teams t
       WHERE t.is_ai = true AND t.id != ?
       ORDER BY avg_overall ASC`,
      [req.teamId]
    );

    res.json(aiTeams);
  } catch (error: any) {
    console.error('Get AI opponents error:', error);
    res.status(500).json({ error: 'AI 팀 목록 조회 실패' });
  }
});

// 친선전 가능한 팀 목록 (모든 팀)
router.get('/available-teams', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teams = await pool.query(
      `SELECT t.id, t.name, t.league, t.logo_url, t.team_color, t.is_ai,
              (SELECT COUNT(*) FROM player_cards pc
               WHERE pc.team_id = t.id AND pc.is_starter = true AND pc.is_contracted = true) as starter_count,
              (SELECT COALESCE(AVG(pc.ovr), 0)
               FROM player_cards pc
               WHERE pc.team_id = t.id AND pc.is_starter = true AND pc.is_contracted = true) as avg_overall
       FROM teams t
       WHERE t.id != ?
       ORDER BY t.is_ai DESC, avg_overall ASC
       LIMIT 50`,
      [req.teamId]
    );

    res.json(teams);
  } catch (error: any) {
    console.error('Get available teams error:', error);
    res.status(500).json({ error: '팀 목록 조회 실패' });
  }
});

// 친선전 생성
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({ error: '팀이 필요합니다' });
    }

    const { opponent_team_id } = req.body;

    if (!opponent_team_id) {
      return res.status(400).json({ error: '상대 팀을 선택해주세요' });
    }

    if (opponent_team_id === req.teamId) {
      return res.status(400).json({ error: '자신의 팀과는 경기할 수 없습니다' });
    }

    // 상대 팀 확인
    const opponents = await pool.query(
      'SELECT * FROM teams WHERE id = ?',
      [opponent_team_id]
    );

    if (opponents.length === 0) {
      return res.status(404).json({ error: '상대 팀을 찾을 수 없습니다' });
    }

    // 내 팀 스타터 확인
    const myStarters = await pool.query(
      `SELECT COUNT(*) as count FROM player_ownership
       WHERE team_id = ? AND is_starter = true`,
      [req.teamId]
    );

    if (myStarters[0].count < 5) {
      return res.status(400).json({ error: '스타터 5명을 선발해야 친선전을 할 수 있습니다' });
    }

    // 진행 중인 친선전 확인
    const ongoingMatches = await pool.query(
      `SELECT * FROM matches
       WHERE match_type = 'FRIENDLY'
       AND (home_team_id = ? OR away_team_id = ?)
       AND status IN ('SCHEDULED', 'LIVE')`,
      [req.teamId, req.teamId]
    );

    if (ongoingMatches.length > 0) {
      return res.status(400).json({ error: '이미 진행 중인 친선전이 있습니다' });
    }

    // 친선전 생성 (1분 후 시작)
    const scheduledAt = new Date(Date.now() + 60 * 1000);

    const result = await pool.query(
      `INSERT INTO matches (home_team_id, away_team_id, match_type, status, scheduled_at)
       VALUES (?, ?, 'FRIENDLY', 'SCHEDULED', ?)`,
      [req.teamId, opponent_team_id, scheduledAt]
    );

    // 생성된 경기 정보 조회
    const matches = await pool.query(
      `SELECT m.*,
              ht.name as home_team_name, ht.logo_url as home_team_logo,
              at.name as away_team_name, at.logo_url as away_team_logo,
              DATE_FORMAT(m.scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at
       FROM matches m
       INNER JOIN teams ht ON m.home_team_id = ht.id
       INNER JOIN teams at ON m.away_team_id = at.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    res.json({
      message: '친선전이 생성되었습니다. 1분 후 시작됩니다.',
      match: matches[0]
    });
  } catch (error: any) {
    console.error('Create friendly match error:', error);
    res.status(500).json({ error: '친선전 생성 실패' });
  }
});

// 내 친선전 기록 조회
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({ error: '팀이 필요합니다' });
    }

    const matches = await pool.query(
      `SELECT m.id, m.home_team_id, m.away_team_id, m.home_score, m.away_score,
              m.status, DATE_FORMAT(m.scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at,
              DATE_FORMAT(m.finished_at, '%Y-%m-%d %H:%i:%s') as finished_at,
              ht.name as home_team_name, ht.logo_url as home_team_logo,
              at.name as away_team_name, at.logo_url as away_team_logo
       FROM matches m
       INNER JOIN teams ht ON m.home_team_id = ht.id
       INNER JOIN teams at ON m.away_team_id = at.id
       WHERE m.match_type = 'FRIENDLY'
       AND (m.home_team_id = ? OR m.away_team_id = ?)
       ORDER BY m.scheduled_at DESC
       LIMIT 20`,
      [req.teamId, req.teamId]
    );

    res.json(matches);
  } catch (error: any) {
    console.error('Get friendly history error:', error);
    res.status(500).json({ error: '친선전 기록 조회 실패' });
  }
});

export default router;
