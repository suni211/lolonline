import pool from '../database/db.js';

// 리그별 우승 상금
const LEAGUE_PRIZES: { [key: string]: number } = {
  'SUPER': 500000000,   // 1부 우승: 5억
  'FIRST': 250000000,   // 2부 우승: 2억 5천만
  'SECOND': 100000000   // 3부 우승: 1억
};

export class PlayoffService {
  // 플레이오프 생성 (정규 시즌 종료 후)
  static async createPlayoff(leagueId: number) {
    try {
      // 리그 정보 조회
      const leagues = await pool.query(
        'SELECT * FROM leagues WHERE id = ?',
        [leagueId]
      );

      if (leagues.length === 0) {
        throw new Error('League not found');
      }

      const league = leagues[0];

      // 플레이오프 생성
      const playoffResult = await pool.query(
        `INSERT INTO playoffs (league_id, season, status)
         VALUES (?, ?, 'QUARTER')`,
        [leagueId, league.season]
      );

      const playoffId = playoffResult.insertId;

      // 상위 8팀 조회
      const topTeams = await pool.query(
        `SELECT team_id FROM league_participants
         WHERE league_id = ?
         ORDER BY points DESC, goal_difference DESC
         LIMIT 8`,
        [leagueId]
      );

      if (topTeams.length < 8) {
        console.log('Not enough teams for playoff');
        return null;
      }

      // 8강 대진표 생성 (1위 vs 8위, 2위 vs 7위, ...)
      const matches = [
        { home: topTeams[0].team_id, away: topTeams[7].team_id },
        { home: topTeams[1].team_id, away: topTeams[6].team_id },
        { home: topTeams[2].team_id, away: topTeams[5].team_id },
        { home: topTeams[3].team_id, away: topTeams[4].team_id }
      ];

      // 다음 토요일 찾기
      const nextSaturday = this.getNextSaturday(new Date());
      let matchTime = new Date(nextSaturday);
      matchTime.setUTCHours(8, 0, 0, 0); // 17:00 KST

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];

        const year = matchTime.getFullYear();
        const month = String(matchTime.getMonth() + 1).padStart(2, '0');
        const day = String(matchTime.getDate()).padStart(2, '0');
        const hours = String(matchTime.getHours()).padStart(2, '0');
        const minutes = String(matchTime.getMinutes()).padStart(2, '0');
        const seconds = String(matchTime.getSeconds()).padStart(2, '0');
        const scheduledAtStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        await pool.query(
          `INSERT INTO playoff_matches (playoff_id, round, match_number, home_team_id, away_team_id, scheduled_at, status)
           VALUES (?, 'QUARTER', ?, ?, ?, ?, 'SCHEDULED')`,
          [playoffId, i + 1, match.home, match.away, scheduledAtStr]
        );

        matchTime = new Date(matchTime.getTime() + 60 * 60 * 1000); // 1시간 간격
      }

      console.log(`Playoff created for league ${leagueId}, season ${league.season}`);
      return playoffId;

    } catch (error) {
      console.error('Failed to create playoff:', error);
      throw error;
    }
  }

  // 다음 라운드 생성
  static async generateNextRound(playoffId: number) {
    try {
      const playoffs = await pool.query(
        'SELECT * FROM playoffs WHERE id = ?',
        [playoffId]
      );

      if (playoffs.length === 0) {
        throw new Error('Playoff not found');
      }

      const playoff = playoffs[0];
      let currentRound = playoff.status;
      let nextRound: string;

      switch (currentRound) {
        case 'QUARTER':
          nextRound = 'SEMI';
          break;
        case 'SEMI':
          nextRound = 'FINAL';
          break;
        default:
          throw new Error('Playoff is already completed');
      }

      // 이전 라운드 승자 조회
      const winners = await pool.query(
        `SELECT winner_team_id FROM playoff_matches
         WHERE playoff_id = ? AND round = ? AND status = 'COMPLETED'
         ORDER BY match_number`,
        [playoffId, currentRound]
      );

      const winnerIds = winners.map((w: any) => w.winner_team_id);

      // 대진표 생성
      const matches: { home: number; away: number }[] = [];
      for (let i = 0; i < winnerIds.length; i += 2) {
        if (i + 1 < winnerIds.length) {
          matches.push({
            home: winnerIds[i],
            away: winnerIds[i + 1]
          });
        }
      }

      // 다음 토요일
      const nextSaturday = this.getNextSaturday(new Date());
      let matchTime = new Date(nextSaturday);
      matchTime.setUTCHours(8, 0, 0, 0);

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];

        const year = matchTime.getFullYear();
        const month = String(matchTime.getMonth() + 1).padStart(2, '0');
        const day = String(matchTime.getDate()).padStart(2, '0');
        const hours = String(matchTime.getHours()).padStart(2, '0');
        const minutes = String(matchTime.getMinutes()).padStart(2, '0');
        const seconds = String(matchTime.getSeconds()).padStart(2, '0');
        const scheduledAtStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        await pool.query(
          `INSERT INTO playoff_matches (playoff_id, round, match_number, home_team_id, away_team_id, scheduled_at, status)
           VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED')`,
          [playoffId, nextRound, i + 1, match.home, match.away, scheduledAtStr]
        );

        matchTime = new Date(matchTime.getTime() + 60 * 60 * 1000);
      }

      await pool.query(
        'UPDATE playoffs SET status = ? WHERE id = ?',
        [nextRound, playoffId]
      );

      return matches.length;

    } catch (error) {
      console.error('Failed to generate next playoff round:', error);
      throw error;
    }
  }

  // 플레이오프 경기 결과 처리
  static async processPlayoffMatchResult(matchId: number, homeScore: number, awayScore: number) {
    try {
      const matches = await pool.query(
        `SELECT pm.*, p.league_id, l.region
         FROM playoff_matches pm
         JOIN playoffs p ON pm.playoff_id = p.id
         JOIN leagues l ON p.league_id = l.id
         WHERE pm.id = ?`,
        [matchId]
      );

      if (matches.length === 0) {
        throw new Error('Match not found');
      }

      const match = matches[0];
      const winnerId = homeScore > awayScore ? match.home_team_id : match.away_team_id;

      await pool.query(
        `UPDATE playoff_matches
         SET home_score = ?, away_score = ?, winner_team_id = ?, status = 'COMPLETED'
         WHERE id = ?`,
        [homeScore, awayScore, winnerId, matchId]
      );

      // 결승전이면 우승팀에게 상금 지급
      if (match.round === 'FINAL') {
        await pool.query(
          'UPDATE playoffs SET status = ? WHERE id = ?',
          ['COMPLETED', match.playoff_id]
        );

        // 리그별 상금 지급
        const prize = LEAGUE_PRIZES[match.region] || 100000000;
        await pool.query(
          'UPDATE teams SET gold = gold + ? WHERE id = ?',
          [prize, winnerId]
        );

        console.log(`Playoff champion: Team ${winnerId}, Prize: ${prize.toLocaleString()} gold`);
      }

      return winnerId;

    } catch (error) {
      console.error('Failed to process playoff match result:', error);
      throw error;
    }
  }

  // 다음 토요일 찾기
  static getNextSaturday(date: Date): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntilSaturday);
    return result;
  }

  // 플레이오프 정보 조회
  static async getPlayoff(playoffId: number) {
    try {
      const playoffs = await pool.query(
        `SELECT p.*, l.name as league_name, l.region
         FROM playoffs p
         JOIN leagues l ON p.league_id = l.id
         WHERE p.id = ?`,
        [playoffId]
      );

      if (playoffs.length === 0) {
        return null;
      }

      const playoff = playoffs[0];

      const matches = await pool.query(
        `SELECT pm.*,
                ht.name as home_team_name, at.name as away_team_name,
                wt.name as winner_name
         FROM playoff_matches pm
         JOIN teams ht ON pm.home_team_id = ht.id
         JOIN teams at ON pm.away_team_id = at.id
         LEFT JOIN teams wt ON pm.winner_team_id = wt.id
         WHERE pm.playoff_id = ?
         ORDER BY pm.round, pm.match_number`,
        [playoffId]
      );

      return {
        ...playoff,
        matches
      };

    } catch (error) {
      console.error('Failed to get playoff:', error);
      throw error;
    }
  }
}

export default PlayoffService;
