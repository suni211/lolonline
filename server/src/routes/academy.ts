import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { YouthAcademyService } from '../services/youthAcademyService.js';

const router = express.Router();

// 아카데미 정보 조회
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const academy = await YouthAcademyService.getAcademy(req.teamId);
    res.json(academy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 아카데미 업그레이드
router.post('/upgrade', authenticateToken, async (req: any, res) => {
  try {
    const result = await YouthAcademyService.upgradeAcademy(req.teamId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 유스 선수 스카우트
router.post('/scout', authenticateToken, async (req: any, res) => {
  try {
    const result = await YouthAcademyService.scoutYouth(req.teamId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 유스 선수 훈련
router.post('/train/:youthPlayerId', authenticateToken, async (req: any, res) => {
  try {
    const youthPlayerId = parseInt(req.params.youthPlayerId);
    const result = await YouthAcademyService.trainYouth(req.teamId, youthPlayerId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 유스 선수 1군 승격
router.post('/promote/:youthPlayerId', authenticateToken, async (req: any, res) => {
  try {
    const youthPlayerId = parseInt(req.params.youthPlayerId);
    const result = await YouthAcademyService.promoteYouth(req.teamId, youthPlayerId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 유스 선수 방출
router.delete('/release/:youthPlayerId', authenticateToken, async (req: any, res) => {
  try {
    const youthPlayerId = parseInt(req.params.youthPlayerId);
    const result = await YouthAcademyService.releaseYouth(req.teamId, youthPlayerId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
