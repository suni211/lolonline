import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { MentalService } from '../services/mentalService.js';

const router = express.Router();

// 팀 전체 멘탈 상태
router.get('/team', authenticateToken, async (req: any, res) => {
  try {
    const mental = await MentalService.getTeamMental(req.teamId);
    res.json(mental);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 선수 멘탈 상태
router.get('/player/:playerCardId', authenticateToken, async (req: any, res) => {
  try {
    const playerCardId = parseInt(req.params.playerCardId);
    const mental = await MentalService.getPlayerMental(playerCardId);
    res.json(mental);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 선수 관계 조회
router.get('/relationships/:playerCardId', authenticateToken, async (req: any, res) => {
  try {
    const playerCardId = parseInt(req.params.playerCardId);
    const relationships = await MentalService.getPlayerRelationships(playerCardId);
    res.json(relationships);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 팀 케미스트리
router.get('/chemistry', authenticateToken, async (req: any, res) => {
  try {
    const chemistry = await MentalService.calculateTeamChemistry(req.teamId);
    res.json(chemistry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 멘탈 케어
router.post('/care', authenticateToken, async (req: any, res) => {
  try {
    const { playerCardId, careType } = req.body;
    const result = await MentalService.mentalCare(req.teamId, playerCardId, careType);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
