import pool from '../database/db.js';

// 리그별 우승 상금
const LEAGUE_PRIZES: { [key: string]: number } = {
  'SUPER': 500000000,   // 1부 우승: 5억
  'FIRST': 250000000,   // 2부 우승: 2억 5천만
  'SECOND': 100000000   // 3부 우승: 1억
};

export class PlayoffService {
  // 플레이오프 생성 (정규 시즌 종료 후) - 상위 6팀 참가
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

      // 플레이오프 생성 (WILDCARD 라운드부터 시작)
      const playoffResult = await pool.query(
        `INSERT INTO playoffs (league_id, season, status)
         VALUES (?, ?, 'WILDCARD')`,
        [leagueId, league.season]
      );

      const playoffId = playoffResult.insertId;

      // 상위 6팀 조회
      const topTeams = await pool.query(
        `SELECT team_id FROM league_participants
         WHERE league_id = ?
         ORDER BY points DESC, goal_difference DESC
         LIMIT 6`,
        [leagueId]
      );

      if (topTeams.length < 6) {
        console.log('Not enough teams for playoff (need 6)');
        return null;
      }

      // 1위, 2위는 부전승으로 준결승 직행
      // 와일드카드: 3위 vs 6위, 4위 vs 5위
      const wildcardMatches = [
        { home: topTeams[2].team_id, away: topTeams[5].team_id, matchNum: 1 }, // 3위 vs 6위
        { home: topTeams[3].team_id, away: topTeams[4].team_id, matchNum: 2 }  // 4위 vs 5위
      ];

      // 1위, 2위 팀 저장 (준결승에서 사용)
      await pool.query(
        `INSERT INTO playoff_byes (playoff_id, team_id, seed)
         VALUES (?, ?, 1), (?, ?, 2)`,
        [playoffId, topTeams[0].team_id, playoffId, topTeams[1].team_id]
      );

      // 다음 토요일 찾기
      const nextSaturday = this.getNextSaturday(new Date());
      let matchTime = new Date(nextSaturday);
      matchTime.setUTCHours(8, 0, 0, 0); // 17:00 KST

      for (const match of wildcardMatches) {
        const year = matchTime.getFullYear();
        const month = String(matchTime.getMonth() + 1).padStart(2, '0');
        const day = String(matchTime.getDate()).padStart(2, '0');
        const hours = String(matchTime.getHours()).padStart(2, '0');
        const minutes = String(matchTime.getMinutes()).padStart(2, '0');
        const seconds = String(matchTime.getSeconds()).padStart(2, '0');
        const scheduledAtStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        await pool.query(
          `INSERT INTO playoff_matches (playoff_id, round, match_number, home_team_id, away_team_id, scheduled_at, status)
           VALUES (?, 'WILDCARD', ?, ?, ?, ?, 'SCHEDULED')`,
          [playoffId, match.matchNum, match.home, match.away, scheduledAtStr]
        );

        matchTime = new Date(matchTime.getTime() + 60 * 60 * 1000); // 1시간 간격
      }

      console.log(`Playoff created for league ${leagueId}, season ${league.season} (6-team format)`);
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
        case 'WILDCARD':
          nextRound = 'SEMI';
          break;
        case 'SEMI':
          nextRound = 'FINAL';
          break;
        default:
          throw new Error('Playoff is already completed');
      }

      // 다음 토요일
      const nextSaturday = this.getNextSaturday(new Date());
      let matchTime = new Date(nextSaturday);
      matchTime.setUTCHours(8, 0, 0, 0);

      const matches: { home: number; away: number }[] = [];

      if (currentRound === 'WILDCARD') {
        // 와일드카드 → 준결승
        // 1위, 2위 부전승 팀 가져오기
        const byes = await pool.query(
          `SELECT team_id, seed FROM playoff_byes WHERE playoff_id = ? ORDER BY seed`,
          [playoffId]
        );

        // 와일드카드 승자 조회
        const wildcardWinners = await pool.query(
          `SELECT winner_team_id, match_number FROM playoff_matches
           WHERE playoff_id = ? AND round = 'WILDCARD' AND status = 'COMPLETED'
           ORDER BY match_number`,
          [playoffId]
        );

        if (byes.length < 2 || wildcardWinners.length < 2) {
          throw new Error('Not all wildcard matches completed');
        }

        // 준결승 대진
        // 1위 vs 4/5위 승자 (match 2), 2위 vs 3/6위 승자 (match 1)
        matches.push({
          home: byes[0].team_id,  // 1위
          away: wildcardWinners[1].winner_team_id  // 4위 vs 5위 승자
        });
        matches.push({
          home: byes[1].team_id,  // 2위
          away: wildcardWinners[0].winner_team_id  // 3위 vs 6위 승자
        });

      } else if (currentRound === 'SEMI') {
        // 준결승 → 결승
        const semiWinners = await pool.query(
          `SELECT winner_team_id FROM playoff_matches
           WHERE playoff_id = ? AND round = 'SEMI' AND status = 'COMPLETED'
           ORDER BY match_number`,
          [playoffId]
        );

        if (semiWinners.length < 2) {
          throw new Error('Not all semifinal matches completed');
        }

        matches.push({
          home: semiWinners[0].winner_team_id,
          away: semiWinners[1].winner_team_id
        });
      }

      // 경기 생성
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

      // 결승전이면 우승팀에게 상금 지급 및 WORLDS 진출팀 결정
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

        // WORLDS 진출팀 4팀 결정 (1위, 2위, 준결승 패자 2팀)
        const loserId = winnerId === match.home_team_id ? match.away_team_id : match.home_team_id;

        // 준결승 패자 조회
        const semiMatches = await pool.query(
          `SELECT home_team_id, away_team_id, winner_team_id FROM playoff_matches
           WHERE playoff_id = ? AND round = 'SEMI'`,
          [match.playoff_id]
        );

        const semiLosers = semiMatches.map((m: any) =>
          m.winner_team_id === m.home_team_id ? m.away_team_id : m.home_team_id
        );

        // WORLDS 진출팀 기록
        const worldsQualifiers = [
          { team_id: winnerId, position: 1 },      // 우승
          { team_id: loserId, position: 2 },       // 준우승
          { team_id: semiLosers[0], position: 3 }, // 준결승 패자
          { team_id: semiLosers[1], position: 4 }  // 준결승 패자
        ];

        for (const qualifier of worldsQualifiers) {
          await pool.query(
            `INSERT INTO worlds_qualifiers (playoff_id, league_id, team_id, position, season)
             VALUES (?, ?, ?, ?, (SELECT season FROM playoffs WHERE id = ?))`,
            [match.playoff_id, match.league_id, qualifier.team_id, qualifier.position, match.playoff_id]
          );
        }

        console.log(`Playoff champion: Team ${winnerId}, Prize: ${prize.toLocaleString()} gold`);
        console.log(`WORLDS qualifiers: ${worldsQualifiers.map(q => q.team_id).join(', ')}`);
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

      // 부전승 팀 정보 조회
      const byes = await pool.query(
        `SELECT pb.*, t.name as team_name
         FROM playoff_byes pb
         JOIN teams t ON pb.team_id = t.id
         WHERE pb.playoff_id = ?
         ORDER BY pb.seed`,
        [playoffId]
      );

      return {
        ...playoff,
        matches,
        byes
      };

    } catch (error) {
      console.error('Failed to get playoff:', error);
      throw error;
    }
  }

  // WORLDS 진출팀 조회
  static async getWorldsQualifiers(leagueId: number, season?: number) {
    try {
      let query = `
        SELECT wq.*, t.name as team_name, t.logo_url, l.region
        FROM worlds_qualifiers wq
        JOIN teams t ON wq.team_id = t.id
        JOIN leagues l ON wq.league_id = l.id
        WHERE wq.league_id = ?
      `;
      const params: any[] = [leagueId];

      if (season) {
        query += ' AND wq.season = ?';
        params.push(season);
      }

      query += ' ORDER BY wq.season DESC, wq.position ASC';

      const qualifiers = await pool.query(query, params);
      return qualifiers;

    } catch (error) {
      console.error('Failed to get WORLDS qualifiers:', error);
      throw error;
    }
  }

  // 현재 시즌 WORLDS 진출팀 조회 (모든 리그)
  static async getAllWorldsQualifiers(season: number) {
    try {
      const qualifiers = await pool.query(
        `SELECT wq.*, t.name as team_name, t.logo_url, l.name as league_name, l.region
         FROM worlds_qualifiers wq
         JOIN teams t ON wq.team_id = t.id
         JOIN leagues l ON wq.league_id = l.id
         WHERE wq.season = ?
         ORDER BY l.region, wq.position`,
        [season]
      );
      return qualifiers;

    } catch (error) {
      console.error('Failed to get all WORLDS qualifiers:', error);
      throw error;
    }
  }
}

export default PlayoffService;
