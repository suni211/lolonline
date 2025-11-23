import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import CupService from '../services/cupService.js';

const router = express.Router();

// 현재 시즌 컵 대회 조회
router.get('/current', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const season = parseInt(req.query.season as string) || 1;
    const cup = await CupService.getCurrentSeasonCup(season);

    if (!cup) {
      return res.json(null);
    }

    res.json(cup);
  } catch (error: any) {
    console.error('Get current cup error:', error);
    res.status(500).json({ error: '컵 대회 조회에 실패했습니다' });
  }
});

// 특정 컵 대회 조회
router.get('/:cupId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const cupId = parseInt(req.params.cupId);
    const cup = await CupService.getCupTournament(cupId);

    if (!cup) {
      return res.status(404).json({ error: '컵 대회를 찾을 수 없습니다' });
    }

    res.json(cup);
  } catch (error: any) {
    console.error('Get cup error:', error);
    res.status(500).json({ error: '컵 대회 조회에 실패했습니다' });
  }
});

// 컵 경기 목록 조회
router.get('/:cupId/matches', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const cupId = parseInt(req.params.cupId);
    const round = req.query.round as string;

    let query = `
      SELECT cm.*,
             ht.name as home_team_name, at.name as away_team_name,
             wt.name as winner_name
      FROM cup_matches cm
      JOIN teams ht ON cm.home_team_id = ht.id
      JOIN teams at ON cm.away_team_id = at.id
      LEFT JOIN teams wt ON cm.winner_team_id = wt.id
      WHERE cm.cup_id = ?
    `;

    const params: any[] = [cupId];

    if (round) {
      query += ' AND cm.round = ?';
      params.push(round);
    }

    query += ' ORDER BY cm.round, cm.match_number';

    const matches = await pool.query(query, params);
    res.json(matches);
  } catch (error: any) {
    console.error('Get cup matches error:', error);
    res.status(500).json({ error: '컵 경기 조회에 실패했습니다' });
  }
});

export default router;
