import pool from '../database/db.js';

export class AwardsService {
  // 시즌 어워드 계산 및 생성
  static async calculateSeasonAwards(season: number) {
    try {
      const awards = [];

      // 1. MVP - 가장 높은 승리 기여도
      const mvp = await pool.query(
        `SELECT pc.id as player_card_id, pc.team_id, p.name,
                (pc.overall * 0.3 + COALESCE(ms.total_kills, 0) * 0.2 +
                 COALESCE(ms.total_assists, 0) * 0.3 - COALESCE(ms.total_deaths, 0) * 0.1) as mvp_score
         FROM player_cards pc
         JOIN players p ON pc.player_id = p.id
         LEFT JOIN (
           SELECT player_card_id,
                  SUM(kills) as total_kills,
                  SUM(deaths) as total_deaths,
                  SUM(assists) as total_assists
           FROM match_player_stats
           GROUP BY player_card_id
         ) ms ON pc.id = ms.player_card_id
         WHERE pc.team_id IS NOT NULL
         ORDER BY mvp_score DESC
         LIMIT 1`
      );

      if (mvp.length > 0) {
        await this.createAward(season, 'MVP', mvp[0].player_card_id, mvp[0].team_id,
          Math.floor(mvp[0].mvp_score), 50000000);
        awards.push({ type: 'MVP', player: mvp[0].name });
      }

      // 2. ROOKIE - 가장 어린 선수 중 높은 성적
      const rookie = await pool.query(
        `SELECT pc.id as player_card_id, pc.team_id, p.name, p.age, pc.overall
         FROM player_cards pc
         JOIN players p ON pc.player_id = p.id
         WHERE pc.team_id IS NOT NULL AND p.age <= 19
         ORDER BY pc.overall DESC
         LIMIT 1`
      );

      if (rookie.length > 0) {
        await this.createAward(season, 'ROOKIE', rookie[0].player_card_id, rookie[0].team_id,
          rookie[0].overall, 20000000);
        awards.push({ type: 'ROOKIE', player: rookie[0].name });
      }

      // 3. TOP_SCORER - 가장 많은 킬
      const topScorer = await pool.query(
        `SELECT pc.id as player_card_id, pc.team_id, p.name, SUM(mps.kills) as total_kills
         FROM player_cards pc
         JOIN players p ON pc.player_id = p.id
         JOIN match_player_stats mps ON pc.id = mps.player_card_id
         WHERE pc.team_id IS NOT NULL
         GROUP BY pc.id, pc.team_id, p.name
         ORDER BY total_kills DESC
         LIMIT 1`
      );

      if (topScorer.length > 0) {
        await this.createAward(season, 'TOP_SCORER', topScorer[0].player_card_id, topScorer[0].team_id,
          topScorer[0].total_kills, 30000000);
        awards.push({ type: 'TOP_SCORER', player: topScorer[0].name, kills: topScorer[0].total_kills });
      }

      // 4. ASSIST_KING - 가장 많은 어시스트
      const assistKing = await pool.query(
        `SELECT pc.id as player_card_id, pc.team_id, p.name, SUM(mps.assists) as total_assists
         FROM player_cards pc
         JOIN players p ON pc.player_id = p.id
         JOIN match_player_stats mps ON pc.id = mps.player_card_id
         WHERE pc.team_id IS NOT NULL
         GROUP BY pc.id, pc.team_id, p.name
         ORDER BY total_assists DESC
         LIMIT 1`
      );

      if (assistKing.length > 0) {
        await this.createAward(season, 'ASSIST_KING', assistKing[0].player_card_id, assistKing[0].team_id,
          assistKing[0].total_assists, 25000000);
        awards.push({ type: 'ASSIST_KING', player: assistKing[0].name, assists: assistKing[0].total_assists });
      }

      // 5. BEST_SUPPORT - 서포터 중 가장 높은 성적
      const bestSupport = await pool.query(
        `SELECT pc.id as player_card_id, pc.team_id, p.name, pc.overall,
                (COALESCE(SUM(mps.assists), 0) - COALESCE(SUM(mps.deaths), 0)) as support_score
         FROM player_cards pc
         JOIN players p ON pc.player_id = p.id
         LEFT JOIN match_player_stats mps ON pc.id = mps.player_card_id
         WHERE pc.team_id IS NOT NULL AND pc.position = 'SUPPORT'
         GROUP BY pc.id, pc.team_id, p.name, pc.overall
         ORDER BY support_score DESC, pc.overall DESC
         LIMIT 1`
      );

      if (bestSupport.length > 0) {
        await this.createAward(season, 'BEST_SUPPORT', bestSupport[0].player_card_id, bestSupport[0].team_id,
          bestSupport[0].support_score || bestSupport[0].overall, 20000000);
        awards.push({ type: 'BEST_SUPPORT', player: bestSupport[0].name });
      }

      // 6. BEST_JUNGLER - 정글러 중 가장 높은 성적
      const bestJungler = await pool.query(
        `SELECT pc.id as player_card_id, pc.team_id, p.name, pc.overall,
                (COALESCE(SUM(mps.kills), 0) + COALESCE(SUM(mps.assists), 0)) as jungle_score
         FROM player_cards pc
         JOIN players p ON pc.player_id = p.id
         LEFT JOIN match_player_stats mps ON pc.id = mps.player_card_id
         WHERE pc.team_id IS NOT NULL AND pc.position = 'JUNGLE'
         GROUP BY pc.id, pc.team_id, p.name, pc.overall
         ORDER BY jungle_score DESC, pc.overall DESC
         LIMIT 1`
      );

      if (bestJungler.length > 0) {
        await this.createAward(season, 'BEST_JUNGLER', bestJungler[0].player_card_id, bestJungler[0].team_id,
          bestJungler[0].jungle_score || bestJungler[0].overall, 20000000);
        awards.push({ type: 'BEST_JUNGLER', player: bestJungler[0].name });
      }

      return awards;
    } catch (error) {
      console.error('Calculate season awards error:', error);
      throw error;
    }
  }

  // 어워드 생성
  private static async createAward(
    season: number,
    awardType: string,
    playerCardId: number,
    teamId: number,
    statsValue: number,
    prizeGold: number
  ) {
    try {
      await pool.query(
        `INSERT INTO season_awards (season, award_type, player_card_id, team_id, stats_value, prize_gold)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE player_card_id = ?, team_id = ?, stats_value = ?, prize_gold = ?`,
        [season, awardType, playerCardId, teamId, statsValue, prizeGold,
         playerCardId, teamId, statsValue, prizeGold]
      );

      // 상금 지급
      await pool.query(
        'UPDATE teams SET gold = gold + ? WHERE id = ?',
        [prizeGold, teamId]
      );

      // 재정 기록
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'INCOME', 'PRIZE', ?, ?)`,
        [teamId, prizeGold, `시즌 ${season} ${awardType} 상금`]
      );
    } catch (error) {
      console.error('Create award error:', error);
      throw error;
    }
  }

  // 시즌 어워드 조회
  static async getSeasonAwards(season: number) {
    try {
      const awards = await pool.query(
        `SELECT sa.*, p.name as player_name, t.name as team_name
         FROM season_awards sa
         JOIN player_cards pc ON sa.player_card_id = pc.id
         JOIN players p ON pc.player_id = p.id
         JOIN teams t ON sa.team_id = t.id
         WHERE sa.season = ?
         ORDER BY sa.prize_gold DESC`,
        [season]
      );

      return awards;
    } catch (error) {
      console.error('Get season awards error:', error);
      throw error;
    }
  }

  // 선수 어워드 이력 조회
  static async getPlayerAwards(playerCardId: number) {
    try {
      const awards = await pool.query(
        `SELECT sa.*, t.name as team_name
         FROM season_awards sa
         JOIN teams t ON sa.team_id = t.id
         WHERE sa.player_card_id = ?
         ORDER BY sa.season DESC`,
        [playerCardId]
      );

      return awards;
    } catch (error) {
      console.error('Get player awards error:', error);
      throw error;
    }
  }

  // 팀 어워드 이력 조회
  static async getTeamAwards(teamId: number) {
    try {
      const awards = await pool.query(
        `SELECT sa.*, p.name as player_name
         FROM season_awards sa
         JOIN player_cards pc ON sa.player_card_id = pc.id
         JOIN players p ON pc.player_id = p.id
         WHERE sa.team_id = ?
         ORDER BY sa.season DESC, sa.prize_gold DESC`,
        [teamId]
      );

      return awards;
    } catch (error) {
      console.error('Get team awards error:', error);
      throw error;
    }
  }

  // 전체 어워드 통계
  static async getAwardsStats() {
    try {
      // 팀별 어워드 수
      const teamStats = await pool.query(
        `SELECT t.id, t.name, COUNT(*) as award_count, SUM(sa.prize_gold) as total_prize
         FROM season_awards sa
         JOIN teams t ON sa.team_id = t.id
         GROUP BY t.id, t.name
         ORDER BY award_count DESC`
      );

      // 선수별 어워드 수
      const playerStats = await pool.query(
        `SELECT p.name, COUNT(*) as award_count, SUM(sa.prize_gold) as total_prize
         FROM season_awards sa
         JOIN player_cards pc ON sa.player_card_id = pc.id
         JOIN players p ON pc.player_id = p.id
         GROUP BY p.name
         ORDER BY award_count DESC
         LIMIT 10`
      );

      return { teamStats, playerStats };
    } catch (error) {
      console.error('Get awards stats error:', error);
      throw error;
    }
  }
}

export default AwardsService;
