import pool from '../database/db.js';

export class StreamingService {
  // 스트리밍 시작
  static async startStream(teamId: number, playerCardId: number, durationHours: number = 2) {
    try {
      // 선수 확인 (pro_players와 조인)
      const players = await pool.query(
        `SELECT pc.id, pc.team_id, pc.ovr,
                COALESCE(pp.name, pc.ai_player_name) as name
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.id = ? AND pc.team_id = ?`,
        [playerCardId, teamId]
      );

      if (players.length === 0) {
        throw new Error('선수를 찾을 수 없습니다');
      }

      const player = players[0];

      // 오늘 이미 스트리밍 했는지 확인
      const today = new Date().toISOString().split('T')[0];
      const existingStream = await pool.query(
        `SELECT id FROM player_streams WHERE player_card_id = ? AND stream_date = ?`,
        [playerCardId, today]
      );

      if (existingStream.length > 0) {
        throw new Error('오늘 이미 스트리밍을 했습니다');
      }

      // 팀의 민심 조회 (fan_morale: 0~100)
      const teamData = await pool.query(
        `SELECT fan_morale FROM teams WHERE id = ?`,
        [teamId]
      );

      const fanMorale = teamData[0]?.fan_morale || 50;
      const moralMultiplier = fanMorale / 100;  // 0.5 = 50%, 1.0 = 100%

      // 시청자 수 계산 (OVR 기반, 100~1000명대, 민심 반영)
      const baseViewers = 100;
      const overallBonus = (player.ovr || 70) * 3;  // OVR 70 = 210
      const randomBonus = Math.floor(Math.random() * 500);
      let viewers = Math.floor((baseViewers + overallBonus + randomBonus) * moralMultiplier);
      viewers = Math.max(10, viewers);  // 최소 10명

      // 수익 계산 (시청자당 500~2000원으로 상향)
      const incomePerViewer = 500 + Math.floor(Math.random() * 1500);
      const income = viewers * incomePerViewer * durationHours;

      // 팬 증가 계산 (민심 반영)
      const baseMaleFans = viewers * 0.002 * (0.5 + Math.random() * 0.5);
      const baseFemalesFans = viewers * 0.003 * (0.5 + Math.random() * 0.5);
      const maleFansGained = Math.floor(baseMaleFans * moralMultiplier);
      const femaleFansGained = Math.floor(baseFemalesFans * moralMultiplier);

      // 스트리밍 기록 저장
      await pool.query(
        `INSERT INTO player_streams
         (player_card_id, team_id, stream_date, duration_hours, viewers, income,
          male_fans_gained, female_fans_gained)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [playerCardId, teamId, today, durationHours, viewers, income,
         maleFansGained, femaleFansGained]
      );

      // 팀 골드 및 팬 증감
      // 민심이 낮으면 기존 팬도 떠남
      let fanLossMultiplier = 0;
      if (fanMorale < 30) {
        fanLossMultiplier = Math.floor(10000 * ((30 - fanMorale) / 100));  // 낮을수록 더 많이 떠남
      }

      const netMaleFans = maleFansGained - fanLossMultiplier;
      const netFemaleFans = femaleFansGained - fanLossMultiplier;

      await pool.query(
        'UPDATE teams SET gold = gold + ?, male_fans = GREATEST(0, male_fans + ?), female_fans = GREATEST(0, female_fans + ?) WHERE id = ?',
        [income, netMaleFans, netFemaleFans, teamId]
      );

      // 재정 기록
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'INCOME', 'OTHER', ?, ?)`,
        [teamId, income, `${player.name} 스트리밍 수익 (${viewers.toLocaleString()}명 시청)`]
      );

      let message = `${player.name}의 스트리밍 완료! ${viewers.toLocaleString()}명 시청, ${income.toLocaleString()} 골드 획득`;

      if (fanLossMultiplier > 0) {
        message += ` (⚠️ 민심 저하로 팬 ${fanLossMultiplier.toLocaleString()}명 떠남)`;
      } else if (maleFansGained + femaleFansGained > 0) {
        message += ` 👥 팬 ${(maleFansGained + femaleFansGained).toLocaleString()}명 증가`;
      }

      return {
        success: true,
        viewers,
        income,
        maleFansGained,
        femaleFansGained,
        fanLossMultiplier,
        message
      };
    } catch (error) {
      console.error('Start stream error:', error);
      throw error;
    }
  }

  // 스트리밍 기록 조회
  static async getStreamHistory(teamId: number, limit: number = 30) {
    try {
      const streams = await pool.query(
        `SELECT ps.*,
                COALESCE(pp.name, pc.ai_player_name) as player_name
         FROM player_streams ps
         JOIN player_cards pc ON ps.player_card_id = pc.id
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE ps.team_id = ?
         ORDER BY ps.stream_date DESC
         LIMIT ?`,
        [teamId, limit]
      );

      return streams;
    } catch (error) {
      console.error('Get stream history error:', error);
      throw error;
    }
  }

  // 선수별 스트리밍 통계
  static async getPlayerStreamStats(playerCardId: number) {
    try {
      const stats = await pool.query(
        `SELECT
           COUNT(*) as total_streams,
           SUM(viewers) as total_viewers,
           AVG(viewers) as avg_viewers,
           SUM(income) as total_income,
           SUM(male_fans_gained) as total_male_fans,
           SUM(female_fans_gained) as total_female_fans
         FROM player_streams
         WHERE player_card_id = ?`,
        [playerCardId]
      );

      return stats[0];
    } catch (error) {
      console.error('Get player stream stats error:', error);
      throw error;
    }
  }

  // 팀 스트리밍 통계
  static async getTeamStreamStats(teamId: number) {
    try {
      const stats = await pool.query(
        `SELECT
           COUNT(*) as total_streams,
           SUM(viewers) as total_viewers,
           AVG(viewers) as avg_viewers,
           SUM(income) as total_income,
           SUM(male_fans_gained) as total_male_fans,
           SUM(female_fans_gained) as total_female_fans
         FROM player_streams
         WHERE team_id = ?`,
        [teamId]
      );

      // 선수별 통계
      const playerStats = await pool.query(
        `SELECT
           pc.id as player_card_id,
           COALESCE(pp.name, pc.ai_player_name) as player_name,
           COUNT(*) as stream_count,
           SUM(ps.income) as total_income,
           AVG(ps.viewers) as avg_viewers
         FROM player_streams ps
         JOIN player_cards pc ON ps.player_card_id = pc.id
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE ps.team_id = ?
         GROUP BY pc.id, COALESCE(pp.name, pc.ai_player_name)
         ORDER BY total_income DESC`,
        [teamId]
      );

      return {
        overall: stats[0],
        byPlayer: playerStats
      };
    } catch (error) {
      console.error('Get team stream stats error:', error);
      throw error;
    }
  }
}

export default StreamingService;
