import pool from '../database/db.js';
import { CupService } from './cupService.js';

// AI 선수 카운터
let aiPlayerCounter = 0;

// AI 팀 이름 목록 - LPL용 (20팀)
const AI_TEAM_NAMES_LPL = [
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
  'Golden Lions',
  'Silver Knights',
  'Dark Ravens',
  'White Tigers',
  'Blue Dolphins',
  'Red Wolves',
  'Green Vipers',
  'Black Panthers',
  'Sky Hawks',
  'Ocean Sharks'
];

// AI 팀 이름 목록 - Amateur용 (20팀)
const AI_TEAM_NAMES_AMATEUR = [
  'Rising Phoenix',
  'Shadow Wolves',
  'Iron Bears',
  'Crystal Tigers',
  'Neon Hawks',
  'Cyber Lions',
  'Storm Ravens',
  'Blaze Vipers',
  'Frost Sharks',
  'Thunder Panthers',
  'Elite Foxes',
  'Prime Eagles',
  'Victory Cobras',
  'Glory Lynx',
  'Royal Falcons',
  'Apex Jaguars',
  'Nova Serpents',
  'Dragon Knights',
  'Phoenix Guard',
  'Titan Force'
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

      // AI 팀의 경기 삭제
      await pool.query(
        `DELETE FROM matches WHERE home_team_id IN (SELECT id FROM teams WHERE is_ai = true)
         OR away_team_id IN (SELECT id FROM teams WHERE is_ai = true)`
      );

      // AI 팀 삭제
      await pool.query(`DELETE FROM teams WHERE is_ai = true`);

      // 기존 LPO 리그의 경기 삭제
      await pool.query(`DELETE FROM matches WHERE league_id IN (SELECT id FROM leagues WHERE name LIKE 'LPO%')`);

      // 기존 LPO 리그 삭제
      await pool.query(`DELETE FROM leagues WHERE name LIKE 'LPO%'`);

      // LPO 리그 생성 (SOUTH/NORTH)
      const southLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO SOUTH', 'SOUTH', 1, 1, 'REGULAR')"
      );
      const northLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO NORTH', 'NORTH', 1, 1, 'REGULAR')"
      );

      // 유저 팀을 SOUTH/NORTH에 골고루 분배 (각 최대 10팀)
      const shuffledPlayers = [...playerTeams].sort(() => Math.random() - 0.5);
      const southPlayerTeams: any[] = [];
      const northPlayerTeams: any[] = [];

      for (let i = 0; i < shuffledPlayers.length; i++) {
        if (i % 2 === 0 && southPlayerTeams.length < 10) {
          southPlayerTeams.push(shuffledPlayers[i]);
        } else if (northPlayerTeams.length < 10) {
          northPlayerTeams.push(shuffledPlayers[i]);
        } else if (southPlayerTeams.length < 10) {
          southPlayerTeams.push(shuffledPlayers[i]);
        }
        // 20팀 초과는 아마추어로
      }

      // SOUTH 리그 구성
      const southAICount = 10 - southPlayerTeams.length;
      for (let i = 0; i < southAICount; i++) {
        const teamName = AI_TEAM_NAMES_LPL[i];
        const teamResult = await pool.query(
          `INSERT INTO teams (user_id, name, league, is_ai, gold, diamond, fan_count)
           VALUES (NULL, ?, 'SOUTH', true, 1000, 100, 1000)`,
          [teamName]
        );
        await this.createAIPlayers(teamResult.insertId, 'SOUTH');
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [southLeague.insertId, teamResult.insertId]
        );
      }

      for (const team of southPlayerTeams) {
        await pool.query(`UPDATE teams SET league = 'SOUTH' WHERE id = ?`, [team.id]);
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [southLeague.insertId, team.id]
        );
      }

      // NORTH 리그 구성
      const northAICount = 10 - northPlayerTeams.length;
      for (let i = 0; i < northAICount; i++) {
        const teamName = AI_TEAM_NAMES_LPL[10 + i];
        const teamResult = await pool.query(
          `INSERT INTO teams (user_id, name, league, is_ai, gold, diamond, fan_count)
           VALUES (NULL, ?, 'NORTH', true, 1000, 100, 1000)`,
          [teamName]
        );
        await this.createAIPlayers(teamResult.insertId, 'NORTH');
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [northLeague.insertId, teamResult.insertId]
        );
      }

      for (const team of northPlayerTeams) {
        await pool.query(`UPDATE teams SET league = 'NORTH' WHERE id = ?`, [team.id]);
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [northLeague.insertId, team.id]
        );
      }

      // 아마추어 리그 생성 (20팀)
      const amateurLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO AMATEUR', 'AMATEUR', 1, 1, 'REGULAR')"
      );

      // 20팀 초과 유저는 아마추어로
      const amateurPlayerTeams = shuffledPlayers.slice(20);
      const amateurAICount = 20 - amateurPlayerTeams.length;

      for (let i = 0; i < amateurAICount; i++) {
        const teamName = AI_TEAM_NAMES_AMATEUR[i];
        const teamResult = await pool.query(
          `INSERT INTO teams (user_id, name, league, is_ai, gold, diamond, fan_count)
           VALUES (NULL, ?, 'AMATEUR', true, 500, 50, 500)`,
          [teamName]
        );
        await this.createAIPlayers(teamResult.insertId, 'AMATEUR');
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [amateurLeague.insertId, teamResult.insertId]
        );
      }

      for (const team of amateurPlayerTeams) {
        await pool.query(`UPDATE teams SET league = 'AMATEUR' WHERE id = ?`, [team.id]);
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [amateurLeague.insertId, team.id]
        );
      }

      // 각 리그 스케줄 생성
      console.log('Generating match schedules...');
      await this.generateLeagueSchedule(southLeague.insertId);
      await this.generateLeagueSchedule(northLeague.insertId);
      await this.generateLeagueSchedule(amateurLeague.insertId);

      console.log('LPO League system initialized successfully!');
      console.log(`- LPO SOUTH: ${southAICount} AI teams + ${southPlayerTeams.length} player teams`);
      console.log(`- LPO NORTH: ${northAICount} AI teams + ${northPlayerTeams.length} player teams`);
      console.log(`- LPO AMATEUR: ${amateurAICount} AI teams + ${amateurPlayerTeams.length} player teams`);

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

      // 1홈 1어웨이 스케줄 생성 (라운드 로빈 방식)
      // SOUTH/NORTH: 10팀 -> 각 팀 18경기 (9팀 * 2경기)
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

      // 2사이클: 1사이클-2사이클(반대) = 각 팀당 18경기
      const cycle1 = generateCycle(teamIds, false); // 1사이클
      const cycle2 = generateCycle(teamIds, true);  // 2사이클 (홈/어웨이 반대)

      // 모든 경기를 순서대로 추가
      matches.push(...cycle1);
      matches.push(...cycle2);

      // 경기 일정 생성
      // 한국 시간 기준으로 월~토 17:00~23:30 사이에 경기
      // 일요일은 스토브리그 (경기 없음)

      const MATCH_INTERVAL_MS = 30 * 60 * 1000; // 30분 간격

      // 다음 유효한 경기 시간 찾기 (한국 시간 기준)
      const getNextValidMatchTime = (date: Date): Date => {
        let result = new Date(date.getTime());
        const now = new Date();

        // 최대 14일만 체크 (무한 루프 방지)
        let iterations = 0;
        const maxIterations = 14 * 24;

        while (iterations < maxIterations) {
          iterations++;

          // 유효한 Date인지 확인
          if (isNaN(result.getTime())) {
            console.error('Invalid date detected, resetting to now');
            result = new Date();
          }

          // 한국 시간 계산 (UTC+9)
          const kstHours = (result.getUTCHours() + 9) % 24;
          const kstDay = result.getUTCDay();
          // 9시간 더했을 때 날짜가 바뀌는지 확인
          const dayOffset = (result.getUTCHours() + 9) >= 24 ? 1 : 0;
          const adjustedDay = (kstDay + dayOffset) % 7;

          // 과거 시간이면 현재 시간으로 조정
          if (result.getTime() < now.getTime()) {
            result = new Date(now.getTime());
            continue;
          }

          // 일요일이면 다음 월요일 17:00 KST로 (스토브리그)
          if (adjustedDay === 0) {
            result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
            result.setUTCHours(8, 0, 0, 0); // 17:00 KST = 08:00 UTC
            continue;
          }

          // 17:30 KST 이전이면 17:30 KST로
          if (kstHours < 17 || (kstHours === 17 && result.getUTCMinutes() < 30)) {
            result.setUTCHours(8, 30, 0, 0); // 17:30 KST = 08:30 UTC
            // 다시 과거인지 체크
            if (result.getTime() < now.getTime()) {
              result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
            }
            continue;
          }

          // 23:30 KST 이후면 다음 날 17:30 KST로
          if (kstHours >= 24 || (kstHours === 23 && result.getUTCMinutes() > 30)) {
            result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
            result.setUTCHours(8, 30, 0, 0);
            continue;
          }

          break;
        }

        // 무한 루프 방지
        if (iterations >= maxIterations) {
          console.error('Max iterations reached in getNextValidMatchTime');
          const fallback = new Date();
          fallback.setTime(fallback.getTime() + 24 * 60 * 60 * 1000);
          fallback.setUTCHours(8, 30, 0, 0); // 17:30 KST
          return fallback;
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

        // 유효한 날짜인지 확인
        if (isNaN(currentTime.getTime())) {
          console.error(`Invalid currentTime at match ${i}, resetting to now`);
          currentTime = new Date();
        }

        // UTC를 KST로 변환하여 저장 (UTC+9)
        const kstTime = new Date(currentTime.getTime() + 9 * 60 * 60 * 1000);
        const year = kstTime.getUTCFullYear();
        const month = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(kstTime.getUTCDate()).padStart(2, '0');
        const hours = String(kstTime.getUTCHours()).padStart(2, '0');
        const minutes = String(kstTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(kstTime.getUTCSeconds()).padStart(2, '0');
        const scheduledAtStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        // NaN 체크
        if (scheduledAtStr.includes('NaN')) {
          console.error(`NaN detected in scheduledAtStr: ${scheduledAtStr}, using fallback`);
          const fallback = new Date();
          const fYear = fallback.getFullYear();
          const fMonth = String(fallback.getMonth() + 1).padStart(2, '0');
          const fDay = String(fallback.getDate()).padStart(2, '0');
          const fHours = String(fallback.getHours()).padStart(2, '0');
          const fMinutes = String(fallback.getMinutes()).padStart(2, '0');
          const fSeconds = String(fallback.getSeconds()).padStart(2, '0');
          const fallbackStr = `${fYear}-${fMonth}-${fDay} ${fHours}:${fMinutes}:${fSeconds}`;

          await pool.query(
            `INSERT INTO matches (league_id, home_team_id, away_team_id, scheduled_at, status)
             VALUES (?, ?, ?, ?, 'SCHEDULED')`,
            [leagueId, match.home, match.away, fallbackStr]
          );

          currentTime = new Date(fallback.getTime() + MATCH_INTERVAL_MS);
          continue;
        }

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

  // AI 선수 생성 (player_cards 테이블에 생성)
  static async createAIPlayers(teamId: number, tier: string) {
    const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

    // 티어별 스탯 범위 (각 스탯 기준)
    const statRanges: { [key: string]: { min: number; max: number } } = {
      'SOUTH': { min: 35, max: 70 },
      'NORTH': { min: 35, max: 70 },
      'AMATEUR': { min: 25, max: 55 }
    };

    const range = statRanges[tier] || statRanges['SOUTH'];

    for (const position of positions) {
      const name = this.generatePlayerName();
      const mental = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const teamfight = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const focus = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const laning = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const ovr = Math.round((mental + teamfight + focus + laning) / 4);

      // player_cards에 AI 가상 선수 생성 (admin.ts와 동일)
      await pool.query(
        `INSERT INTO player_cards (team_id, pro_player_id, mental, teamfight, focus, laning, ovr, card_type, is_contracted, is_starter, ai_player_name, ai_position)
         VALUES (?, NULL, ?, ?, ?, ?, ?, 'NORMAL', true, true, ?, ?)`,
        [teamId, mental, teamfight, focus, laning, ovr, name, position]
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
  static async replaceAITeam(playerTeamId: number, region: string = 'SOUTH') {
    try {
      // 플레이어 팀 정보 확인
      const playerTeam = await pool.query('SELECT * FROM teams WHERE id = ? AND is_ai = false', [playerTeamId]);
      if (playerTeam.length === 0) {
        throw new Error('Player team not found');
      }

      // 해당 리전에서 가장 낮은 순위의 AI 팀 찾기
      let aiTeam = await pool.query(
        `SELECT t.id, t.name, lp.league_id, lp.wins, lp.losses, lp.draws, lp.points, lp.goal_difference
         FROM teams t
         JOIN league_participants lp ON t.id = lp.team_id
         JOIN leagues l ON lp.league_id = l.id
         WHERE t.is_ai = true AND l.region = ?
         ORDER BY lp.points ASC, lp.goal_difference ASC
         LIMIT 1`,
        [region]
      );

      // 선택한 리전에 AI 팀이 없으면 다른 리전에서 찾기
      let actualRegion = region;
      if (aiTeam.length === 0) {
        const otherRegion = region === 'SOUTH' ? 'NORTH' : 'SOUTH';
        aiTeam = await pool.query(
          `SELECT t.id, t.name, lp.league_id, lp.wins, lp.losses, lp.draws, lp.points, lp.goal_difference
           FROM teams t
           JOIN league_participants lp ON t.id = lp.team_id
           JOIN leagues l ON lp.league_id = l.id
           WHERE t.is_ai = true AND l.region = ?
           ORDER BY lp.points ASC, lp.goal_difference ASC
           LIMIT 1`,
          [otherRegion]
        );

        if (aiTeam.length > 0) {
          actualRegion = otherRegion;
          console.log(`${region} is full, redirecting team to ${otherRegion}`);
        }
      }

      // 1부 모두 꽉 찼으면 Amateur로
      if (aiTeam.length === 0) {
        aiTeam = await pool.query(
          `SELECT t.id, t.name, lp.league_id, lp.wins, lp.losses, lp.draws, lp.points, lp.goal_difference
           FROM teams t
           JOIN league_participants lp ON t.id = lp.team_id
           JOIN leagues l ON lp.league_id = l.id
           WHERE t.is_ai = true AND l.region = 'AMATEUR'
           ORDER BY lp.points ASC, lp.goal_difference ASC
           LIMIT 1`
        );

        if (aiTeam.length > 0) {
          actualRegion = 'AMATEUR';
          console.log(`LPL is full, redirecting team to AMATEUR`);
        }
      }

      if (aiTeam.length === 0) {
        throw new Error(`No AI team available in any LPO league`);
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

      // 플레이어 팀의 tier를 실제 배정된 리전으로 변경
      await pool.query('UPDATE teams SET league = ?, region = ? WHERE id = ?', [actualRegion, actualRegion, playerTeamId]);

      // AI 팀의 선수 모두 삭제
      await pool.query('DELETE FROM player_cards WHERE team_id = ?', [targetAI.id]);

      // AI 팀을 리그에서 제거
      await pool.query('DELETE FROM league_participants WHERE team_id = ?', [targetAI.id]);

      // AI 팀 완전 삭제
      await pool.query('DELETE FROM teams WHERE id = ?', [targetAI.id]);

      // 플레이어 팀을 리그에 추가 (0-0-0 신규 팀으로 시작)
      await pool.query(
        `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
         VALUES (?, ?, 0, 0, 0, 0, 0)`,
        [targetAI.league_id, playerTeamId]
      );

      const redirected = actualRegion !== region;
      console.log(`Player team ${playerTeamId} replaced AI team ${targetAI.name} in LPO ${actualRegion}${redirected ? ' (redirected)' : ''}`);

      return {
        success: true,
        replacedTeam: targetAI.name,
        actualRegion: actualRegion,
        redirected: redirected,
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

  // 아마추어 리그 생성 (리그 없는 팀이 4팀 이상일 때)
  static async createAmateurLeague(season: number) {
    try {
      // 리그에 참가하지 않은 팀 조회
      const unassignedTeams = await pool.query(
        `SELECT t.id, t.name FROM teams t
         WHERE t.user_id IS NOT NULL
         AND t.id NOT IN (
           SELECT team_id FROM league_participants lp
           JOIN leagues l ON lp.league_id = l.id
           WHERE l.season = ?
         )`,
        [season]
      );

      if (unassignedTeams.length < 4) {
        console.log(`Not enough teams for amateur league: ${unassignedTeams.length} teams`);
        return null;
      }

      // 아마추어 리그 생성
      const amateurLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO AMATEUR LEAGUE', 'AMATEUR', ?, 1, 'REGULAR')",
        [season]
      );

      const leagueId = amateurLeague.insertId;

      // 팀들을 아마추어 리그에 등록
      for (const team of unassignedTeams) {
        await pool.query(
          `UPDATE teams SET league = 'AMATEUR' WHERE id = ?`,
          [team.id]
        );

        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [leagueId, team.id]
        );
      }

      // 경기 일정 생성
      await this.generateLeagueSchedule(leagueId);

      console.log(`Amateur league created with ${unassignedTeams.length} teams`);
      return leagueId;

    } catch (error) {
      console.error('Failed to create amateur league:', error);
      throw error;
    }
  }

  // WORLDS 진출 처리 (상위 4팀)
  static async processWorldsQualification(season: number) {
    try {
      // SOUTH와 NORTH 리그의 순위 계산
      const tiers = ['SOUTH', 'NORTH'];

      for (const tier of tiers) {
        // 해당 티어 리그 조회
        const league = await pool.query(
          "SELECT id FROM leagues WHERE region = ? AND season = ?",
          [tier, season]
        );

        if (league.length === 0) continue;

        // 순위 정렬
        const standings = await pool.query(
          `SELECT lp.team_id, lp.points, lp.goal_difference, t.is_ai, t.name
           FROM league_participants lp
           JOIN teams t ON lp.team_id = t.id
           WHERE lp.league_id = ?
           ORDER BY lp.points DESC, lp.goal_difference DESC`,
          [league[0].id]
        );

        // 상위 4팀 WORLDS 진출
        if (standings.length >= 4) {
          const qualifiedTeams = standings.slice(0, 4);

          for (const team of qualifiedTeams) {
            await pool.query(
              `INSERT INTO promotions_relegations (season, team_id, from_tier, to_tier, type)
               VALUES (?, ?, ?, ?, 'WORLDS')`,
              [season, team.team_id, tier, 'WORLDS']
            );
            console.log(`Team ${team.name} qualified for WORLDS from ${tier}`);
          }
        }
      }

      console.log(`WORLDS qualification processed for season ${season}`);

    } catch (error) {
      console.error('Failed to process WORLDS qualification:', error);
      throw error;
    }
  }

  // 다음 시즌 시작 (승격/강등 포함)
  static async startNewSeason(currentSeason: number) {
    try {
      const newSeason = currentSeason + 1;
      console.log(`Starting season ${newSeason} with promotion/relegation...`);

      // 1. 현재 시즌 리그들의 최종 순위 조회
      const currentLeagues = await pool.query(
        `SELECT id, region FROM leagues WHERE season = ? AND region IN ('SOUTH', 'NORTH', 'AMATEUR')`,
        [currentSeason]
      );

      // 강등될 팀 (SOUTH/NORTH 각 하위 1팀)
      const relegatedTeams: number[] = [];
      // 승격할 팀 (AMATEUR 상위 2팀)
      const promotedTeams: number[] = [];

      for (const league of currentLeagues) {
        const standings = await pool.query(
          `SELECT lp.team_id, t.name, t.is_ai
           FROM league_participants lp
           JOIN teams t ON lp.team_id = t.id
           WHERE lp.league_id = ?
           ORDER BY lp.points DESC, lp.goal_difference DESC`,
          [league.id]
        );

        if (league.region === 'SOUTH' || league.region === 'NORTH') {
          // 하위 1팀 강등
          if (standings.length > 0) {
            const lastTeam = standings[standings.length - 1];
            relegatedTeams.push(lastTeam.team_id);
            console.log(`Team ${lastTeam.name} relegated from ${league.region}`);
          }
        } else if (league.region === 'AMATEUR') {
          // 상위 2팀 승격
          for (let i = 0; i < Math.min(2, standings.length); i++) {
            promotedTeams.push(standings[i].team_id);
            console.log(`Team ${standings[i].name} promoted from AMATEUR`);
          }
        }
      }

      // 2. 팀 리그 재배정
      // 강등팀 -> AMATEUR
      for (const teamId of relegatedTeams) {
        await pool.query(`UPDATE teams SET league = 'AMATEUR' WHERE id = ?`, [teamId]);
      }

      // 승격팀 -> SOUTH/NORTH (번갈아 배정)
      for (let i = 0; i < promotedTeams.length; i++) {
        const targetLeague = i === 0 ? 'SOUTH' : 'NORTH';
        await pool.query(`UPDATE teams SET league = ? WHERE id = ?`, [targetLeague, promotedTeams[i]]);
      }

      // 3. 기존 리그 종료
      await pool.query(
        "UPDATE leagues SET status = 'FINISHED' WHERE season = ?",
        [currentSeason]
      );

      // 4. 새 시즌 리그 생성
      // SOUTH 리그
      const southLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO SOUTH', 'SOUTH', ?, 1, 'REGULAR')",
        [newSeason]
      );

      // NORTH 리그
      const northLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO NORTH', 'NORTH', ?, 1, 'REGULAR')",
        [newSeason]
      );

      // AMATEUR 리그
      const amateurLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO AMATEUR', 'AMATEUR', ?, 1, 'REGULAR')",
        [newSeason]
      );

      // 5. SOUTH 팀 등록 (최대 10팀, 부족하면 AI 추가)
      const southTeams = await pool.query(`SELECT id FROM teams WHERE league = 'SOUTH'`);
      for (const team of southTeams) {
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [southLeague.insertId, team.id]
        );
      }
      // AI 팀으로 10팀 채우기
      const southAINeeded = 10 - southTeams.length;
      for (let i = 0; i < southAINeeded; i++) {
        const teamName = AI_TEAM_NAMES_LPL[i] + ` S${newSeason}`;
        const teamResult = await pool.query(
          `INSERT INTO teams (user_id, name, league, is_ai, gold, diamond, fan_count)
           VALUES (NULL, ?, 'SOUTH', true, 1000, 100, 1000)`,
          [teamName]
        );
        await this.createAIPlayers(teamResult.insertId, 'SOUTH');
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [southLeague.insertId, teamResult.insertId]
        );
      }

      // 6. NORTH 팀 등록
      const northTeams = await pool.query(`SELECT id FROM teams WHERE league = 'NORTH'`);
      for (const team of northTeams) {
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [northLeague.insertId, team.id]
        );
      }
      const northAINeeded = 10 - northTeams.length;
      for (let i = 0; i < northAINeeded; i++) {
        const teamName = AI_TEAM_NAMES_LPL[10 + i] + ` S${newSeason}`;
        const teamResult = await pool.query(
          `INSERT INTO teams (user_id, name, league, is_ai, gold, diamond, fan_count)
           VALUES (NULL, ?, 'NORTH', true, 1000, 100, 1000)`,
          [teamName]
        );
        await this.createAIPlayers(teamResult.insertId, 'NORTH');
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [northLeague.insertId, teamResult.insertId]
        );
      }

      // 7. AMATEUR 팀 등록 (20팀)
      const amateurTeams = await pool.query(`SELECT id FROM teams WHERE league = 'AMATEUR'`);
      for (const team of amateurTeams) {
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [amateurLeague.insertId, team.id]
        );
      }
      const amateurAINeeded = 20 - amateurTeams.length;
      for (let i = 0; i < amateurAINeeded; i++) {
        const teamName = AI_TEAM_NAMES_AMATEUR[i % 20] + ` S${newSeason}`;
        const teamResult = await pool.query(
          `INSERT INTO teams (user_id, name, league, is_ai, gold, diamond, fan_count)
           VALUES (NULL, ?, 'AMATEUR', true, 500, 50, 500)`,
          [teamName]
        );
        await this.createAIPlayers(teamResult.insertId, 'AMATEUR');
        await pool.query(
          `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
           VALUES (?, ?, 0, 0, 0, 0, 0)`,
          [amateurLeague.insertId, teamResult.insertId]
        );
      }

      // 8. 경기 일정 생성
      console.log('Generating match schedules...');
      await this.generateLeagueSchedule(southLeague.insertId);
      await this.generateLeagueSchedule(northLeague.insertId);
      await this.generateLeagueSchedule(amateurLeague.insertId);

      console.log(`Season ${newSeason} started!`);
      console.log(`- LPO SOUTH: ${southTeams.length} teams + ${southAINeeded} AI`);
      console.log(`- LPO NORTH: ${northTeams.length} teams + ${northAINeeded} AI`);
      console.log(`- LPO AMATEUR: ${amateurTeams.length} teams + ${amateurAINeeded} AI`);
      console.log(`- Relegated: ${relegatedTeams.length} teams`);
      console.log(`- Promoted: ${promotedTeams.length} teams`);

    } catch (error) {
      console.error('Failed to start new season:', error);
      throw error;
    }
  }
}

export default LPOLeagueService;
