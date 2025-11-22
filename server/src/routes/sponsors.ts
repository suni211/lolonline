import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 사용 가능한 스폰서 목록
router.get('/available', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // 팀의 현재 순위와 승리 수 가져오기
    const teamStats = await pool.query(
      `SELECT lp.rank, lp.wins
       FROM league_participants lp
       INNER JOIN leagues l ON lp.league_id = l.id
       WHERE lp.team_id = ?
       ORDER BY l.season DESC LIMIT 1`,
      [req.teamId]
    );

    const rank = teamStats.length > 0 ? teamStats[0].rank : 10;
    const wins = teamStats.length > 0 ? teamStats[0].wins : 0;

    // 조건을 만족하는 스폰서 목록
    const sponsors = await pool.query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM team_sponsors ts WHERE ts.sponsor_id = s.id AND ts.team_id = ? AND ts.status = 'ACTIVE') as already_contracted
       FROM sponsors s
       WHERE s.min_team_rank >= ? AND s.min_wins <= ?
       ORDER BY s.tier DESC, s.base_payment DESC`,
      [req.teamId, rank, wins]
    );

    res.json(sponsors);
  } catch (error: any) {
    console.error('Get available sponsors error:', error);
    res.status(500).json({ error: 'Failed to get sponsors' });
  }
});

// 내 스폰서 계약 목록
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const contracts = await pool.query(
      `SELECT ts.*, s.name, s.tier, s.description, s.logo_url
       FROM team_sponsors ts
       INNER JOIN sponsors s ON ts.sponsor_id = s.id
       WHERE ts.team_id = ? AND ts.status = 'ACTIVE'
       ORDER BY ts.monthly_payment DESC`,
      [req.teamId]
    );

    res.json(contracts);
  } catch (error: any) {
    console.error('Get my sponsors error:', error);
    res.status(500).json({ error: 'Failed to get sponsors' });
  }
});

// 스폰서 계약 체결
router.post('/:sponsorId/sign', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sponsorId } = req.params;

    // 스폰서 정보 가져오기
    const sponsors = await pool.query('SELECT * FROM sponsors WHERE id = ?', [sponsorId]);
    if (sponsors.length === 0) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    const sponsor = sponsors[0];

    // 이미 계약 중인지 확인
    const existing = await pool.query(
      `SELECT * FROM team_sponsors
       WHERE team_id = ? AND sponsor_id = ? AND status = 'ACTIVE'`,
      [req.teamId, sponsorId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already contracted with this sponsor' });
    }

    // 팀 조건 확인
    const teamStats = await pool.query(
      `SELECT lp.rank, lp.wins
       FROM league_participants lp
       INNER JOIN leagues l ON lp.league_id = l.id
       WHERE lp.team_id = ?
       ORDER BY l.season DESC LIMIT 1`,
      [req.teamId]
    );

    const rank = teamStats.length > 0 ? teamStats[0].rank : 10;
    const wins = teamStats.length > 0 ? teamStats[0].wins : 0;

    if (rank > sponsor.min_team_rank) {
      return res.status(400).json({ error: `순위 ${sponsor.min_team_rank}위 이상 필요` });
    }

    if (wins < sponsor.min_wins) {
      return res.status(400).json({ error: `${sponsor.min_wins}승 이상 필요` });
    }

    // 계약 종료일 계산
    const contractEnd = new Date();
    contractEnd.setMonth(contractEnd.getMonth() + sponsor.contract_duration_months);

    // 계약 생성
    await pool.query(
      `INSERT INTO team_sponsors (team_id, sponsor_id, monthly_payment, bonus_per_win, contract_end)
       VALUES (?, ?, ?, ?, ?)`,
      [req.teamId, sponsorId, sponsor.base_payment, sponsor.bonus_per_win, contractEnd]
    );

    // 첫 달 지급금 지급
    await pool.query(
      'UPDATE teams SET gold = gold + ? WHERE id = ?',
      [sponsor.base_payment, req.teamId]
    );

    // 재정 기록
    await pool.query(
      `INSERT INTO financial_records (team_id, record_type, category, amount, description)
       VALUES (?, 'INCOME', 'SPONSOR', ?, ?)`,
      [req.teamId, sponsor.base_payment, `${sponsor.name} 스폰서 계약금`]
    );

    res.json({
      message: `${sponsor.name}와(과) 스폰서 계약 체결!`,
      payment: sponsor.base_payment
    });
  } catch (error: any) {
    console.error('Sign sponsor error:', error);
    res.status(500).json({ error: 'Failed to sign sponsor' });
  }
});

// 스폰서 계약 해지
router.post('/:contractId/terminate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { contractId } = req.params;

    const contracts = await pool.query(
      `SELECT ts.*, s.name, s.tier FROM team_sponsors ts
       INNER JOIN sponsors s ON ts.sponsor_id = s.id
       WHERE ts.id = ? AND ts.team_id = ?`,
      [contractId, req.teamId]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = contracts[0];

    // 위약금 계산 (남은 기간에 따른 월 지급액의 50%)
    const now = new Date();
    const contractEnd = new Date(contract.contract_end);
    const remainingMonths = Math.max(0, Math.ceil((contractEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const penaltyFee = Math.floor(contract.monthly_payment * remainingMonths * 0.5);

    // 팀 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0 || teams[0].gold < penaltyFee) {
      return res.status(400).json({
        error: `위약금 ${penaltyFee.toLocaleString()} 골드가 부족합니다. (보유: ${teams[0]?.gold?.toLocaleString() || 0} 골드)`
      });
    }

    // 위약금 차감
    if (penaltyFee > 0) {
      await pool.query(
        'UPDATE teams SET gold = gold - ? WHERE id = ?',
        [penaltyFee, req.teamId]
      );

      // 재정 기록
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'EXPENSE', 'OTHER', ?, ?)`,
        [req.teamId, penaltyFee, `${contract.name} 스폰서 계약 해지 위약금`]
      );
    }

    await pool.query(
      `UPDATE team_sponsors SET status = 'TERMINATED' WHERE id = ?`,
      [contractId]
    );

    res.json({
      message: `${contract.name} 스폰서 계약 해지 완료`,
      penaltyFee,
      remainingMonths
    });
  } catch (error: any) {
    console.error('Terminate sponsor error:', error);
    res.status(500).json({ error: 'Failed to terminate contract' });
  }
});

// 위약금 조회
router.get('/:contractId/penalty', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { contractId } = req.params;

    const contracts = await pool.query(
      `SELECT ts.*, s.name FROM team_sponsors ts
       INNER JOIN sponsors s ON ts.sponsor_id = s.id
       WHERE ts.id = ? AND ts.team_id = ?`,
      [contractId, req.teamId]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = contracts[0];
    const now = new Date();
    const contractEnd = new Date(contract.contract_end);
    const remainingMonths = Math.max(0, Math.ceil((contractEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const penaltyFee = Math.floor(contract.monthly_payment * remainingMonths * 0.5);

    res.json({
      penaltyFee,
      remainingMonths,
      monthlyPayment: contract.monthly_payment
    });
  } catch (error: any) {
    console.error('Get penalty error:', error);
    res.status(500).json({ error: 'Failed to get penalty' });
  }
});

// 재정 기록 조회
router.get('/financial-history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { days = 30 } = req.query;

    const records = await pool.query(
      `SELECT * FROM financial_records
       WHERE team_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY recorded_at DESC`,
      [req.teamId, days]
    );

    // 일별 수입/지출 집계
    const dailySummary = await pool.query(
      `SELECT
        DATE(recorded_at) as date,
        SUM(CASE WHEN record_type = 'INCOME' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN record_type = 'EXPENSE' THEN amount ELSE 0 END) as expense
       FROM financial_records
       WHERE team_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(recorded_at)
       ORDER BY date ASC`,
      [req.teamId, days]
    );

    // 카테고리별 집계
    const categorySummary = await pool.query(
      `SELECT
        category,
        record_type,
        SUM(amount) as total
       FROM financial_records
       WHERE team_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY category, record_type
       ORDER BY total DESC`,
      [req.teamId, days]
    );

    res.json({
      records,
      dailySummary,
      categorySummary
    });
  } catch (error: any) {
    console.error('Get financial history error:', error);
    res.status(500).json({ error: 'Failed to get financial history' });
  }
});

export default router;
