import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { LoanService } from '../services/loanService.js';

const router = express.Router();

// 임대 가능 선수 목록
router.get('/available', authenticateToken, async (req: any, res) => {
  try {
    const players = await LoanService.getAvailableForLoan(req.teamId);
    res.json(players);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 임대 받은 선수 목록
router.get('/incoming', authenticateToken, async (req: any, res) => {
  try {
    const loans = await LoanService.getIncomingLoans(req.teamId);
    res.json(loans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 임대 보낸 선수 목록
router.get('/outgoing', authenticateToken, async (req: any, res) => {
  try {
    const loans = await LoanService.getOutgoingLoans(req.teamId);
    res.json(loans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 임대 요청
router.post('/request', authenticateToken, async (req: any, res) => {
  try {
    const { playerCardId, loanMonths, salarySharePercent } = req.body;
    const result = await LoanService.requestLoan(req.teamId, playerCardId, loanMonths, salarySharePercent);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 임대 종료
router.post('/end/:loanId', authenticateToken, async (req: any, res) => {
  try {
    const loanId = parseInt(req.params.loanId);
    const result = await LoanService.endLoan(loanId, req.teamId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
