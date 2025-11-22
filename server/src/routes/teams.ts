import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 팀 정보 가져오기
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teams = await pool.query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM player_ownership po WHERE po.team_id = t.id) as player_count,
              (SELECT COUNT(*) FROM player_ownership po WHERE po.team_id = t.id AND po.is_starter = true) as starter_count
       FROM teams t WHERE id = ?`,
      [req.teamId]
    );

    if (teams.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // 시설 정보
    const facilities = await pool.query(
      'SELECT * FROM team_facilities WHERE team_id = ?',
      [req.teamId]
    );

    // 재무 통계 (최근 30일)
    const financialStats = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN exchange_type = 'GOLD_TO_DIAMOND' THEN -amount ELSE 0 END) as gold_spent,
        SUM(CASE WHEN exchange_type = 'DIAMOND_TO_GOLD' THEN result_amount ELSE 0 END) as gold_earned
       FROM currency_exchanges
       WHERE team_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [req.teamId]
    );

    // 경기 수익 (최근 30일)
    const matchRevenue = await pool.query(
      `SELECT 
        DATE(m.finished_at) as date,
        SUM(CASE WHEN m.home_team_id = ? THEN 
          CASE WHEN m.home_score > m.away_score THEN 5000 ELSE 2000 END
          ELSE 
          CASE WHEN m.away_score > m.home_score THEN 5000 ELSE 2000 END
        END) as revenue
       FROM matches m
       WHERE (m.home_team_id = ? OR m.away_team_id = ?) 
         AND m.status = 'FINISHED' 
         AND m.finished_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(m.finished_at)
       ORDER BY date ASC`,
      [req.teamId, req.teamId, req.teamId]
    );

    // 선수 통계 (포지션별)
    const positionStats = await pool.query(
      `SELECT 
        p.position,
        COUNT(*) as count,
        AVG(p.mental + p.teamfight + p.focus + p.laning) as avg_overall
       FROM players p
       INNER JOIN player_ownership po ON p.id = po.player_id
       WHERE po.team_id = ?
       GROUP BY p.position`,
      [req.teamId]
    );

    res.json({
      ...teams[0],
      facilities,
      financialStats,
      matchRevenue,
      positionStats
    });
  } catch (error: any) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to get team info' });
  }
});

// 팀 생성
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }

    // 이미 팀이 있는지 확인
    const existingTeams = await pool.query(
      'SELECT * FROM teams WHERE user_id = ?',
      [req.userId]
    );

    if (existingTeams.length > 0) {
      return res.status(400).json({ error: '이미 팀이 존재합니다' });
    }

    const { name, logo_url, team_color, league } = req.body;

    if (!name || !league) {
      return res.status(400).json({ error: '팀 이름과 리그를 입력해주세요' });
    }

    if (!['EAST', 'WEST'].includes(league)) {
      return res.status(400).json({ error: '올바른 리그를 선택해주세요' });
    }

    // 팀 생성
    const teamResult = await pool.query(
      `INSERT INTO teams (user_id, name, league, logo_url, team_color, gold, diamond) 
       VALUES (?, ?, ?, ?, ?, 100000, 100)`,
      [req.userId, name, league, logo_url || null, team_color || '#1E3A8A']
    );

    const teamId = teamResult.insertId;

    // 리그 참가
    const leagueResult = await pool.query(
      'SELECT id FROM leagues WHERE region = ? AND season = (SELECT MAX(season) FROM leagues WHERE region = ?)',
      [league, league]
    );

    if (leagueResult.length > 0) {
      await pool.query(
        'INSERT INTO league_participants (league_id, team_id) VALUES (?, ?)',
        [leagueResult[0].id, teamId]
      );
    }

    // 새로운 JWT 토큰 생성 (teamId 포함)
    const newToken = jwt.sign(
      { userId: req.userId, teamId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.json({ teamId, token: newToken, message: '팀이 생성되었습니다' });
  } catch (error: any) {
    console.error('Create team error:', error);
    res.status(500).json({ error: '팀 생성에 실패했습니다: ' + (error.message || '알 수 없는 오류') });
  }
});

// 팀 정보 업데이트
router.put('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({ error: '팀이 없습니다' });
    }

    const { name, logo_url, team_color, home_stadium } = req.body;

    await pool.query(
      `UPDATE teams 
       SET name = COALESCE(?, name),
           logo_url = COALESCE(?, logo_url),
           team_color = COALESCE(?, team_color),
           home_stadium = COALESCE(?, home_stadium)
       WHERE id = ?`,
      [name, logo_url, team_color, home_stadium, req.teamId]
    );

    res.json({ message: 'Team updated successfully' });
  } catch (error: any) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// 팀 시설 업그레이드
router.post('/facilities/upgrade', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { facility_type } = req.body;

    if (!['TRAINING', 'MEDICAL', 'SCOUTING'].includes(facility_type)) {
      return res.status(400).json({ error: 'Invalid facility type' });
    }

    // 현재 시설 정보
    const facilities = await pool.query(
      'SELECT * FROM team_facilities WHERE team_id = ? AND facility_type = ?',
      [req.teamId, facility_type]
    );

    const currentLevel = facilities.length > 0 ? facilities[0].level : 0;
    const nextLevel = currentLevel + 1;

    // 업그레이드 비용 계산 (레벨당 10000 골드)
    const cost = nextLevel * 10000;

    // 팀 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0 || teams[0].gold < cost) {
      return res.status(400).json({ error: 'Insufficient gold' });
    }

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [cost, req.teamId]);

    // 시설 업그레이드
    if (facilities.length > 0) {
      await pool.query(
        'UPDATE team_facilities SET level = ? WHERE team_id = ? AND facility_type = ?',
        [nextLevel, req.teamId, facility_type]
      );
    } else {
      await pool.query(
        'INSERT INTO team_facilities (team_id, facility_type, level) VALUES (?, ?, ?)',
        [req.teamId, facility_type, nextLevel]
      );
    }

    res.json({ message: 'Facility upgraded successfully', level: nextLevel });
  } catch (error: any) {
    console.error('Upgrade facility error:', error);
    res.status(500).json({ error: 'Failed to upgrade facility' });
  }
});

export default router;

