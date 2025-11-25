import express, { Request, Response } from 'express';
import RhythmGameService from '../services/rhythmGameService.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// 곡 목록 조회
router.get('/songs', async (req: Request, res: Response) => {
  try {
    const { difficulty } = req.query;
    const songs = await RhythmGameService.getSongs(difficulty as string);
    res.json({ success: true, songs });
  } catch (error) {
    console.error('Get songs error:', error);
    res.status(500).json({ success: false, error: (error as any).message });
  }
});

// 곡 상세 정보 + 악보 조회
router.get('/songs/:songId', async (req: Request, res: Response) => {
  try {
    const songId = parseInt(req.params.songId);
    const data = await RhythmGameService.getSongWithCharts(songId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get song error:', error);
    res.status(500).json({ success: false, error: (error as any).message });
  }
});

// 악보의 노트 조회
router.get('/charts/:chartId/notes', async (req: Request, res: Response) => {
  try {
    const chartId = parseInt(req.params.chartId);
    const notes = await RhythmGameService.getChartNotes(chartId);
    res.json({ success: true, notes });
  } catch (error) {
    console.error('Get chart notes error:', error);
    res.status(500).json({ success: false, error: (error as any).message });
  }
});

// 리듬게임 플레이 결과 제출
router.post('/submit', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { teamId, playerCardId, chartId, judgments, maxCombo, score, accuracy } = req.body;

    if (!teamId || !chartId || !judgments || score === undefined || accuracy === undefined) {
      return res.status(400).json({ success: false, error: '필수 정보가 없습니다' });
    }

    const result = await RhythmGameService.submitRecord(
      teamId,
      playerCardId,
      chartId,
      judgments,
      maxCombo,
      score,
      accuracy
    );

    res.json(result);
  } catch (error) {
    console.error('Submit record error:', error);
    res.status(500).json({ success: false, error: (error as any).message });
  }
});

// 팀 플레이 기록 조회
router.get('/records/:teamId', async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const records = await RhythmGameService.getRecords(teamId, limit);
    res.json({ success: true, records });
  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ success: false, error: (error as any).message });
  }
});

// 팀 리듬게임 통계
router.get('/stats/:teamId', async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const stats = await RhythmGameService.getTeamStats(teamId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Get team stats error:', error);
    res.status(500).json({ success: false, error: (error as any).message });
  }
});

// 악보 생성 (관리자용)
router.post('/charts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { songId, difficulty, notes } = req.body;
    const creatorId = (req as any).user.id;

    if (!songId || !difficulty || !notes || !Array.isArray(notes)) {
      return res.status(400).json({ success: false, error: '필수 정보가 없습니다' });
    }

    const result = await RhythmGameService.createChart(
      songId,
      difficulty,
      creatorId,
      notes
    );

    res.json(result);
  } catch (error) {
    console.error('Create chart error:', error);
    res.status(500).json({ success: false, error: (error as any).message });
  }
});

// 악보 삭제 (관리자용)
router.delete('/charts/:chartId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const chartId = parseInt(req.params.chartId);
    const result = await RhythmGameService.deleteChart(chartId);
    res.json(result);
  } catch (error) {
    console.error('Delete chart error:', error);
    res.status(500).json({ success: false, error: (error as any).message });
  }
});

export default router;
