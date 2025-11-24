import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 뉴스 목록 조회
router.get('/', async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'WHERE is_published = true';
    const params: any[] = [];

    if (type && type !== 'all') {
      whereClause += ' AND news_type = ?';
      params.push(type);
    }

    // 전체 개수
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM news ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // 뉴스 목록
    const news = await pool.query(
      `SELECT n.*,
              t.name as team_name,
              pp.name as player_name,
              st.name as source_team_name,
              tt.name as target_team_name
       FROM news n
       LEFT JOIN teams t ON n.team_id = t.id
       LEFT JOIN pro_players pp ON n.player_id = pp.id
       LEFT JOIN teams st ON n.source_team_id = st.id
       LEFT JOIN teams tt ON n.target_team_id = tt.id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({
      news,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error: any) {
    console.error('Get news error:', error);
    res.status(500).json({ error: '뉴스 조회 실패' });
  }
});

// 특정 뉴스 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const newsId = parseInt(req.params.id);

    const news = await pool.query(
      `SELECT n.*,
              t.name as team_name,
              pp.name as player_name,
              st.name as source_team_name,
              tt.name as target_team_name
       FROM news n
       LEFT JOIN teams t ON n.team_id = t.id
       LEFT JOIN pro_players pp ON n.player_id = pp.id
       LEFT JOIN teams st ON n.source_team_id = st.id
       LEFT JOIN teams tt ON n.target_team_id = tt.id
       WHERE n.id = ?`,
      [newsId]
    );

    if (news.length === 0) {
      return res.status(404).json({ error: '뉴스를 찾을 수 없습니다' });
    }

    res.json(news[0]);
  } catch (error: any) {
    console.error('Get news detail error:', error);
    res.status(500).json({ error: '뉴스 상세 조회 실패' });
  }
});

// 팀 관련 뉴스 조회
router.get('/team/:teamId', async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const { limit = 10 } = req.query;

    const news = await pool.query(
      `SELECT n.*,
              t.name as team_name,
              pp.name as player_name
       FROM news n
       LEFT JOIN teams t ON n.team_id = t.id
       LEFT JOIN pro_players pp ON n.player_id = pp.id
       WHERE n.is_published = true
         AND (n.team_id = ? OR n.source_team_id = ? OR n.target_team_id = ?)
       ORDER BY n.created_at DESC
       LIMIT ?`,
      [teamId, teamId, teamId, Number(limit)]
    );

    res.json(news);
  } catch (error: any) {
    console.error('Get team news error:', error);
    res.status(500).json({ error: '팀 뉴스 조회 실패' });
  }
});

// 이적 루머 목록
router.get('/transfer/rumors', async (req, res) => {
  try {
    const news = await pool.query(
      `SELECT n.*,
              pp.name as player_name,
              st.name as source_team_name,
              tt.name as target_team_name
       FROM news n
       LEFT JOIN pro_players pp ON n.player_id = pp.id
       LEFT JOIN teams st ON n.source_team_id = st.id
       LEFT JOIN teams tt ON n.target_team_id = tt.id
       WHERE n.news_type = 'TRANSFER_RUMOR' AND n.is_published = true
       ORDER BY n.credibility DESC, n.created_at DESC
       LIMIT 20`
    );

    res.json(news);
  } catch (error: any) {
    console.error('Get transfer rumors error:', error);
    res.status(500).json({ error: '이적 루머 조회 실패' });
  }
});

// 최신 뉴스 (대시보드용)
router.get('/latest/summary', async (req, res) => {
  try {
    const news = await pool.query(
      `SELECT n.id, n.news_type, n.title, n.created_at,
              t.name as team_name
       FROM news n
       LEFT JOIN teams t ON n.team_id = t.id
       WHERE n.is_published = true
       ORDER BY n.created_at DESC
       LIMIT 5`
    );

    res.json(news);
  } catch (error: any) {
    console.error('Get latest news error:', error);
    res.status(500).json({ error: '최신 뉴스 조회 실패' });
  }
});

export default router;
