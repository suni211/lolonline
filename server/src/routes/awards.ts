import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { AwardsService } from '../services/awardsService.js';

const router = express.Router();

// 시즌 어워드 조회
router.get('/season/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const awards = await AwardsService.getSeasonAwards(season);
    res.json(awards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 팀 어워드 이력
router.get('/team', authenticateToken, async (req: any, res) => {
  try {
    const awards = await AwardsService.getTeamAwards(req.teamId);
    res.json(awards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 선수 어워드 이력
router.get('/player/:playerCardId', authenticateToken, async (req: any, res) => {
  try {
    const playerCardId = parseInt(req.params.playerCardId);
    const awards = await AwardsService.getPlayerAwards(playerCardId);
    res.json(awards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 전체 어워드 통계
router.get('/stats', async (req, res) => {
  try {
    const stats = await AwardsService.getAwardsStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
