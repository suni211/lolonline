import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { InterviewService } from '../services/interviewService.js';

const router = express.Router();

// 미해결 면담 목록 조회
router.get('/pending', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const interviews = await InterviewService.getPendingInterviews(req.teamId!);
    res.json(interviews);
  } catch (error: any) {
    console.error('Get pending interviews error:', error);
    res.status(500).json({ error: '면담 목록 조회 실패' });
  }
});

// 면담 히스토리 조회
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await InterviewService.getInterviewHistory(req.teamId!, limit);
    res.json(history);
  } catch (error: any) {
    console.error('Get interview history error:', error);
    res.status(500).json({ error: '면담 히스토리 조회 실패' });
  }
});

// 면담 생성 (테스트용)
router.post('/generate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { playerCardId, triggerReason } = req.body;

    if (!playerCardId || !triggerReason) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다' });
    }

    const interviewId = await InterviewService.generateInterview(
      req.teamId!,
      playerCardId,
      triggerReason
    );

    res.json({
      success: true,
      interviewId,
      message: '면담이 생성되었습니다'
    });
  } catch (error: any) {
    console.error('Generate interview error:', error);
    res.status(500).json({ error: error.message || '면담 생성 실패' });
  }
});

// 면담 응답 처리
router.post('/:interviewId/respond', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const interviewId = parseInt(req.params.interviewId);
    const { selectedOption } = req.body;

    if (typeof selectedOption !== 'number') {
      return res.status(400).json({ error: '선택한 옵션이 필요합니다' });
    }

    const result = await InterviewService.respondToInterview(interviewId, selectedOption);

    res.json(result);
  } catch (error: any) {
    console.error('Respond to interview error:', error);
    res.status(500).json({ error: error.message || '면담 응답 처리 실패' });
  }
});

export default router;
