import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import LPOLeagueService from '../services/lpoLeagueService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 로고 업로드 설정
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // dist에서 실행되므로 상위로 3단계 올라가서 client/dist/logos로
    const uploadPath = path.join(__dirname, '..', '..', '..', 'client', 'dist', 'logos');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const teamId = (req as AuthRequest).teamId;
    const ext = path.extname(file.originalname);
    cb(null, `team_${teamId}${ext}`);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB 제한
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다'));
    }
  }
});

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

    const { name, logo_url, team_color } = req.body;

    if (!name) {
      return res.status(400).json({ error: '팀 이름을 입력해주세요' });
    }

    // 팀 생성 (자동으로 LPO 2 LEAGUE로 배정)
    const teamResult = await pool.query(
      `INSERT INTO teams (user_id, name, league, logo_url, team_color, gold, diamond, is_ai)
       VALUES (?, ?, 'SECOND', ?, ?, 1000, 100, false)`,
      [req.userId, name, logo_url || null, team_color || '#1E3A8A']
    );

    const teamId = teamResult.insertId;

    // AI 팀 대체 (LPO 2 LEAGUE에서 AI 팀 하나를 대체)
    try {
      const replacement = await LPOLeagueService.replaceAITeam(teamId);
      console.log(`Team ${name} replaced AI team: ${replacement.replacedTeam}`);
    } catch (replaceError: any) {
      console.error('AI team replacement failed:', replaceError.message);
      // 대체 실패 시 직접 리그에 등록
      const leagueResult = await pool.query(
        "SELECT id FROM leagues WHERE region = 'SECOND' AND season = (SELECT MAX(season) FROM leagues WHERE region = 'SECOND')"
      );

      if (leagueResult.length > 0) {
        await pool.query(
          'INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference) VALUES (?, ?, 0, 0, 0, 0, 0)',
          [leagueResult[0].id, teamId]
        );
      }
    }

    // 새로운 JWT 토큰 생성 (teamId 포함)
    const newToken = jwt.sign(
      { userId: req.userId, teamId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.json({ teamId, token: newToken, message: '팀이 생성되었습니다. LPO 2 LEAGUE에 배정되었습니다.' });
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

// 팀 로고 업로드
router.post('/logo', authenticateToken, uploadLogo.single('logo'), async (req: AuthRequest, res) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({ error: '팀이 없습니다' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '로고 파일이 필요합니다' });
    }

    // 기존 로고 삭제
    const teams = await pool.query('SELECT logo_url FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length > 0 && teams[0].logo_url) {
      const oldPath = path.join(__dirname, '..', '..', '..', 'client', 'dist', teams[0].logo_url);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // 새 로고 경로 저장
    const logoPath = `/logos/${req.file.filename}`;
    await pool.query('UPDATE teams SET logo_url = ? WHERE id = ?', [logoPath, req.teamId]);

    res.json({
      success: true,
      message: '로고가 업로드되었습니다',
      logoUrl: logoPath
    });
  } catch (error: any) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: '로고 업로드 실패' });
  }
});

// 팀 로고 삭제
router.delete('/logo', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({ error: '팀이 없습니다' });
    }

    const teams = await pool.query('SELECT logo_url FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length > 0 && teams[0].logo_url) {
      const filePath = path.join(__dirname, '..', '..', '..', 'client', 'dist', teams[0].logo_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query('UPDATE teams SET logo_url = NULL WHERE id = ?', [req.teamId]);

    res.json({ success: true, message: '로고가 삭제되었습니다' });
  } catch (error: any) {
    console.error('Delete logo error:', error);
    res.status(500).json({ error: '로고 삭제 실패' });
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

