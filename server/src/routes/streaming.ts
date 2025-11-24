import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { StreamingService } from '../services/streamingService.js';

const router = express.Router();

// 스트리밍 시작
router.post('/start', authenticateToken, async (req: any, res) => {
  try {
    const { playerCardId, durationHours } = req.body;
    const result = await StreamingService.startStream(req.teamId, playerCardId, durationHours);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 스트리밍 기록 조회
router.get('/history', authenticateToken, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const history = await StreamingService.getStreamHistory(req.teamId, limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 선수별 스트리밍 통계
router.get('/player/:playerCardId/stats', authenticateToken, async (req: any, res) => {
  try {
    const playerCardId = parseInt(req.params.playerCardId);
    const stats = await StreamingService.getPlayerStreamStats(playerCardId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 팀 스트리밍 통계
router.get('/stats', authenticateToken, async (req: any, res) => {
  try {
    const stats = await StreamingService.getTeamStreamStats(req.teamId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
