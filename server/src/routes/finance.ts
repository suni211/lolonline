import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 재정 개요 조회
router.get('/summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // 현재 팀 정보
    const teams = await pool.query(
      'SELECT gold, diamond, fan_count FROM teams WHERE id = ?',
      [req.teamId]
    );

    if (teams.length === 0) {
      return res.status(404).json({ error: '팀을 찾을 수 없습니다' });
    }

    const team = teams[0];

    // 스폰서 월 수입
    const sponsorIncome = await pool.query(
      `SELECT COALESCE(SUM(ts.monthly_payment), 0) as monthly_income
       FROM team_sponsors ts
       WHERE ts.team_id = ? AND ts.contract_end > NOW() AND ts.status = 'ACTIVE'`,
      [req.teamId]
    );

    // 선수 월 급여 (계약된 선수들)
    const playerSalaries = await pool.query(
      `SELECT COALESCE(SUM(salary), 0) as total_salary
       FROM player_cards
       WHERE team_id = ? AND is_contracted = true`,
      [req.teamId]
    );

    // 최근 30일 경기 수입
    const matchIncome = await pool.query(
      `SELECT COUNT(*) as match_count,
              SUM(CASE WHEN m.home_team_id = ? THEN
                CASE WHEN m.home_score > m.away_score THEN 5000 ELSE 2000 END
                ELSE
                CASE WHEN m.away_score > m.home_score THEN 5000 ELSE 2000 END
              END) as total_income
       FROM matches m
       WHERE (m.home_team_id = ? OR m.away_team_id = ?)
         AND m.status = 'FINISHED'
         AND m.finished_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [req.teamId, req.teamId, req.teamId]
    );

    // 최근 30일 스트리밍 수입
    const streamingIncome = await pool.query(
      `SELECT COALESCE(SUM(income), 0) as total_income, COUNT(*) as stream_count
       FROM streaming_history
       WHERE team_id = ? AND stream_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [req.teamId]
    );

    // 굿즈 수입 (팬 수 기반 추정)
    const merchandiseIncome = Math.floor(team.fan_count * 0.1);

    res.json({
      balance: {
        gold: team.gold,
        diamond: team.diamond
      },
      monthlyIncome: {
        sponsors: sponsorIncome[0]?.monthly_income || 0,
        matches: matchIncome[0]?.total_income || 0,
        streaming: streamingIncome[0]?.total_income || 0,
        merchandise: merchandiseIncome
      },
      monthlyExpense: {
        salaries: playerSalaries[0]?.total_salary || 0
      },
      stats: {
        matchCount: matchIncome[0]?.match_count || 0,
        streamCount: streamingIncome[0]?.stream_count || 0,
        fanCount: team.fan_count
      }
    });
  } catch (error: any) {
    console.error('Get finance summary error:', error);
    res.status(500).json({ error: '재정 정보 조회 실패' });
  }
});

// 최근 거래 내역 조회
router.get('/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // 다양한 소스에서 거래 내역 수집
    const transactions: any[] = [];

    // 1. 이적 시장 거래 (선수 계약)
    const transfers = await pool.query(
      `SELECT
        pc.id,
        'TRANSFER' as type,
        CONCAT(COALESCE(pp.name, pc.ai_player_name), ' 선수 계약') as description,
        -pc.salary as amount,
        pc.created_at as date
       FROM player_cards pc
       LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.team_id = ? AND pc.is_contracted = true
       ORDER BY pc.created_at DESC
       LIMIT 20`,
      [req.teamId]
    );
    transactions.push(...transfers.map((t: any) => ({ ...t, type: 'TRANSFER', category: 'expense' })));

    // 2. 시설 업그레이드
    const facilities = await pool.query(
      `SELECT
        tf.id,
        'FACILITY' as type,
        CONCAT(tf.facility_type, ' 시설 레벨 ', tf.level) as description,
        -(1000000 * POWER(2, tf.level - 1)) as amount,
        tf.updated_at as date
       FROM team_facilities tf
       WHERE tf.team_id = ? AND tf.level > 0
       ORDER BY tf.updated_at DESC
       LIMIT 10`,
      [req.teamId]
    );
    transactions.push(...facilities.map((f: any) => ({ ...f, category: 'expense' })));

    // 3. 경기 수입
    const matches = await pool.query(
      `SELECT
        m.id,
        'MATCH' as type,
        CONCAT(
          CASE WHEN m.home_team_id = ? THEN at.name ELSE ht.name END,
          ' 경기 ',
          CASE
            WHEN (m.home_team_id = ? AND m.home_score > m.away_score) OR
                 (m.away_team_id = ? AND m.away_score > m.home_score) THEN '승리'
            WHEN m.home_score = m.away_score THEN '무승부'
            ELSE '패배'
          END
        ) as description,
        CASE
          WHEN (m.home_team_id = ? AND m.home_score > m.away_score) OR
               (m.away_team_id = ? AND m.away_score > m.home_score) THEN 5000
          ELSE 2000
        END as amount,
        m.finished_at as date
       FROM matches m
       INNER JOIN teams ht ON m.home_team_id = ht.id
       INNER JOIN teams at ON m.away_team_id = at.id
       WHERE (m.home_team_id = ? OR m.away_team_id = ?) AND m.status = 'FINISHED'
       ORDER BY m.finished_at DESC
       LIMIT 20`,
      [req.teamId, req.teamId, req.teamId, req.teamId, req.teamId, req.teamId, req.teamId]
    );
    transactions.push(...matches.map((m: any) => ({ ...m, category: 'income' })));

    // 4. 스트리밍 수입
    const streaming = await pool.query(
      `SELECT
        sh.id,
        'STREAMING' as type,
        CONCAT(sh.player_name, ' 스트리밍 (', sh.duration_hours, '시간)') as description,
        sh.income as amount,
        sh.stream_date as date
       FROM streaming_history sh
       WHERE sh.team_id = ?
       ORDER BY sh.stream_date DESC
       LIMIT 20`,
      [req.teamId]
    );
    transactions.push(...streaming.map((s: any) => ({ ...s, category: 'income' })));

    // 5. 훈련 비용
    const training = await pool.query(
      `SELECT
        pt.id,
        'TRAINING' as type,
        CONCAT(
          COALESCE(pp.name, pc.ai_player_name),
          CASE WHEN pt.training_type = 'TEAM' THEN ' 팀 훈련' ELSE ' 개인 훈련' END
        ) as description,
        -500 as amount,
        pt.trained_at as date
       FROM player_training pt
       LEFT JOIN player_cards pc ON pt.player_id = pc.id
       LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pt.team_id = ?
       ORDER BY pt.trained_at DESC
       LIMIT 20`,
      [req.teamId]
    );
    transactions.push(...training.map((t: any) => ({ ...t, category: 'expense' })));

    // 날짜순 정렬
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(transactions.slice(0, limit));
  } catch (error: any) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: '거래 내역 조회 실패' });
  }
});

// 일별 수입/지출 그래프 데이터
router.get('/daily-stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    // 최근 N일간의 일별 통계
    const dailyStats: Record<string, { income: number; expense: number }> = {};

    // 날짜 초기화
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyStats[dateStr] = { income: 0, expense: 0 };
    }

    // 경기 수입
    const matchIncome = await pool.query(
      `SELECT
        DATE(m.finished_at) as date,
        SUM(CASE
          WHEN (m.home_team_id = ? AND m.home_score > m.away_score) OR
               (m.away_team_id = ? AND m.away_score > m.home_score) THEN 5000
          ELSE 2000
        END) as income
       FROM matches m
       WHERE (m.home_team_id = ? OR m.away_team_id = ?)
         AND m.status = 'FINISHED'
         AND m.finished_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(m.finished_at)`,
      [req.teamId, req.teamId, req.teamId, req.teamId, days]
    );

    matchIncome.forEach((row: any) => {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].income += parseInt(row.income) || 0;
      }
    });

    // 스트리밍 수입
    const streamIncome = await pool.query(
      `SELECT
        DATE(stream_date) as date,
        SUM(income) as income
       FROM streaming_history
       WHERE team_id = ? AND stream_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(stream_date)`,
      [req.teamId, days]
    );

    streamIncome.forEach((row: any) => {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].income += parseInt(row.income) || 0;
      }
    });

    // 훈련 비용
    const trainingExpense = await pool.query(
      `SELECT
        DATE(trained_at) as date,
        COUNT(*) * 500 as expense
       FROM player_training
       WHERE team_id = ? AND trained_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(trained_at)`,
      [req.teamId, days]
    );

    trainingExpense.forEach((row: any) => {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].expense += parseInt(row.expense) || 0;
      }
    });

    // 배열로 변환
    const result = Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        income: stats.income,
        expense: stats.expense,
        net: stats.income - stats.expense
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(result);
  } catch (error: any) {
    console.error('Get daily stats error:', error);
    res.status(500).json({ error: '일별 통계 조회 실패' });
  }
});

// 수입 카테고리별 분석
router.get('/income-breakdown', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // 최근 30일 카테고리별 수입
    const matchIncome = await pool.query(
      `SELECT SUM(CASE
          WHEN (m.home_team_id = ? AND m.home_score > m.away_score) OR
               (m.away_team_id = ? AND m.away_score > m.home_score) THEN 5000
          ELSE 2000
        END) as total
       FROM matches m
       WHERE (m.home_team_id = ? OR m.away_team_id = ?)
         AND m.status = 'FINISHED'
         AND m.finished_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [req.teamId, req.teamId, req.teamId, req.teamId]
    );

    const streamingIncome = await pool.query(
      `SELECT COALESCE(SUM(income), 0) as total
       FROM streaming_history
       WHERE team_id = ? AND stream_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [req.teamId]
    );

    const sponsorIncome = await pool.query(
      `SELECT COALESCE(SUM(ts.monthly_payment), 0) as total
       FROM team_sponsors ts
       WHERE ts.team_id = ? AND ts.contract_end > NOW() AND ts.status = 'ACTIVE'`,
      [req.teamId]
    );

    // 팬 굿즈 수입 (팬 수 기반)
    const fans = await pool.query(
      'SELECT fan_count FROM teams WHERE id = ?',
      [req.teamId]
    );
    const merchandiseIncome = Math.floor((fans[0]?.fan_count || 0) * 0.1);

    res.json([
      { name: '경기 수입', value: matchIncome[0]?.total || 0 },
      { name: '스트리밍', value: streamingIncome[0]?.total || 0 },
      { name: '스폰서', value: sponsorIncome[0]?.total || 0 },
      { name: '굿즈 판매', value: merchandiseIncome }
    ]);
  } catch (error: any) {
    console.error('Get income breakdown error:', error);
    res.status(500).json({ error: '수입 분석 조회 실패' });
  }
});

// 지출 카테고리별 분석
router.get('/expense-breakdown', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // 선수 급여
    const salaries = await pool.query(
      `SELECT COALESCE(SUM(salary), 0) as total
       FROM player_cards
       WHERE team_id = ? AND is_contracted = true`,
      [req.teamId]
    );

    // 훈련 비용 (최근 30일)
    const training = await pool.query(
      `SELECT COUNT(*) * 500 as total
       FROM player_training
       WHERE team_id = ? AND trained_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [req.teamId]
    );

    // 시설 업그레이드 비용은 일회성이므로 별도 표시
    const facilities = await pool.query(
      `SELECT SUM(1000000 * POWER(2, level - 1)) as total
       FROM team_facilities
       WHERE team_id = ? AND level > 0`,
      [req.teamId]
    );

    res.json([
      { name: '선수 급여', value: salaries[0]?.total || 0 },
      { name: '훈련 비용', value: training[0]?.total || 0 },
      { name: '시설 투자', value: facilities[0]?.total || 0 }
    ]);
  } catch (error: any) {
    console.error('Get expense breakdown error:', error);
    res.status(500).json({ error: '지출 분석 조회 실패' });
  }
});

export default router;
