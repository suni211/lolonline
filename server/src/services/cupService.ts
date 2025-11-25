import pool from '../database/db.js';

export class CupService {
  // 컵 토너먼트 생성 및 32강 대진표 자동 생성
  static async createCupTournament(season: number) {
    try {
      console.log(`Creating Cup Tournament for season ${season}...`);

      // 컵 토너먼트 생성 (상금 5억 5천만)
      const cupResult = await pool.query(
        `INSERT INTO cup_tournaments (name, season, status, prize_pool)
         VALUES (?, ?, 'ROUND_32', 550000000)`,
        [`LPO CUP Season ${season}`, season]
      );

      const cupId = cupResult.insertId;

      // 각 리그 팀 조회 (SOUTH, NORTH, AMATEUR)
      const southTeams = await pool.query(
        `SELECT lp.team_id FROM league_participants lp
         JOIN leagues l ON lp.league_id = l.id
         WHERE l.region = 'SOUTH' AND l.season = ?
         ORDER BY lp.points DESC, lp.goal_difference DESC`,
        [season]
      );

      const northTeams = await pool.query(
        `SELECT lp.team_id FROM league_participants lp
         JOIN leagues l ON lp.league_id = l.id
         WHERE l.region = 'NORTH' AND l.season = ?
         ORDER BY lp.points DESC, lp.goal_difference DESC`,
        [season]
      );

      const amateurTeams = await pool.query(
        `SELECT lp.team_id FROM league_participants lp
         JOIN leagues l ON lp.league_id = l.id
         WHERE l.region = 'AMATEUR' AND l.season = ?
         ORDER BY lp.points DESC, lp.goal_difference DESC`,
        [season]
      );

      console.log(`Teams found - SOUTH: ${southTeams.length}, NORTH: ${northTeams.length}, AMATEUR: ${amateurTeams.length}`);

      if (southTeams.length === 0 || northTeams.length === 0 || amateurTeams.length === 0) {
        throw new Error(`팀이 부족합니다. SOUTH: ${southTeams.length}, NORTH: ${northTeams.length}, AMATEUR: ${amateurTeams.length}`);
      }

      // 32강 대진표 생성
      // SOUTH(1부) vs AMATEUR (16경기)
      // NORTH(1부) vs AMATEUR (16경기)
      // 남은 팀끼리 (SOUTH, NORTH 각각)

      const matches: { home: number; away: number }[] = [];

      // SOUTH vs AMATEUR (최대 16경기)
      for (let i = 0; i < Math.min(southTeams.length, 16); i++) {
        const amateurIndex = i % amateurTeams.length;
        matches.push({
          home: southTeams[i].team_id,
          away: amateurTeams[amateurIndex].team_id
        });
      }

      // NORTH vs AMATEUR (최대 16경기)
      for (let i = 0; i < Math.min(northTeams.length, 16); i++) {
        const amateurIndex = (i + Math.min(southTeams.length, 16)) % amateurTeams.length;
        matches.push({
          home: northTeams[i].team_id,
          away: amateurTeams[amateurIndex].team_id
        });
      }

      // 남은 SOUTH 팀끼리 (상위 시드가 홈)
      const remainingSouthTeams = southTeams.slice(16);
      for (let i = 0; i < remainingSouthTeams.length; i += 2) {
        if (i + 1 < remainingSouthTeams.length) {
          matches.push({
            home: remainingSouthTeams[i].team_id,
            away: remainingSouthTeams[i + 1].team_id
          });
        }
      }

      // 남은 NORTH 팀끼리 (상위 시드가 홈)
      const remainingNorthTeams = northTeams.slice(16);
      for (let i = 0; i < remainingNorthTeams.length; i += 2) {
        if (i + 1 < remainingNorthTeams.length) {
          matches.push({
            home: remainingNorthTeams[i].team_id,
            away: remainingNorthTeams[i + 1].team_id
          });
        }
      }

      // 첫 번째 수요일 찾기
      const nextWednesday = this.getNextWednesday(new Date());
      let matchTime = new Date(nextWednesday);
      matchTime.setUTCHours(8, 0, 0, 0); // 17:00 KST = 08:00 UTC

      console.log(`Generating ${matches.length} cup matches for round of 32...`);

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];

        // UTC를 KST로 변환하여 저장 (UTC+9)
        const kstTime = new Date(matchTime.getTime() + 9 * 60 * 60 * 1000);
        const year = kstTime.getUTCFullYear();
        const month = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(kstTime.getUTCDate()).padStart(2, '0');
        const hours = String(kstTime.getUTCHours()).padStart(2, '0');
        const minutes = String(kstTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(kstTime.getUTCSeconds()).padStart(2, '0');
        const scheduledAtStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        await pool.query(
          `INSERT INTO cup_matches (cup_id, round, match_number, home_team_id, away_team_id, scheduled_at, status)
           VALUES (?, 'ROUND_32', ?, ?, ?, ?, 'SCHEDULED')`,
          [cupId, i + 1, match.home, match.away, scheduledAtStr]
        );

        // 30분 간격
        matchTime = new Date(matchTime.getTime() + 30 * 60 * 1000);

        // 23:30 KST (14:30 UTC) 넘으면 다음 수요일로
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstCheckTime = new Date(matchTime.getTime() + kstOffset);
        if (kstCheckTime.getUTCHours() > 14 || (kstCheckTime.getUTCHours() === 14 && kstCheckTime.getUTCMinutes() > 30)) {
          matchTime = this.getNextWednesday(matchTime);
          matchTime.setUTCHours(8, 0, 0, 0);
        }
      }

      console.log(`Cup Tournament created with ID: ${cupId}`);
      return cupId;

    } catch (error) {
      console.error('Failed to create cup tournament:', error);
      throw error;
    }
  }

  // 다음 라운드 대진표 생성 (16강부터는 추첨)
  static async generateNextRound(cupId: number) {
    try {
      // 현재 컵 상태 조회
      const cups = await pool.query(
        'SELECT * FROM cup_tournaments WHERE id = ?',
        [cupId]
      );

      if (cups.length === 0) {
        throw new Error('Cup not found');
      }

      const cup = cups[0];
      let currentRound = cup.status;
      let nextRound: string;

      switch (currentRound) {
        case 'ROUND_32':
          nextRound = 'ROUND_16';
          break;
        case 'ROUND_16':
          nextRound = 'QUARTER';
          break;
        case 'QUARTER':
          nextRound = 'SEMI';
          break;
        case 'SEMI':
          nextRound = 'FINAL';
          break;
        default:
          throw new Error('Cup is already completed');
      }

      // 이전 라운드 승자 조회
      const winners = await pool.query(
        `SELECT winner_team_id FROM cup_matches
         WHERE cup_id = ? AND round = ? AND status = 'COMPLETED'
         ORDER BY match_number`,
        [cupId, currentRound]
      );

      if (winners.length === 0) {
        throw new Error('No completed matches in current round');
      }

      const winnerIds = winners.map((w: any) => w.winner_team_id);

      // 16강부터는 추첨 (셔플)
      const shuffledWinners = this.shuffleArray([...winnerIds]);

      // 대진표 생성
      const matches: { home: number; away: number }[] = [];
      for (let i = 0; i < shuffledWinners.length; i += 2) {
        if (i + 1 < shuffledWinners.length) {
          matches.push({
            home: shuffledWinners[i],
            away: shuffledWinners[i + 1]
          });
        }
      }

      // 32강 경기 일정을 기준으로 2주간 스케줄
      // 1주차 수요일: 32강 / 1주차 토요일: 16강
      // 2주차 수요일: 8강 / 2주차 토요일: 4강, 결승
      const firstMatch = await pool.query(
        `SELECT scheduled_at FROM cup_matches WHERE cup_id = ? AND round = 'ROUND_32' ORDER BY match_number LIMIT 1`,
        [cupId]
      );

      let baseWednesday: Date;
      if (firstMatch.length > 0) {
        baseWednesday = new Date(firstMatch[0].scheduled_at);
      } else {
        baseWednesday = this.getNextWednesday(new Date());
      }

      let matchTime: Date;
      if (nextRound === 'ROUND_16') {
        // 1주차 토요일: 16강
        matchTime = new Date(baseWednesday);
        matchTime.setDate(matchTime.getDate() + 3); // 수요일 -> 토요일
        matchTime.setUTCHours(8, 0, 0, 0); // 17:00 KST
      } else if (nextRound === 'QUARTER') {
        // 2주차 수요일: 8강
        matchTime = new Date(baseWednesday);
        matchTime.setDate(matchTime.getDate() + 7); // 다음 주 수요일
        matchTime.setUTCHours(8, 0, 0, 0); // 17:00 KST
      } else if (nextRound === 'SEMI') {
        // 2주차 토요일: 4강
        matchTime = new Date(baseWednesday);
        matchTime.setDate(matchTime.getDate() + 10); // 다음 주 토요일
        matchTime.setUTCHours(8, 0, 0, 0); // 17:00 KST
      } else {
        // 2주차 토요일: 결승 (4강 후)
        matchTime = new Date(baseWednesday);
        matchTime.setDate(matchTime.getDate() + 10); // 다음 주 토요일
        matchTime.setUTCHours(10, 0, 0, 0); // 19:00 KST
      }

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];

        // KST 시간으로 표시 (UTC + 9)
        const kstTime = new Date(matchTime.getTime() + 9 * 60 * 60 * 1000);
        const year = kstTime.getUTCFullYear();
        const month = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(kstTime.getUTCDate()).padStart(2, '0');
        const hours = String(kstTime.getUTCHours()).padStart(2, '0');
        const minutes = String(kstTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(kstTime.getUTCSeconds()).padStart(2, '0');
        const scheduledAtStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        await pool.query(
          `INSERT INTO cup_matches (cup_id, round, match_number, home_team_id, away_team_id, scheduled_at, status)
           VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED')`,
          [cupId, nextRound, i + 1, match.home, match.away, scheduledAtStr]
        );

        matchTime = new Date(matchTime.getTime() + 30 * 60 * 1000);
      }

      // 컵 상태 업데이트
      await pool.query(
        'UPDATE cup_tournaments SET status = ? WHERE id = ?',
        [nextRound, cupId]
      );

      console.log(`Generated ${matches.length} matches for ${nextRound}`);
      return matches.length;

    } catch (error) {
      console.error('Failed to generate next round:', error);
      throw error;
    }
  }

  // 컵 경기 결과 처리
  static async processCupMatchResult(matchId: number, homeScore: number, awayScore: number) {
    try {
      const matches = await pool.query(
        'SELECT * FROM cup_matches WHERE id = ?',
        [matchId]
      );

      if (matches.length === 0) {
        throw new Error('Match not found');
      }

      const match = matches[0];
      const winnerId = homeScore > awayScore ? match.home_team_id : match.away_team_id;

      await pool.query(
        `UPDATE cup_matches
         SET home_score = ?, away_score = ?, winner_team_id = ?, status = 'COMPLETED'
         WHERE id = ?`,
        [homeScore, awayScore, winnerId, matchId]
      );

      // 결승전이면 우승팀 등록 및 상금 지급
      if (match.round === 'FINAL') {
        await pool.query(
          `UPDATE cup_tournaments SET winner_team_id = ?, status = 'COMPLETED' WHERE id = ?`,
          [winnerId, match.cup_id]
        );

        // 상금 지급 (5억 5천만 골드)
        await pool.query(
          'UPDATE teams SET gold = gold + 550000000 WHERE id = ?',
          [winnerId]
        );

        console.log(`Cup champion: Team ${winnerId}, Prize: 550,000,000 gold`);
      }

      return winnerId;

    } catch (error) {
      console.error('Failed to process cup match result:', error);
      throw error;
    }
  }

  // 다음 수요일 찾기
  static getNextWednesday(date: Date): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntilWednesday);
    return result;
  }

  // 다음 토요일 찾기
  static getNextSaturday(date: Date): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntilSaturday);
    return result;
  }

  // 배열 셔플
  static shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // 컵 대회 정보 조회
  static async getCupTournament(cupId: number) {
    try {
      const cups = await pool.query(
        `SELECT ct.*, t.name as winner_name
         FROM cup_tournaments ct
         LEFT JOIN teams t ON ct.winner_team_id = t.id
         WHERE ct.id = ?`,
        [cupId]
      );

      if (cups.length === 0) {
        return null;
      }

      const cup = cups[0];

      // 경기 목록 조회
      const matches = await pool.query(
        `SELECT cm.id, cm.cup_id, cm.round, cm.match_number, cm.home_team_id, cm.away_team_id,
                cm.home_score, cm.away_score, cm.winner_team_id, cm.status,
                DATE_FORMAT(cm.scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at,
                ht.name as home_team_name, ht.abbreviation as home_team_abbr,
                at.name as away_team_name, at.abbreviation as away_team_abbr,
                wt.name as winner_name
         FROM cup_matches cm
         JOIN teams ht ON cm.home_team_id = ht.id
         JOIN teams at ON cm.away_team_id = at.id
         LEFT JOIN teams wt ON cm.winner_team_id = wt.id
         WHERE cm.cup_id = ?
         ORDER BY cm.round, cm.match_number`,
        [cupId]
      );

      return {
        ...cup,
        matches
      };

    } catch (error) {
      console.error('Failed to get cup tournament:', error);
      throw error;
    }
  }

  // 현재 시즌 컵 대회 조회
  static async getCurrentSeasonCup(season: number) {
    try {
      const cups = await pool.query(
        'SELECT * FROM cup_tournaments WHERE season = ?',
        [season]
      );

      if (cups.length === 0) {
        return null;
      }

      return this.getCupTournament(cups[0].id);

    } catch (error) {
      console.error('Failed to get current season cup:', error);
      throw error;
    }
  }
}

export default CupService;
