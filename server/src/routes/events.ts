import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { EventService } from '../services/eventService.js';

const router = express.Router();

// 팀 이벤트 목록 조회
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId!;
    const limit = parseInt(req.query.limit as string) || 20;

    const events = await EventService.getTeamEvents(teamId, limit);
    res.json(events);
  } catch (error) {
    console.error('Failed to get team events:', error);
    res.status(500).json({ error: '이벤트 조회 실패' });
  }
});

// 읽지 않은 이벤트 수 조회
router.get('/unread-count', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId!;
    const count = await EventService.getUnreadEventCount(teamId);
    res.json({ count });
  } catch (error) {
    console.error('Failed to get unread event count:', error);
    res.status(500).json({ error: '읽지 않은 이벤트 수 조회 실패' });
  }
});

// 이벤트 읽음 처리
router.post('/mark-read', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId!;
    await EventService.markEventsAsRead(teamId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to mark events as read:', error);
    res.status(500).json({ error: '이벤트 읽음 처리 실패' });
  }
});

// 수동으로 이벤트 체크 (디버그용 또는 특정 액션 후)
router.post('/check', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId!;
    await EventService.checkAndGenerateEvents(teamId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to check events:', error);
    res.status(500).json({ error: '이벤트 체크 실패' });
  }
});

export default router;
