import pool from '../database/db.js';

export class StreamingService {
  // 스트리밍 시작
  static async startStream(teamId: number, playerCardId: number, durationHours: number = 2) {
    try {
      // 선수 확인
      const players = await pool.query(
        `SELECT pc.*, p.name, p.popularity
         FROM player_cards pc
         JOIN players p ON pc.player_id = p.id
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

      // 컨디션 확인
      if (player.condition < 30) {
        throw new Error('컨디션이 너무 낮아 스트리밍을 할 수 없습니다');
      }

      // 시청자 수 계산 (인기도 + 오버롤 기반)
      const baseViewers = player.popularity * 100;
      const overallBonus = player.overall * 50;
      const randomBonus = Math.floor(Math.random() * 5000);
      const viewers = baseViewers + overallBonus + randomBonus;

      // 수익 계산 (시청자당 100~500원)
      const incomePerViewer = 100 + Math.floor(Math.random() * 400);
      const income = viewers * incomePerViewer * durationHours;

      // 팬 증가 계산
      const maleFansGained = Math.floor(viewers * 0.01 * (0.5 + Math.random() * 0.5));
      const femaleFansGained = Math.floor(viewers * 0.015 * (0.5 + Math.random() * 0.5));

      // 컨디션 감소
      const conditionLoss = 5 + durationHours * 3;

      // 스트리밍 기록 저장
      await pool.query(
        `INSERT INTO player_streams
         (player_card_id, team_id, stream_date, duration_hours, viewers, income,
          male_fans_gained, female_fans_gained, condition_loss)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [playerCardId, teamId, today, durationHours, viewers, income,
         maleFansGained, femaleFansGained, conditionLoss]
      );

      // 팀 골드 증가
      await pool.query(
        'UPDATE teams SET gold = gold + ?, male_fans = male_fans + ?, female_fans = female_fans + ? WHERE id = ?',
        [income, maleFansGained, femaleFansGained, teamId]
      );

      // 선수 컨디션 감소
      await pool.query(
        'UPDATE player_cards SET `condition` = GREATEST(0, `condition` - ?) WHERE id = ?',
        [conditionLoss, playerCardId]
      );

      // 재정 기록
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'INCOME', 'STREAMING', ?, ?)`,
        [teamId, income, `${player.name} 스트리밍 수익 (${viewers.toLocaleString()}명 시청)`]
      );

      return {
        success: true,
        viewers,
        income,
        maleFansGained,
        femaleFansGained,
        conditionLoss,
        message: `${player.name}의 스트리밍 완료! ${viewers.toLocaleString()}명 시청, ${income.toLocaleString()} 골드 획득`
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
        `SELECT ps.*, p.name as player_name
         FROM player_streams ps
         JOIN player_cards pc ON ps.player_card_id = pc.id
         JOIN players p ON pc.player_id = p.id
         WHERE ps.team_id = ?
         ORDER BY ps.stream_date DESC, ps.created_at DESC
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
           p.name as player_name,
           COUNT(*) as stream_count,
           SUM(ps.income) as total_income,
           AVG(ps.viewers) as avg_viewers
         FROM player_streams ps
         JOIN player_cards pc ON ps.player_card_id = pc.id
         JOIN players p ON pc.player_id = p.id
         WHERE ps.team_id = ?
         GROUP BY pc.id, p.name
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
