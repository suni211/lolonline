import pool from '../database/db.js';

export class FanService {
  // 팬 현황 조회
  static async getFanStatus(teamId: number) {
    try {
      const team = await pool.query(
        `SELECT male_fans, female_fans, fan_count, merchandise_sales FROM teams WHERE id = ?`,
        [teamId]
      );

      if (team.length === 0) {
        throw new Error('팀을 찾을 수 없습니다');
      }

      const data = team[0];

      return {
        maleFans: data.male_fans || 0,
        femaleFans: data.female_fans || 0,
        totalFans: data.fan_count || (data.male_fans + data.female_fans),
        merchandiseSales: data.merchandise_sales || 0
      };
    } catch (error) {
      console.error('Get fan status error:', error);
      throw error;
    }
  }

  // 경기 관중 수입 계산 (남성 팬 기반)
  static async calculateMatchAttendance(teamId: number, isHome: boolean) {
    try {
      const team = await pool.query(
        `SELECT male_fans, female_fans FROM teams WHERE id = ?`,
        [teamId]
      );

      if (team.length === 0) return 0;

      const maleFans = team[0].male_fans || 0;

      // 홈 경기시 더 많은 관중
      const attendanceRate = isHome ? 0.05 : 0.02;
      const baseAttendance = Math.floor(maleFans * attendanceRate);

      // 랜덤 변동 (±20%)
      const variation = 0.8 + Math.random() * 0.4;
      const attendance = Math.floor(baseAttendance * variation);

      // 티켓 가격 (5000~15000원)
      const ticketPrice = 5000 + Math.floor(Math.random() * 10000);
      const income = attendance * ticketPrice;

      return {
        attendance,
        ticketPrice,
        income
      };
    } catch (error) {
      console.error('Calculate match attendance error:', error);
      throw error;
    }
  }

  // 굿즈 수익 계산 (여성 팬 기반)
  static async calculateMerchandiseIncome(teamId: number) {
    try {
      const team = await pool.query(
        `SELECT female_fans FROM teams WHERE id = ?`,
        [teamId]
      );

      if (team.length === 0) return 0;

      const femaleFans = team[0].female_fans || 0;

      // 여성 팬의 3%가 월간 굿즈 구매
      const buyers = Math.floor(femaleFans * 0.03);

      // 평균 구매액 (10000~50000원)
      const avgPurchase = 10000 + Math.floor(Math.random() * 40000);
      const income = buyers * avgPurchase;

      return {
        buyers,
        avgPurchase,
        income
      };
    } catch (error) {
      console.error('Calculate merchandise income error:', error);
      throw error;
    }
  }

  // 월간 팬 수익 정산 (스케줄러용)
  static async processMonthlyFanRevenue() {
    try {
      const teams = await pool.query(
        `SELECT id, male_fans, female_fans FROM teams`
      );

      const results = [];

      for (const team of teams) {
        // 굿즈 수익
        const merchandiseResult = await this.calculateMerchandiseIncome(team.id);

        // 결과가 0이 아닌 경우에만 처리
        if (typeof merchandiseResult === 'object' && merchandiseResult.income > 0) {
          // 팀 골드 증가
          await pool.query(
            'UPDATE teams SET gold = gold + ?, merchandise_sales = merchandise_sales + ? WHERE id = ?',
            [merchandiseResult.income, merchandiseResult.income, team.id]
          );

          // 재정 기록
          await pool.query(
            `INSERT INTO financial_records (team_id, record_type, category, amount, description)
             VALUES (?, 'INCOME', 'MERCHANDISE', ?, ?)`,
            [team.id, merchandiseResult.income, `월간 굿즈 판매 수익 (${merchandiseResult.buyers}명 구매)`]
          );

          results.push({
            teamId: team.id,
            merchandiseIncome: merchandiseResult.income
          });
        } else {
          results.push({
            teamId: team.id,
            merchandiseIncome: 0
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Process monthly fan revenue error:', error);
      throw error;
    }
  }

  // 경기 후 팬 변동 처리
  static async processMatchFanChange(teamId: number, won: boolean, scoreDiff: number) {
    try {
      const team = await pool.query(
        `SELECT male_fans, female_fans FROM teams WHERE id = ?`,
        [teamId]
      );

      if (team.length === 0) return;

      let maleFanChange = 0;
      let femaleFanChange = 0;

      if (won) {
        // 승리시 팬 증가
        maleFanChange = Math.floor(50 + scoreDiff * 20 + Math.random() * 30);
        femaleFanChange = Math.floor(30 + scoreDiff * 15 + Math.random() * 20);
      } else {
        // 패배시 팬 감소 (적게)
        maleFanChange = -Math.floor(10 + Math.random() * 20);
        femaleFanChange = -Math.floor(5 + Math.random() * 10);
      }

      await pool.query(
        `UPDATE teams SET
          male_fans = GREATEST(0, male_fans + ?),
          female_fans = GREATEST(0, female_fans + ?),
          fan_count = GREATEST(0, fan_count + ?)
         WHERE id = ?`,
        [maleFanChange, femaleFanChange, maleFanChange + femaleFanChange, teamId]
      );

      return {
        maleFanChange,
        femaleFanChange
      };
    } catch (error) {
      console.error('Process match fan change error:', error);
      throw error;
    }
  }

  // 팬 이벤트 개최
  static async hostFanEvent(teamId: number, eventType: 'FANMEET' | 'SIGNING' | 'CONCERT') {
    try {
      const team = await pool.query(
        `SELECT gold, male_fans, female_fans FROM teams WHERE id = ?`,
        [teamId]
      );

      if (team.length === 0) {
        throw new Error('팀을 찾을 수 없습니다');
      }

      // 이벤트별 비용과 효과
      const eventConfig: Record<string, { cost: number; maleFanBonus: number; femaleFanBonus: number }> = {
        'FANMEET': { cost: 5000000, maleFanBonus: 100, femaleFanBonus: 200 },
        'SIGNING': { cost: 3000000, maleFanBonus: 150, femaleFanBonus: 100 },
        'CONCERT': { cost: 20000000, maleFanBonus: 300, femaleFanBonus: 500 }
      };

      const config = eventConfig[eventType];

      if (team[0].gold < config.cost) {
        throw new Error('골드가 부족합니다');
      }

      // 골드 차감
      await pool.query(
        'UPDATE teams SET gold = gold - ? WHERE id = ?',
        [config.cost, teamId]
      );

      // 팬 증가
      const maleFansGained = Math.floor(config.maleFanBonus * (0.8 + Math.random() * 0.4));
      const femaleFansGained = Math.floor(config.femaleFanBonus * (0.8 + Math.random() * 0.4));

      await pool.query(
        `UPDATE teams SET
          male_fans = male_fans + ?,
          female_fans = female_fans + ?,
          fan_count = fan_count + ?
         WHERE id = ?`,
        [maleFansGained, femaleFansGained, maleFansGained + femaleFansGained, teamId]
      );

      // 재정 기록
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'EXPENSE', 'EVENT', ?, ?)`,
        [teamId, config.cost, `팬 이벤트: ${eventType}`]
      );

      return {
        success: true,
        cost: config.cost,
        maleFansGained,
        femaleFansGained,
        message: `팬 이벤트 성공! 남성 팬 +${maleFansGained}, 여성 팬 +${femaleFansGained}`
      };
    } catch (error) {
      console.error('Host fan event error:', error);
      throw error;
    }
  }
}

export default FanService;
