import pool from '../database/db.js';

// AI 선수 카운터
let aiPlayerCounter = 0;

// AI 팀 이름 목록 (32팀)
const AI_TEAM_NAMES = [
  // Esports가 들어가는 팀 (10팀)
  'Dragon Esports',
  'Phoenix Esports',
  'Thunder Esports',
  'Titan Esports',
  'Storm Esports',
  'Shadow Esports',
  'Blaze Esports',
  'Frost Esports',
  'Nova Esports',
  'Apex Esports',
  // 나머지 팀 (22팀)
  'Golden Lions',
  'Silver Knights',
  'Dark Ravens',
  'White Tigers',
  'Blue Dolphins',
  'Red Wolves',
  'Green Vipers',
  'Black Panthers',
  'Sky Hawks',
  'Ocean Sharks',
  'Mountain Bears',
  'Desert Foxes',
  'Iron Giants',
  'Crystal Dragons',
  'Neon Ninjas',
  'Cyber Samurai',
  'Royal Guard',
  'Elite Force',
  'Prime Legion',
  'Victory Squad',
  'Glory Hunters',
  'Rising Stars'
];

export class LPOLeagueService {
  // LPO 리그 초기화 (AI 팀 생성 포함)
  static async initializeLPOLeagues() {
    try {
      console.log('Initializing LPO League system...');

      // teams 테이블의 user_id를 nullable로 변경 (AI 팀용)
      await pool.query(`ALTER TABLE teams MODIFY COLUMN user_id INT NULL`);

      // unique_user_team 제약 조건 삭제 (AI 팀은 user_id가 NULL이므로)
      try {
        await pool.query(`ALTER TABLE teams DROP INDEX unique_user_team`);
      } catch (e) {
        // 이미 삭제된 경우 무시
      }

      // 플레이어 팀 먼저 조회 (삭제 전에)
      const playerTeams = await pool.query(
        `SELECT id, name FROM teams WHERE user_id IS NOT NULL`
      );
      const teamNames = playerTeams.map((t: any) => t.name);
      console.log(`Found ${playerTeams.length} player teams: [${teamNames.join(', ')}]`);

      // 기존 AI 팀 및 LPO 리그 삭제 (완전 초기화)
      console.log('Cleaning up existing LPO data...');

      // AI 팀의 선수 소유권 삭제 및 선수 삭제
      await pool.query(
        `DELETE FROM players WHERE id IN (
          SELECT player_id FROM player_ownership WHERE team_id IN (SELECT id FROM teams WHERE is_ai = true)
        )`
      );

      // 플레이어 팀의 리그 참가 기록 삭제 (새로 등록할 예정)
      await pool.query(
        `DELETE FROM league_participants WHERE team_id IN (SELECT id FROM teams WHERE user_id IS NOT NULL)`
      );

      // AI 팀의 리그 참가 기록 삭제
      await pool.query(
        `DELETE FROM league_participants WHERE team_id IN (SELECT id FROM teams WHERE is_ai = true)`
      );

      // AI 팀의 경기 삭제 (league_matches 테이블)
      await pool.query(
        `DELETE FROM league_matches WHERE home_team_id IN (SELECT id FROM teams WHERE is_ai = true)
         OR away_team_id IN (SELECT id FROM teams WHERE is_ai = true)`
      );

      // AI 팀 삭제
      await pool.query(`DELETE FROM teams WHERE is_ai = true`);

      // 기존 LPO 리그의 경기 삭제
      await pool.query(`DELETE FROM matches WHERE league_id IN (SELECT id FROM leagues WHERE name LIKE 'LPO%')`);

      // 기존 LPO 리그 삭제
      await pool.query(`DELETE FROM leagues WHERE name LIKE 'LPO%'`);

      // LPO 리그 생성
      const superLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO SUPER LEAGUE', 'SUPER', 1, 1, 'REGULAR')"
      );
      const firstLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO 1 LEAGUE', 'FIRST', 1, 1, 'REGULAR')"
      );
      const secondLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO 2 LEAGUE', 'SECOND', 1, 1, 'REGULAR')"
      );

      // AI 팀 생성 및 리그 배정
      // SUPER: 10팀, FIRST: 10팀, SECOND: 12팀
      const tiers = [
        { leagueId: superLeague.insertId, tier: 'SUPER', count: 10, startIdx: 0 },
        { leagueId: firstLeague.insertId, tier: 'FIRST', count: 10, startIdx: 10 },
        { leagueId: secondLeague.insertId, tier: 'SECOND', count: 12, startIdx: 20 }
      ];

      for (const tierInfo of tiers) {
        for (let i = 0; i < tierInfo.count; i++) {
          const teamName = AI_TEAM_NAMES[tierInfo.startIdx + i];

          // AI 팀 생성 (user_id는 NULL)
          const teamResult = await pool.query(
            `INSERT INTO teams (user_id, name, league, is_ai, gold, diamond, fan_count)
             VALUES (NULL, ?, ?, true, 1000, 100, 1000)`,
            [teamName, tierInfo.tier]
          );

          const teamId = teamResult.insertId;

          // AI 선수 5명 생성 (스타터)
          await this.createAIPlayers(teamId, tierInfo.tier);

          // 리그 참가
          await pool.query(
            `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
             VALUES (?, ?, 0, 0, 0, 0, 0)`,
            [tierInfo.leagueId, teamId]
          );
        }
      }

      // 기존 플레이어 팀을 LPO 2 LEAGUE에 등록
      if (playerTeams.length > 0) {
        console.log(`Registering ${playerTeams.length} player teams to LPO 2 LEAGUE...`);

        for (const team of playerTeams) {
          // 팀의 리그를 SECOND로 업데이트
          await pool.query(
            `UPDATE teams SET league = 'SECOND' WHERE id = ?`,
            [team.id]
          );

          // 리그 참가 등록
          await pool.query(
            `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
             VALUES (?, ?, 0, 0, 0, 0, 0)`,
            [secondLeague.insertId, team.id]
          );

          // AI 팀 하나 제거 (플레이어 팀이 대체)
          const aiTeamToRemove = await pool.query(
            `SELECT lp.team_id FROM league_participants lp
             JOIN teams t ON lp.team_id = t.id
             WHERE lp.league_id = ? AND t.is_ai = true
             LIMIT 1`,
            [secondLeague.insertId]
          );

          if (aiTeamToRemove.length > 0) {
            const aiTeamId = aiTeamToRemove[0].team_id;

            // AI 팀의 선수 삭제
            await pool.query(
              `DELETE FROM players WHERE id IN (
                SELECT player_id FROM player_ownership WHERE team_id = ?
              )`,
              [aiTeamId]
            );

            // AI 팀 리그 참가 삭제
            await pool.query(
              `DELETE FROM league_participants WHERE team_id = ?`,
              [aiTeamId]
            );

            // AI 팀 삭제
            await pool.query(`DELETE FROM teams WHERE id = ?`, [aiTeamId]);
          }
        }
      }

      // 각 리그 스케줄 생성
      console.log('Generating match schedules...');
      await this.generateLeagueSchedule(superLeague.insertId);
      await this.generateLeagueSchedule(firstLeague.insertId);
      await this.generateLeagueSchedule(secondLeague.insertId);

      console.log('LPO League system initialized successfully!');
      console.log('- LPO SUPER LEAGUE: 10 AI teams');
      console.log('- LPO 1 LEAGUE: 10 AI teams');
      console.log(`- LPO 2 LEAGUE: ${12 - playerTeams.length} AI teams + ${playerTeams.length} player teams`);

    } catch (error) {
      console.error('Failed to initialize LPO leagues:', error);
      throw error;
    }
  }

  // 리그 스케줄 생성
  static async generateLeagueSchedule(leagueId: number) {
    try {
      // 리그 참가팀 조회
      const teams = await pool.query(
        `SELECT team_id FROM league_participants WHERE league_id = ?`,
        [leagueId]
      );

      if (teams.length < 2) {
        console.log(`League ${leagueId}: Not enough teams for schedule`);
        return;
      }

      const teamIds = teams.map((t: any) => t.team_id);

      // 2홈 2어웨이 스케줄 생성 (라운드 로빈 방식)
      // SUPER/FIRST: 10팀 -> 각 팀 36경기 (9팀 * 4경기)
      // SECOND: 12팀 -> 각 팀 44경기 (11팀 * 4경기)
      const matches: { home: number; away: number }[] = [];

      // 1사이클 생성 (홈/어웨이 번갈아가며)
      const generateCycle = (teams: number[], reverseHomeAway: boolean) => {
        const n = teams.length;
        const cycleMatches: { home: number; away: number }[] = [];

        const teamList = [...teams];
        if (n % 2 === 1) {
          teamList.push(-1); // bye
        }

        const numTeams = teamList.length;
        const numRounds = numTeams - 1;
        const matchesPerRound = numTeams / 2;

        for (let round = 0; round < numRounds; round++) {
          for (let match = 0; match < matchesPerRound; match++) {
            const home = (round + match) % (numTeams - 1);
            let away = (numTeams - 1 - match + round) % (numTeams - 1);

            if (match === 0) {
              away = numTeams - 1;
            }

            const team1 = teamList[home];
            const team2 = teamList[away];

            // bye 경기 제외
            if (team1 !== -1 && team2 !== -1) {
              // 홈/어웨이 번갈아가며 (라운드 기준)
              const isHome = (round % 2 === 0) !== reverseHomeAway;
              if (isHome) {
                cycleMatches.push({ home: team1, away: team2 });
              } else {
                cycleMatches.push({ home: team2, away: team1 });
              }
            }
          }
        }

        return cycleMatches;
      };

      // 4사이클: 1사이클-2사이클(반대)-3사이클-4사이클(반대)
      const cycle1 = generateCycle(teamIds, false); // 1사이클
      const cycle2 = generateCycle(teamIds, true);  // 2사이클 (홈/어웨이 반대)
      const cycle3 = generateCycle(teamIds, false); // 3사이클
      const cycle4 = generateCycle(teamIds, true);  // 4사이클 (홈/어웨이 반대)

      // 모든 경기를 순서대로 추가
      matches.push(...cycle1);
      matches.push(...cycle2);
      matches.push(...cycle3);
      matches.push(...cycle4);

      // 경기 일정 생성
      // 한국 시간 기준으로 일~금 17:00~23:59 사이에 경기
      // 토요일은 스토브리그 (경기 없음)

      const MATCH_INTERVAL_MS = 30 * 60 * 1000; // 30분 간격

      // 다음 유효한 경기 시간 찾기
      const getNextValidMatchTime = (date: Date): Date => {
        const result = new Date(date);

        while (true) {
          const dayOfWeek = result.getDay(); // 0=일, 6=토
          const hours = result.getHours();

          // 토요일이면 다음 일요일 17:00으로
          if (dayOfWeek === 6) {
            result.setDate(result.getDate() + 1);
            result.setHours(17, 0, 0, 0);
            continue;
          }

          // 17:00 이전이면 17:00으로
          if (hours < 17) {
            result.setHours(17, 0, 0, 0);
            continue;
          }

          // 자정 이후면 다음 날 17:00으로
          if (hours >= 24) {
            result.setDate(result.getDate() + 1);
            result.setHours(17, 0, 0, 0);
            continue;
          }

          break;
        }

        return result;
      };

      // 현재 시간에서 다음 유효한 경기 시간 시작
      let currentTime = getNextValidMatchTime(new Date());

      console.log(`League ${leagueId}: Generating ${matches.length} matches...`);

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];

        // 현재 시간이 유효한지 확인하고 조정
        currentTime = getNextValidMatchTime(currentTime);

        // MySQL 형식으로 변환 (한국 시간 기준)
        const year = currentTime.getFullYear();
        const month = String(currentTime.getMonth() + 1).padStart(2, '0');
        const day = String(currentTime.getDate()).padStart(2, '0');
        const hours = String(currentTime.getHours()).padStart(2, '0');
        const minutes = String(currentTime.getMinutes()).padStart(2, '0');
        const seconds = String(currentTime.getSeconds()).padStart(2, '0');
        const scheduledAtStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        if (i === 0) {
          console.log(`First match scheduled at: ${scheduledAtStr}`);
        }

        await pool.query(
          `INSERT INTO matches (league_id, home_team_id, away_team_id, scheduled_at, status)
           VALUES (?, ?, ?, ?, 'SCHEDULED')`,
          [leagueId, match.home, match.away, scheduledAtStr]
        );

        // 다음 경기 시간
        currentTime = new Date(currentTime.getTime() + MATCH_INTERVAL_MS);
      }

      console.log(`League ${leagueId}: Generated ${matches.length} matches successfully`);
    } catch (error) {
      console.error(`Failed to generate schedule for league ${leagueId}:`, error);
      throw error;
    }
  }

  // AI 선수 생성
  static async createAIPlayers(teamId: number, tier: string) {
    const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

    // 티어별 스탯 범위
    const statRanges: { [key: string]: { min: number; max: number } } = {
      'SUPER': { min: 60, max: 85 },
      'FIRST': { min: 45, max: 70 },
      'SECOND': { min: 30, max: 55 }
    };

    const range = statRanges[tier] || statRanges['SECOND'];

    for (const position of positions) {
      const name = this.generatePlayerName();
      const mental = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const teamfight = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const focus = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const laning = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

      // 선수 생성
      const playerResult = await pool.query(
        `INSERT INTO players (name, position, mental, teamfight, focus, laning)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, position, mental, teamfight, focus, laning]
      );

      // 팀에 배정 (스타터로)
      await pool.query(
        `INSERT INTO player_ownership (player_id, team_id, is_starter) VALUES (?, ?, true)`,
        [playerResult.insertId, teamId]
      );
    }
  }

  // AI 선수 이름 생성
  static generatePlayerName(): string {
    aiPlayerCounter++;
    return `AI_Player_${aiPlayerCounter}`;
  }

  // AI 선수 카운터 초기화
  static resetPlayerCounter() {
    aiPlayerCounter = 0;
  }

  // 플레이어 팀이 AI 팀을 대체
  static async replaceAITeam(playerTeamId: number) {
    try {
      // 플레이어 팀 정보 확인
      const playerTeam = await pool.query('SELECT * FROM teams WHERE id = ? AND is_ai = false', [playerTeamId]);
      if (playerTeam.length === 0) {
        throw new Error('Player team not found');
      }

      // LPO 2 LEAGUE에서 가장 낮은 순위의 AI 팀 찾기
      const aiTeam = await pool.query(
        `SELECT t.id, t.name, lp.league_id, lp.wins, lp.losses, lp.draws, lp.points, lp.goal_difference
         FROM teams t
         JOIN league_participants lp ON t.id = lp.team_id
         JOIN leagues l ON lp.league_id = l.id
         WHERE t.is_ai = true AND l.region = 'SECOND'
         ORDER BY lp.points ASC, lp.goal_difference ASC
         LIMIT 1`
      );

      if (aiTeam.length === 0) {
        throw new Error('No AI team available in LPO 2 LEAGUE');
      }

      const targetAI = aiTeam[0];

      // AI 팀 교체 기록 저장
      await pool.query(
        `INSERT INTO ai_team_replacements
         (ai_team_id, player_team_id, league_id, wins, losses, draws, points, goal_difference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [targetAI.id, playerTeamId, targetAI.league_id,
         targetAI.wins, targetAI.losses, targetAI.draws, targetAI.points, targetAI.goal_difference]
      );

      // 플레이어 팀의 tier를 SECOND로 변경
      await pool.query('UPDATE teams SET league = ? WHERE id = ?', ['SECOND', playerTeamId]);

      // AI 팀을 리그에서 제거
      await pool.query('DELETE FROM league_participants WHERE team_id = ?', [targetAI.id]);

      // 플레이어 팀을 리그에 추가 (AI 팀의 성적 그대로)
      await pool.query(
        `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [targetAI.league_id, playerTeamId,
         targetAI.wins, targetAI.losses, targetAI.draws, targetAI.points, targetAI.goal_difference]
      );

      console.log(`Player team ${playerTeamId} replaced AI team ${targetAI.name} in LPO 2 LEAGUE`);

      return {
        success: true,
        replacedTeam: targetAI.name,
        inheritedStats: {
          wins: targetAI.wins,
          losses: targetAI.losses,
          draws: targetAI.draws,
          points: targetAI.points
        }
      };

    } catch (error) {
      console.error('Failed to replace AI team:', error);
      throw error;
    }
  }

  // 승강제 처리
  static async processPromotionRelegation(season: number) {
    try {
      // 각 리그의 순위 계산
      const tiers = ['SUPER', 'FIRST', 'SECOND'];

      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];

        // 해당 티어 리그 조회
        const league = await pool.query(
          "SELECT id FROM leagues WHERE region = ? AND season = ?",
          [tier, season]
        );

        if (league.length === 0) continue;

        // 순위 정렬
        const standings = await pool.query(
          `SELECT lp.team_id, lp.points, lp.goal_difference, t.is_ai
           FROM league_participants lp
           JOIN teams t ON lp.team_id = t.id
           WHERE lp.league_id = ?
           ORDER BY lp.points DESC, lp.goal_difference DESC`,
          [league[0].id]
        );

        // 강등 (SUPER, FIRST만 - 하위 2팀)
        if (tier !== 'SECOND' && standings.length >= 2) {
          const relegatedTeams = standings.slice(-2);
          const lowerTier = tier === 'SUPER' ? 'FIRST' : 'SECOND';

          for (const team of relegatedTeams) {
            await pool.query(
              `INSERT INTO promotions_relegations (season, team_id, from_tier, to_tier, type)
               VALUES (?, ?, ?, ?, 'RELEGATION')`,
              [season, team.team_id, tier, lowerTier]
            );

            // 팀 티어 변경
            await pool.query('UPDATE teams SET league = ? WHERE id = ?', [lowerTier, team.team_id]);
          }
        }

        // 승격 (FIRST, SECOND만 - 상위 2팀)
        if (tier !== 'SUPER' && standings.length >= 2) {
          const promotedTeams = standings.slice(0, 2);
          const upperTier = tier === 'FIRST' ? 'SUPER' : 'FIRST';

          for (const team of promotedTeams) {
            await pool.query(
              `INSERT INTO promotions_relegations (season, team_id, from_tier, to_tier, type)
               VALUES (?, ?, ?, ?, 'PROMOTION')`,
              [season, team.team_id, tier, upperTier]
            );

            // 팀 티어 변경
            await pool.query('UPDATE teams SET league = ? WHERE id = ?', [upperTier, team.team_id]);
          }
        }
      }

      console.log(`Promotion/Relegation processed for season ${season}`);

    } catch (error) {
      console.error('Failed to process promotion/relegation:', error);
      throw error;
    }
  }

  // 다음 시즌 시작
  static async startNewSeason(currentSeason: number) {
    try {
      const newSeason = currentSeason + 1;

      // 승강제 먼저 처리
      await this.processPromotionRelegation(currentSeason);

      // 기존 리그 종료
      await pool.query(
        "UPDATE leagues SET status = 'OFFSEASON' WHERE season = ?",
        [currentSeason]
      );

      // 새 리그 생성
      const tiers = [
        { name: 'LPO SUPER LEAGUE', region: 'SUPER' },
        { name: 'LPO 1 LEAGUE', region: 'FIRST' },
        { name: 'LPO 2 LEAGUE', region: 'SECOND' }
      ];

      for (const tier of tiers) {
        const leagueResult = await pool.query(
          "INSERT INTO leagues (name, region, season, current_month, status) VALUES (?, ?, ?, 1, 'REGULAR')",
          [tier.name, tier.region, newSeason]
        );

        // 해당 티어 팀들을 새 리그에 등록
        const teams = await pool.query(
          'SELECT id FROM teams WHERE league = ?',
          [tier.region]
        );

        for (const team of teams) {
          await pool.query(
            `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
             VALUES (?, ?, 0, 0, 0, 0, 0)`,
            [leagueResult.insertId, team.id]
          );
        }
      }

      console.log(`Season ${newSeason} started!`);

    } catch (error) {
      console.error('Failed to start new season:', error);
      throw error;
    }
  }
}

export default LPOLeagueService;
