import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { LeagueStructureService } from '../services/leagueStructureService.js';
import pool from '../database/db.js';

const router = express.Router();

// WORLDS 정보 조회
router.get('/worlds/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);

    const worlds = await pool.query(
      `SELECT * FROM worlds_tournaments WHERE season = ?`,
      [season]
    );

    if (worlds.length === 0) {
      return res.json({ exists: false });
    }

    const participants = await pool.query(
      `SELECT wp.*, t.name as team_name, t.logo_url
       FROM worlds_participants wp
       JOIN teams t ON wp.team_id = t.id
       WHERE wp.worlds_id = ?
       ORDER BY wp.region, wp.seed`,
      [worlds[0].id]
    );

    const matches = await pool.query(
      `SELECT wm.*,
              t1.name as team1_name, t1.logo_url as team1_logo,
              t2.name as team2_name, t2.logo_url as team2_logo
       FROM worlds_matches wm
       LEFT JOIN teams t1 ON wm.team1_id = t1.id
       LEFT JOIN teams t2 ON wm.team2_id = t2.id
       WHERE wm.worlds_id = ?
       ORDER BY wm.round, wm.match_number`,
      [worlds[0].id]
    );

    res.json({
      exists: true,
      tournament: worlds[0],
      participants,
      matches
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 승격/강등전 조회
router.get('/promotion/:season/:region', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const region = req.params.region;

    const matches = await pool.query(
      `SELECT pm.*,
              t1.name as first_div_team_name, t1.logo_url as first_div_logo,
              t2.name as second_div_team_name, t2.logo_url as second_div_logo
       FROM promotion_matches pm
       JOIN teams t1 ON pm.first_div_team_id = t1.id
       JOIN teams t2 ON pm.second_div_team_id = t2.id
       WHERE pm.season = ? AND pm.region = ?`,
      [season, region]
    );

    res.json(matches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 리그 순위 조회 (지역별)
router.get('/standings/:season/:region', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const region = req.params.region;

    const leagues = await pool.query(
      `SELECT l.id, l.name,
              lp.team_id, t.name as team_name, t.logo_url,
              lp.wins, lp.losses, lp.draws, lp.points, lp.goal_difference
       FROM leagues l
       JOIN league_participants lp ON l.id = lp.league_id
       JOIN teams t ON lp.team_id = t.id
       WHERE l.season = ? AND l.region = ?
       ORDER BY l.name, lp.points DESC, lp.goal_difference DESC, lp.wins DESC`,
      [season, region]
    );

    res.json(leagues);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 관리자: 시즌 초기화
router.post('/admin/initialize-season', authenticateToken, async (req: any, res) => {
  try {
    const { season } = req.body;
    const leagues = await LeagueStructureService.initializeSeason(season);
    res.json({ success: true, leagues });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 관리자: 팀 배정
router.post('/admin/distribute-teams', authenticateToken, async (req: any, res) => {
  try {
    const { season } = req.body;
    const distribution = await LeagueStructureService.distributeTeams(season);
    res.json({ success: true, distribution });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 관리자: 일정 생성
router.post('/admin/generate-schedule', authenticateToken, async (req: any, res) => {
  try {
    const { leagueId } = req.body;
    const result = await LeagueStructureService.generateSchedule(leagueId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 관리자: WORLDS 생성
router.post('/admin/create-worlds', authenticateToken, async (req: any, res) => {
  try {
    const { season } = req.body;
    const result = await LeagueStructureService.createWorlds(season);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 관리자: 승격전 생성
router.post('/admin/create-promotion', authenticateToken, async (req: any, res) => {
  try {
    const { season, region } = req.body;
    const result = await LeagueStructureService.createPromotionMatches(season, region);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 관리자: 시즌 완전 리셋
router.post('/admin/reset-season', authenticateToken, async (req: any, res) => {
  try {
    const { newSeason } = req.body;
    const result = await LeagueStructureService.resetSeason(newSeason);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
