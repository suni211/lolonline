import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { FanService } from '../services/fanService.js';

const router = express.Router();

// 팬 현황 조회
router.get('/status', authenticateToken, async (req: any, res) => {
  try {
    const status = await FanService.getFanStatus(req.teamId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 팬 이벤트 개최
router.post('/event', authenticateToken, async (req: any, res) => {
  try {
    const { eventType } = req.body;
    const result = await FanService.hostFanEvent(req.teamId, eventType);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
