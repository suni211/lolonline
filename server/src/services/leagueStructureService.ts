import pool from '../database/db.js';

export class LeagueStructureService {
  // 시즌 초기화 - LPO SOUTH/NORTH 리그 생성
  static async initializeSeason(season: number) {
    try {
      // 기존 리그 종료
      await pool.query(
        `UPDATE leagues SET status = 'FINISHED' WHERE status != 'FINISHED'`
      );

      // LPO SOUTH 1부 리그 생성
      const southFirstResult = await pool.query(
        `INSERT INTO leagues (name, region, season, status, max_teams)
         VALUES (?, 'SOUTH', ?, 'PENDING', 12)`,
        [`LPO SOUTH Season ${season}`, season]
      );
      const southFirstId = southFirstResult.insertId;

      // LPO SOUTH 2부 리그 생성
      const southSecondResult = await pool.query(
        `INSERT INTO leagues (name, region, season, status, max_teams)
         VALUES (?, 'SOUTH', ?, 'PENDING', 20)`,
        [`LPO SOUTH 2부 Season ${season}`, season]
      );
      const southSecondId = southSecondResult.insertId;

      // LPO NORTH 1부 리그 생성
      const northFirstResult = await pool.query(
        `INSERT INTO leagues (name, region, season, status, max_teams)
         VALUES (?, 'NORTH', ?, 'PENDING', 12)`,
        [`LPO NORTH Season ${season}`, season]
      );
      const northFirstId = northFirstResult.insertId;

      // LPO NORTH 2부 리그 생성
      const northSecondResult = await pool.query(
        `INSERT INTO leagues (name, region, season, status, max_teams)
         VALUES (?, 'NORTH', ?, 'PENDING', 20)`,
        [`LPO NORTH 2부 Season ${season}`, season]
      );
      const northSecondId = northSecondResult.insertId;

      return {
        southFirst: southFirstId,
        southSecond: southSecondId,
        northFirst: northFirstId,
        northSecond: northSecondId
      };
    } catch (error) {
      console.error('Initialize season error:', error);
      throw error;
    }
  }

  // 팀 배정 - AI 수에 맞게 자동 분배
  static async distributeTeams(season: number) {
    try {
      // SOUTH 지역 팀들
      const southTeams = await pool.query(
        `SELECT id, name, fan_count FROM teams WHERE region = 'SOUTH' ORDER BY fan_count DESC`
      );

      // NORTH 지역 팀들
      const northTeams = await pool.query(
        `SELECT id, name, fan_count FROM teams WHERE region = 'NORTH' ORDER BY fan_count DESC`
      );

      // 리그 ID 조회
      const leagues = await pool.query(
        `SELECT id, name, region FROM leagues WHERE season = ? ORDER BY region, name`,
        [season]
      );

      const southFirstLeague = leagues.find((l: any) => l.region === 'SOUTH' && !l.name.includes('2부'));
      const southSecondLeague = leagues.find((l: any) => l.region === 'SOUTH' && l.name.includes('2부'));
      const northFirstLeague = leagues.find((l: any) => l.region === 'NORTH' && !l.name.includes('2부'));
      const northSecondLeague = leagues.find((l: any) => l.region === 'NORTH' && l.name.includes('2부'));

      // SOUTH 팀 배정 (상위 12팀 1부, 나머지 2부)
      for (let i = 0; i < southTeams.length; i++) {
        const leagueId = i < 12 ? southFirstLeague.id : southSecondLeague.id;
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)
           ON DUPLICATE KEY UPDATE wins = 0, losses = 0, draws = 0, points = 0, goal_difference = 0`,
          [leagueId, southTeams[i].id]
        );

        // 팀 리그 정보 업데이트
        await pool.query(
          `UPDATE teams SET league = ? WHERE id = ?`,
          [i < 12 ? 'FIRST' : 'SECOND', southTeams[i].id]
        );
      }

      // NORTH 팀 배정 (상위 12팀 1부, 나머지 2부)
      for (let i = 0; i < northTeams.length; i++) {
        const leagueId = i < 12 ? northFirstLeague.id : northSecondLeague.id;
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)
           ON DUPLICATE KEY UPDATE wins = 0, losses = 0, draws = 0, points = 0, goal_difference = 0`,
          [leagueId, northTeams[i].id]
        );

        await pool.query(
          `UPDATE teams SET league = ? WHERE id = ?`,
          [i < 12 ? 'FIRST' : 'SECOND', northTeams[i].id]
        );
      }

      return {
        south: { first: Math.min(12, southTeams.length), second: Math.max(0, southTeams.length - 12) },
        north: { first: Math.min(12, northTeams.length), second: Math.max(0, northTeams.length - 12) }
      };
    } catch (error) {
      console.error('Distribute teams error:', error);
      throw error;
    }
  }

  // 22경기 일정 생성 (더블 라운드 로빈)
  static async generateSchedule(leagueId: number) {
    try {
      const participants = await pool.query(
        `SELECT team_id FROM league_participants WHERE league_id = ?`,
        [leagueId]
      );

      if (participants.length < 2) {
        throw new Error('Not enough teams for schedule');
      }

      const teams = participants.map((p: any) => p.team_id);
      const matches: any[] = [];

      // 더블 라운드 로빈 (홈 & 어웨이)
      for (let round = 0; round < 2; round++) {
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            const homeTeam = round === 0 ? teams[i] : teams[j];
            const awayTeam = round === 0 ? teams[j] : teams[i];
            matches.push({ home: homeTeam, away: awayTeam });
          }
        }
      }

      // 경기 일정 생성 (금요일까지)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1); // 내일부터 시작

      for (let i = 0; i < matches.length; i++) {
        const matchDate = new Date(startDate);
        matchDate.setDate(matchDate.getDate() + Math.floor(i / 6)); // 하루에 6경기
        matchDate.setHours(14 + (i % 6) * 2, 0, 0); // 14시부터 2시간 간격

        await pool.query(
          `INSERT INTO matches (league_id, home_team_id, away_team_id, match_type, scheduled_at, status)
           VALUES (?, ?, ?, 'REGULAR', ?, 'SCHEDULED')`,
          [leagueId, matches[i].home, matches[i].away, matchDate]
        );
      }

      return { totalMatches: matches.length };
    } catch (error) {
      console.error('Generate schedule error:', error);
      throw error;
    }
  }

  // WORLDS 토너먼트 생성
  static async createWorlds(season: number) {
    try {
      // WORLDS 생성
      const worldsResult = await pool.query(
        `INSERT INTO worlds_tournaments (season, status, prize_pool)
         VALUES (?, 'PENDING', 2500000000)`,
        [season]
      );
      const worldsId = worldsResult.insertId;

      // 각 지역 상위 4팀 조회
      const southTop4 = await pool.query(
        `SELECT lp.team_id, t.name
         FROM league_participants lp
         JOIN teams t ON lp.team_id = t.id
         JOIN leagues l ON lp.league_id = l.id
         WHERE l.season = ? AND l.region = 'SOUTH' AND l.name NOT LIKE '%2부%'
         ORDER BY lp.points DESC, lp.goal_difference DESC, lp.wins DESC
         LIMIT 4`,
        [season]
      );

      const northTop4 = await pool.query(
        `SELECT lp.team_id, t.name
         FROM league_participants lp
         JOIN teams t ON lp.team_id = t.id
         JOIN leagues l ON lp.league_id = l.id
         WHERE l.season = ? AND l.region = 'NORTH' AND l.name NOT LIKE '%2부%'
         ORDER BY lp.points DESC, lp.goal_difference DESC, lp.wins DESC
         LIMIT 4`,
        [season]
      );

      // 참가자 등록
      for (let i = 0; i < southTop4.length; i++) {
        await pool.query(
          `INSERT INTO worlds_participants (worlds_id, team_id, region, seed)
           VALUES (?, ?, 'SOUTH', ?)`,
          [worldsId, southTop4[i].team_id, i + 1]
        );
      }

      for (let i = 0; i < northTop4.length; i++) {
        await pool.query(
          `INSERT INTO worlds_participants (worlds_id, team_id, region, seed)
           VALUES (?, ?, 'NORTH', ?)`,
          [worldsId, northTop4[i].team_id, i + 1]
        );
      }

      // 8강 대진 생성 (SOUTH 1 vs NORTH 4, SOUTH 2 vs NORTH 3, ...)
      const quarterMatches = [
        { team1: southTop4[0]?.team_id, team2: northTop4[3]?.team_id },
        { team1: northTop4[0]?.team_id, team2: southTop4[3]?.team_id },
        { team1: southTop4[1]?.team_id, team2: northTop4[2]?.team_id },
        { team1: northTop4[1]?.team_id, team2: southTop4[2]?.team_id }
      ];

      // 토요일 시작
      const saturday = new Date();
      const daysUntilSaturday = (6 - saturday.getDay() + 7) % 7 || 7;
      saturday.setDate(saturday.getDate() + daysUntilSaturday);
      saturday.setHours(14, 0, 0);

      for (let i = 0; i < quarterMatches.length; i++) {
        const matchTime = new Date(saturday);
        matchTime.setHours(14 + i * 3); // 3시간 간격

        await pool.query(
          `INSERT INTO worlds_matches (worlds_id, round, match_number, team1_id, team2_id, scheduled_at, status)
           VALUES (?, 'QUARTER', ?, ?, ?, ?, 'PENDING')`,
          [worldsId, i + 1, quarterMatches[i].team1, quarterMatches[i].team2, matchTime]
        );
      }

      // 4강, 결승 빈 슬롯 생성
      const sunday = new Date(saturday);
      sunday.setDate(sunday.getDate() + 1);

      for (let i = 0; i < 2; i++) {
        const matchTime = new Date(sunday);
        matchTime.setHours(14 + i * 4);
        await pool.query(
          `INSERT INTO worlds_matches (worlds_id, round, match_number, scheduled_at, status)
           VALUES (?, 'SEMI', ?, ?, 'PENDING')`,
          [worldsId, i + 1, matchTime]
        );
      }

      const finalTime = new Date(sunday);
      finalTime.setDate(finalTime.getDate() + 1);
      finalTime.setHours(18, 0, 0);
      await pool.query(
        `INSERT INTO worlds_matches (worlds_id, round, match_number, scheduled_at, status)
         VALUES (?, 'FINAL', 1, ?, 'PENDING')`,
        [worldsId, finalTime]
      );

      return { worldsId, participants: southTop4.length + northTop4.length };
    } catch (error) {
      console.error('Create WORLDS error:', error);
      throw error;
    }
  }

  // 승격/강등전 생성
  static async createPromotionMatches(season: number, region: 'SOUTH' | 'NORTH') {
    try {
      // 1부 하위 2팀
      const firstDivBottom = await pool.query(
        `SELECT lp.team_id
         FROM league_participants lp
         JOIN leagues l ON lp.league_id = l.id
         WHERE l.season = ? AND l.region = ? AND l.name NOT LIKE '%2부%'
         ORDER BY lp.points ASC, lp.goal_difference ASC
         LIMIT 2`,
        [season, region]
      );

      // 2부 상위 2팀
      const secondDivTop = await pool.query(
        `SELECT lp.team_id
         FROM league_participants lp
         JOIN leagues l ON lp.league_id = l.id
         WHERE l.season = ? AND l.region = ? AND l.name LIKE '%2부%'
         ORDER BY lp.points DESC, lp.goal_difference DESC
         LIMIT 2`,
        [season, region]
      );

      // 승격전 생성 (1부 11위 vs 2부 2위, 1부 12위 vs 2부 1위)
      const matches = [];

      if (firstDivBottom.length >= 2 && secondDivTop.length >= 2) {
        const matchDate = new Date();
        matchDate.setDate(matchDate.getDate() + 7); // 1주일 후

        // 첫 번째 승격전
        const result1 = await pool.query(
          `INSERT INTO promotion_matches (season, region, first_div_team_id, second_div_team_id, scheduled_at)
           VALUES (?, ?, ?, ?, ?)`,
          [season, region, firstDivBottom[0].team_id, secondDivTop[1].team_id, matchDate]
        );
        matches.push(result1.insertId);

        matchDate.setHours(matchDate.getHours() + 3);

        // 두 번째 승격전
        const result2 = await pool.query(
          `INSERT INTO promotion_matches (season, region, first_div_team_id, second_div_team_id, scheduled_at)
           VALUES (?, ?, ?, ?, ?)`,
          [season, region, firstDivBottom[1].team_id, secondDivTop[0].team_id, matchDate]
        );
        matches.push(result2.insertId);
      }

      return { matches };
    } catch (error) {
      console.error('Create promotion matches error:', error);
      throw error;
    }
  }

  // 시즌 완전 리셋
  static async resetSeason(newSeason: number) {
    try {
      // 1. 모든 경기 삭제
      await pool.query(`DELETE FROM matches WHERE status != 'FINISHED'`);

      // 2. 리그 참가자 초기화
      await pool.query(`DELETE FROM league_participants`);

      // 3. 새 시즌 리그 생성
      const leagues = await this.initializeSeason(newSeason);

      // 4. 팀 배정
      const distribution = await this.distributeTeams(newSeason);

      // 5. 일정 생성
      await this.generateSchedule(leagues.southFirst);
      await this.generateSchedule(leagues.northFirst);
      await this.generateSchedule(leagues.southSecond);
      await this.generateSchedule(leagues.northSecond);

      return {
        season: newSeason,
        leagues,
        distribution
      };
    } catch (error) {
      console.error('Reset season error:', error);
      throw error;
    }
  }
}

export default LeagueStructureService;
