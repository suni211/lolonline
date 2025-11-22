import express from 'express';
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

    res.json({
      ...teams[0],
      facilities
    });
  } catch (error: any) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to get team info' });
  }
});

// 팀 정보 업데이트
router.put('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
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

