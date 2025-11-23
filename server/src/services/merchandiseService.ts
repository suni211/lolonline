import pool from '../database/db.js';
import cron from 'node-cron';

// 굿즈 판매 시스템 초기화
export function initializeMerchandiseSystem() {
  // 매일 자정에 굿즈 수익 계산
  cron.schedule('0 0 * * *', async () => {
    await calculateDailyMerchandiseSales();
  });

  console.log('Merchandise sales system initialized');
}

// 일일 굿즈 판매 계산
async function calculateDailyMerchandiseSales() {
  try {
    // 모든 팀 조회
    const teams = await pool.query(
      `SELECT t.id, t.fan_count, t.fan_morale, t.merchandise_rate,
              tf.level as merchandise_level
       FROM teams t
       LEFT JOIN team_facilities tf ON t.id = tf.team_id AND tf.facility_type = 'MERCHANDISE'
       WHERE t.user_id IS NOT NULL`
    );

    for (const team of teams) {
      const merchandiseLevel = team.merchandise_level || 0;

      if (merchandiseLevel === 0) {
        continue; // 굿즈샵 없으면 스킵
      }

      // 판매량 계산
      // 기본: 팬수의 0.1~0.5%가 구매
      // 굿즈샵 레벨당 10% 증가
      // 민심에 따라 50~150% 보정
      const basePurchaseRate = 0.001 + Math.random() * 0.004; // 0.1~0.5%
      const levelBonus = 1 + (merchandiseLevel * 0.1);
      const moraleMultiplier = 0.5 + (team.fan_morale / 100);

      const unitsSold = Math.floor(
        team.fan_count * basePurchaseRate * levelBonus * moraleMultiplier * (team.merchandise_rate || 1)
      );

      // 수익 계산 (단가: 레벨당 1000원씩 증가, 기본 5000원)
      const pricePerUnit = 5000 + (merchandiseLevel * 1000);
      const revenue = unitsSold * pricePerUnit;

      if (revenue > 0) {
        // 팀 골드 증가
        await pool.query(
          'UPDATE teams SET gold = gold + ?, merchandise_revenue = merchandise_revenue + ? WHERE id = ?',
          [revenue, revenue, team.id]
        );

        // 판매 기록 저장
        await pool.query(
          `INSERT INTO merchandise_sales (team_id, sale_date, units_sold, revenue, fan_count_at_time, merchandise_level)
           VALUES (?, CURDATE(), ?, ?, ?, ?)`,
          [team.id, unitsSold, revenue, team.fan_count, merchandiseLevel]
        );

        // 재정 기록
        await pool.query(
          `INSERT INTO financial_records (team_id, record_type, category, amount, description)
           VALUES (?, 'INCOME', 'OTHER', ?, ?)`,
          [team.id, revenue, `굿즈 판매 수익 (${unitsSold}개)`]
        );
      }
    }

    console.log(`Daily merchandise sales calculated for ${teams.length} teams`);
  } catch (error) {
    console.error('Error calculating merchandise sales:', error);
  }
}

// 팀 굿즈 통계 조회
export async function getTeamMerchandiseStats(teamId: number) {
  try {
    // 최근 30일 판매 기록
    const sales = await pool.query(
      `SELECT sale_date, units_sold, revenue
       FROM merchandise_sales
       WHERE team_id = ?
       ORDER BY sale_date DESC
       LIMIT 30`,
      [teamId]
    );

    // 총 수익
    const totalRevenue = await pool.query(
      'SELECT merchandise_revenue FROM teams WHERE id = ?',
      [teamId]
    );

    // 이번 달 수익
    const monthlyRevenue = await pool.query(
      `SELECT SUM(revenue) as total
       FROM merchandise_sales
       WHERE team_id = ? AND MONTH(sale_date) = MONTH(CURDATE()) AND YEAR(sale_date) = YEAR(CURDATE())`,
      [teamId]
    );

    return {
      recentSales: sales,
      totalRevenue: totalRevenue[0]?.merchandise_revenue || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0
    };
  } catch (error) {
    console.error('Error getting merchandise stats:', error);
    return null;
  }
}

export default {
  initializeMerchandiseSystem,
  getTeamMerchandiseStats
};
