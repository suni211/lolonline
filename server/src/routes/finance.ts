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

    // 선수 급여 추정 (OVR 기반: OVR * 10000)
    const playerSalaries = await pool.query(
      `SELECT COALESCE(SUM(ovr * 10000), 0) as total_salary, COUNT(*) as player_count
       FROM player_cards
       WHERE team_id = ? AND is_contracted = true`,
      [req.teamId]
    );

    // 최근 30일 경기 수입
    const matchIncome = await pool.query(
      `SELECT COUNT(*) as match_count,
              SUM(CASE WHEN m.home_team_id = ? THEN
                CASE WHEN m.home_score > m.away_score THEN 5000000 ELSE 1000000 END
                ELSE
                CASE WHEN m.away_score > m.home_score THEN 5000000 ELSE 1000000 END
              END) as total_income
       FROM matches m
       WHERE (m.home_team_id = ? OR m.away_team_id = ?)
         AND m.status = 'FINISHED'
         AND m.finished_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [req.teamId, req.teamId, req.teamId]
    );

    // 스트리밍 수입 (테이블 없으면 0)
    let streamingIncome = { total_income: 0, stream_count: 0 };
    try {
      const streamRes = await pool.query(
        `SELECT COALESCE(SUM(income), 0) as total_income, COUNT(*) as stream_count
         FROM streaming_history
         WHERE team_id = ? AND stream_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [req.teamId]
      );
      streamingIncome = streamRes[0] || { total_income: 0, stream_count: 0 };
    } catch (e) {
      // streaming_history 테이블이 없는 경우
    }

    // 굿즈 수입 (팬 수 기반 추정)
    const merchandiseIncome = Math.floor((team.fan_count || 0) * 0.1);

    res.json({
      balance: {
        gold: team.gold,
        diamond: team.diamond
      },
      monthlyIncome: {
        sponsors: parseInt(sponsorIncome[0]?.monthly_income) || 0,
        matches: parseInt(matchIncome[0]?.total_income) || 0,
        streaming: streamingIncome.total_income || 0,
        merchandise: merchandiseIncome
      },
      monthlyExpense: {
        salaries: parseInt(playerSalaries[0]?.total_salary) || 0
      },
      stats: {
        matchCount: parseInt(matchIncome[0]?.match_count) || 0,
        streamCount: streamingIncome.stream_count || 0,
        fanCount: team.fan_count || 0
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

    // 1. 이적 시장 거래 (선수 계약) - OVR 기반 급여 추정
    try {
      const transfers = await pool.query(
        `SELECT
          pc.id,
          'TRANSFER' as type,
          CONCAT(COALESCE(pp.name, pc.ai_player_name), ' 선수 계약') as description,
          -(pc.ovr * 10000) as amount,
          pc.created_at as date
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ? AND pc.is_contracted = true
         ORDER BY pc.created_at DESC
         LIMIT 20`,
        [req.teamId]
      );
      transactions.push(...transfers.map((t: any) => ({ ...t, type: 'TRANSFER', category: 'expense' })));
    } catch (e) {
      // 쿼리 실패 시 무시
    }

    // 2. 시설 업그레이드
    try {
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
    } catch (e) {
      // 쿼리 실패 시 무시
    }

    // 3. 경기 수입
    try {
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
                 (m.away_team_id = ? AND m.away_score > m.home_score) THEN 5000000
            ELSE 1000000
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
    } catch (e) {
      // 쿼리 실패 시 무시
    }

    // 4. 스트리밍 수입
    try {
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
    } catch (e) {
      // streaming_history 테이블이 없는 경우
    }

    // 5. 훈련 비용
    try {
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
    } catch (e) {
      // 쿼리 실패 시 무시
    }

    // 날짜순 정렬 (null 체크)
    transactions.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

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
    try {
      const matchIncome = await pool.query(
        `SELECT
          DATE(m.finished_at) as date,
          SUM(CASE
            WHEN (m.home_team_id = ? AND m.home_score > m.away_score) OR
                 (m.away_team_id = ? AND m.away_score > m.home_score) THEN 5000000
            ELSE 1000000
          END) as income
         FROM matches m
         WHERE (m.home_team_id = ? OR m.away_team_id = ?)
           AND m.status = 'FINISHED'
           AND m.finished_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(m.finished_at)`,
        [req.teamId, req.teamId, req.teamId, req.teamId, days]
      );

      matchIncome.forEach((row: any) => {
        if (row.date) {
          const dateStr = new Date(row.date).toISOString().split('T')[0];
          if (dailyStats[dateStr]) {
            dailyStats[dateStr].income += parseInt(row.income) || 0;
          }
        }
      });
    } catch (e) {
      // 쿼리 실패 시 무시
    }

    // 스트리밍 수입
    try {
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
        if (row.date) {
          const dateStr = new Date(row.date).toISOString().split('T')[0];
          if (dailyStats[dateStr]) {
            dailyStats[dateStr].income += parseInt(row.income) || 0;
          }
        }
      });
    } catch (e) {
      // streaming_history 테이블이 없는 경우
    }

    // 훈련 비용
    try {
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
        if (row.date) {
          const dateStr = new Date(row.date).toISOString().split('T')[0];
          if (dailyStats[dateStr]) {
            dailyStats[dateStr].expense += parseInt(row.expense) || 0;
          }
        }
      });
    } catch (e) {
      // 쿼리 실패 시 무시
    }

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
    let matchTotal = 0;
    let streamingTotal = 0;
    let sponsorTotal = 0;

    try {
      const matchIncome = await pool.query(
        `SELECT SUM(CASE
            WHEN (m.home_team_id = ? AND m.home_score > m.away_score) OR
                 (m.away_team_id = ? AND m.away_score > m.home_score) THEN 5000000
            ELSE 1000000
          END) as total
         FROM matches m
         WHERE (m.home_team_id = ? OR m.away_team_id = ?)
           AND m.status = 'FINISHED'
           AND m.finished_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [req.teamId, req.teamId, req.teamId, req.teamId]
      );
      matchTotal = parseInt(matchIncome[0]?.total) || 0;
    } catch (e) {}

    try {
      const streamingIncome = await pool.query(
        `SELECT COALESCE(SUM(income), 0) as total
         FROM streaming_history
         WHERE team_id = ? AND stream_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [req.teamId]
      );
      streamingTotal = parseInt(streamingIncome[0]?.total) || 0;
    } catch (e) {}

    try {
      const sponsorIncome = await pool.query(
        `SELECT COALESCE(SUM(ts.monthly_payment), 0) as total
         FROM team_sponsors ts
         WHERE ts.team_id = ? AND ts.contract_end > NOW() AND ts.status = 'ACTIVE'`,
        [req.teamId]
      );
      sponsorTotal = parseInt(sponsorIncome[0]?.total) || 0;
    } catch (e) {}

    // 팬 굿즈 수입 (팬 수 기반)
    const fans = await pool.query(
      'SELECT fan_count FROM teams WHERE id = ?',
      [req.teamId]
    );
    const merchandiseIncome = Math.floor((fans[0]?.fan_count || 0) * 0.1);

    res.json([
      { name: '경기 수입', value: matchTotal },
      { name: '스트리밍', value: streamingTotal },
      { name: '스폰서', value: sponsorTotal },
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
    let salaryTotal = 0;
    let trainingTotal = 0;
    let facilityTotal = 0;

    // 선수 급여 (OVR 기반 추정)
    try {
      const salaries = await pool.query(
        `SELECT COALESCE(SUM(ovr * 10000), 0) as total
         FROM player_cards
         WHERE team_id = ? AND is_contracted = true`,
        [req.teamId]
      );
      salaryTotal = parseInt(salaries[0]?.total) || 0;
    } catch (e) {}

    // 훈련 비용 (최근 30일)
    try {
      const training = await pool.query(
        `SELECT COUNT(*) * 500 as total
         FROM player_training
         WHERE team_id = ? AND trained_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [req.teamId]
      );
      trainingTotal = parseInt(training[0]?.total) || 0;
    } catch (e) {}

    // 시설 업그레이드 비용
    try {
      const facilities = await pool.query(
        `SELECT SUM(1000000 * POWER(2, level - 1)) as total
         FROM team_facilities
         WHERE team_id = ? AND level > 0`,
        [req.teamId]
      );
      facilityTotal = parseInt(facilities[0]?.total) || 0;
    } catch (e) {}

    res.json([
      { name: '선수 급여', value: salaryTotal },
      { name: '훈련 비용', value: trainingTotal },
      { name: '시설 투자', value: facilityTotal }
    ]);
  } catch (error: any) {
    console.error('Get expense breakdown error:', error);
    res.status(500).json({ error: '지출 분석 조회 실패' });
  }
});

export default router;
