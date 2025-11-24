import { Server } from 'socket.io';
import pool from '../database/db.js';
import cron from 'node-cron';
import { giveMatchExperience } from './playerService.js';
import { checkInjuryAfterMatch, getInjuryPenalty } from './injuryService.js';
import { EventService } from './eventService.js';
import { NewsService } from './newsService.js';

// 롤 게임 상수 (실제 프로 경기 기준)
const GAME_CONSTANTS = {
  // 시간 (초 단위, 실제 1초 = 게임 10초)
  RIFT_HERALD_SPAWN: 480,      // 8분
  FIRST_HERALD_DESPAWN: 1140,  // 19분 (첫 전령 사라짐)
  SECOND_HERALD_SPAWN: 840,    // 14분 (두번째 전령)
  DRAGON_SPAWN: 300,           // 5분
  DRAGON_RESPAWN: 300,         // 5분
  BARON_SPAWN: 1200,           // 20분 (실제 롤)
  BARON_RESPAWN: 360,          // 6분
  ELDER_DRAGON_SPAWN: 2100,    // 35분 (4용 이후)

  // 포탑 체력
  TURRET_HP: 3000,
  INHIBITOR_HP: 2000,
  NEXUS_HP: 5000,

  // 프로 경기 통계 기준 (15~45분)
  AVG_GAME_TIME_MIN: 15,       // 최소 15분
  AVG_GAME_TIME_MAX: 45,       // 최대 45분
  AVG_TOTAL_KILLS_MIN: 15,     // 양팀 합산 최소 킬
  AVG_TOTAL_KILLS_MAX: 25,     // 양팀 합산 최대 킬

  // 게임 페이즈 (분)
  EARLY_GAME_END: 15,          // 초반전 종료
  MID_GAME_END: 25,            // 중반전 종료
};

// 게임 페이즈별 특성
const GAME_PHASES = {
  EARLY: {
    name: '초반',
    killChance: 0.03,          // 낮은 킬 확률 (라인전, CS 파밍)
    expectedKills: { min: 3, max: 6 },  // 양팀 합산 3-6킬
    events: ['LANE_KILL', 'GANK', 'FIRST_BLOOD'],
    objectives: ['FIRST_DRAGON', 'HERALD']
  },
  MID: {
    name: '중반',
    killChance: 0.08,          // 중간 킬 확률 (스커미시, 오브젝트 싸움)
    expectedKills: { min: 5, max: 12 }, // 양팀 합산 5-12킬
    events: ['SKIRMISH', 'OBJECTIVE_FIGHT', 'TURRET_DIVE'],
    objectives: ['DRAGON', 'HERALD', 'FIRST_BARON']
  },
  LATE: {
    name: '후반',
    killChance: 0.12,          // 높은 킬 확률 (한타, 바론/소울 싸움)
    expectedKills: { min: 5, max: 10 }, // 양팀 합산 5-10킬
    events: ['TEAMFIGHT', 'BARON_FIGHT', 'SOUL_FIGHT', 'ELDER_FIGHT'],
    objectives: ['BARON', 'ELDER', 'SOUL']
  }
};

// 포탑 구조
interface TurretState {
  top: { t1: boolean; t2: boolean; t3: boolean; inhib: boolean };
  mid: { t1: boolean; t2: boolean; t3: boolean; inhib: boolean };
  bot: { t1: boolean; t2: boolean; t3: boolean; inhib: boolean };
  nexus: { twin1: boolean; twin2: boolean; nexus: boolean };
}

// 리스폰 정보 인터페이스
interface RespawnInfo {
  playerId: number;
  playerName: string;
  team: 'home' | 'away';
  respawnAt: number;  // 부활할 게임 시간
}

// 경기 상태 인터페이스
interface MatchState {
  game_time: number;
  home_score: number;
  away_score: number;
  events: any[];

  // 세트 정보
  current_set: number;
  home_set_wins: number;
  away_set_wins: number;
  max_sets: number;  // 리그전: 3, 플레이오프: 5
  sets_to_win: number;  // 리그전: 2, 플레이오프: 3

  // 팀별 상태
  home: {
    kills: number;
    gold: number;
    dragons: string[];
    barons: number;
    heralds: number;
    turrets: TurretState;
  };
  away: {
    kills: number;
    gold: number;
    dragons: string[];
    barons: number;
    heralds: number;
    turrets: TurretState;
  };

  // 오브젝트 상태
  dragon_alive: boolean;
  dragon_respawn_at: number;
  baron_alive: boolean;
  baron_respawn_at: number;
  herald_alive: boolean;
  herald_taken: boolean;
  elder_available: boolean;

  // 리스폰 대기 중인 선수들
  deadPlayers: RespawnInfo[];

  // 버프 상태
  baron_buff_team: 'home' | 'away' | null;
  baron_buff_until: number;
  elder_buff_team: 'home' | 'away' | null;
  elder_buff_until: number;

  // 경기 종료 조건
  game_over: boolean;
  winner: string | null;
  max_game_time: number;  // 15~90분 랜덤
  match_finished: boolean;  // 전체 매치 종료 여부
}

export async function initializeMatchSimulation(io: Server) {
  // 매 1분마다 경기 진행 확인
  cron.schedule('* * * * *', async () => {
    await processScheduledMatches(io);
  });

  // 매 1초마다 진행 중인 경기 업데이트 (1초 = 게임 10초)
  cron.schedule('* * * * * *', async () => {
    await updateLiveMatches(io);
  });

  console.log('Match simulation system initialized (1초=6초 진행)');
}

// 특정 경기를 즉시 시작 (테스트용)
export async function startMatchById(matchId: number, io: Server) {
  try {
    const matches = await pool.query(
      'SELECT * FROM matches WHERE id = ?',
      [matchId]
    );

    if (matches.length === 0) {
      console.error(`Match ${matchId} not found`);
      return false;
    }

    await startMatch(matches[0], io);
    return true;
  } catch (error) {
    console.error(`Error starting match ${matchId}:`, error);
    return false;
  }
}

async function processScheduledMatches(io: Server) {
  try {
    // 현재 KST 시간 계산 (UTC+9)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstTime = new Date(now.getTime() + kstOffset);

    // KST 시간을 문자열로 변환 (YYYY-MM-DD HH:mm:ss 형식)
    const year = kstTime.getUTCFullYear();
    const month = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kstTime.getUTCDate()).padStart(2, '0');
    const hours = String(kstTime.getUTCHours()).padStart(2, '0');
    const minutes = String(kstTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(kstTime.getUTCSeconds()).padStart(2, '0');
    const kstNowStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    // 예정된 경기 중 시작 시간이 된 경기 찾기 (KST 기준)
    const matches = await pool.query(
      `SELECT * FROM matches
       WHERE status = 'SCHEDULED'
       AND scheduled_at <= ?
       LIMIT 10`,
      [kstNowStr]
    );

    if (matches.length > 0) {
      console.log(`[${kstNowStr}] Found ${matches.length} scheduled matches to start`);
    }

    for (const match of matches) {
      await startMatch(match, io);
    }
  } catch (error) {
    console.error('Error processing scheduled matches:', error);
  }
}

async function startMatch(match: any, io: Server) {
  try {
    // 팀이 AI인지 확인 (user_id가 NULL이면 AI 팀)
    const homeTeamInfo = await pool.query('SELECT user_id FROM teams WHERE id = ?', [match.home_team_id]);
    const awayTeamInfo = await pool.query('SELECT user_id FROM teams WHERE id = ?', [match.away_team_id]);

    const isHomeAI = !homeTeamInfo[0]?.user_id;
    const isAwayAI = !awayTeamInfo[0]?.user_id;

    // 홈팀 선수 가져오기 (AI 가상 선수 포함)
    let homePlayers;
    if (isHomeAI) {
      // AI 팀: is_starter = true인 선수 (가상 선수 포함)
      homePlayers = await pool.query(
        `SELECT pc.id,
                COALESCE(pp.name, pc.ai_player_name) as name,
                COALESCE(pp.team, 'AI') as team,
                COALESCE(pp.position, pc.ai_position) as position,
                COALESCE(pp.league, 'AI') as league,
                COALESCE(pp.nationality, 'KR') as nationality,
                pc.mental, pc.teamfight, pc.focus, pc.laning, pc.ovr
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ? AND pc.is_contracted = true AND pc.is_starter = true
         ORDER BY FIELD(COALESCE(pp.position, pc.ai_position), 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')`,
        [match.home_team_id]
      );
    } else {
      // 유저 팀: is_starter = true인 선수만
      homePlayers = await pool.query(
        `SELECT pc.id,
                COALESCE(pp.name, pc.ai_player_name) as name,
                COALESCE(pp.team, 'AI') as team,
                COALESCE(pp.position, pc.ai_position) as position,
                COALESCE(pp.league, 'AI') as league,
                COALESCE(pp.nationality, 'KR') as nationality,
                pc.mental, pc.teamfight, pc.focus, pc.laning, pc.ovr
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ? AND pc.is_starter = true AND pc.is_contracted = true
         ORDER BY FIELD(COALESCE(pp.position, pc.ai_position), 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')`,
        [match.home_team_id]
      );
    }

    // 어웨이팀 선수 가져오기 (AI 가상 선수 포함)
    let awayPlayers;
    if (isAwayAI) {
      // AI 팀: is_starter = true인 선수 (가상 선수 포함)
      awayPlayers = await pool.query(
        `SELECT pc.id,
                COALESCE(pp.name, pc.ai_player_name) as name,
                COALESCE(pp.team, 'AI') as team,
                COALESCE(pp.position, pc.ai_position) as position,
                COALESCE(pp.league, 'AI') as league,
                COALESCE(pp.nationality, 'KR') as nationality,
                pc.mental, pc.teamfight, pc.focus, pc.laning, pc.ovr
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ? AND pc.is_contracted = true AND pc.is_starter = true
         ORDER BY FIELD(COALESCE(pp.position, pc.ai_position), 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')`,
        [match.away_team_id]
      );
    } else {
      // 유저 팀: is_starter = true인 선수만
      awayPlayers = await pool.query(
        `SELECT pc.id,
                COALESCE(pp.name, pc.ai_player_name) as name,
                COALESCE(pp.team, 'AI') as team,
                COALESCE(pp.position, pc.ai_position) as position,
                COALESCE(pp.league, 'AI') as league,
                COALESCE(pp.nationality, 'KR') as nationality,
                pc.mental, pc.teamfight, pc.focus, pc.laning, pc.ovr
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ? AND pc.is_starter = true AND pc.is_contracted = true
         ORDER BY FIELD(COALESCE(pp.position, pc.ai_position), 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')`,
        [match.away_team_id]
      );
    }

    // 스타터 5명 체크 - 기권패 처리
    const homeStarterCount = homePlayers.length;
    const awayStarterCount = awayPlayers.length;

    if (homeStarterCount < 5 || awayStarterCount < 5) {
      // 기권패 처리
      let homeScore = 0;
      let awayScore = 0;

      if (homeStarterCount < 5 && awayStarterCount < 5) {
        // 양팀 모두 기권 - 무승부
        homeScore = 0;
        awayScore = 0;
      } else if (homeStarterCount < 5) {
        // 홈팀 기권패
        homeScore = 0;
        awayScore = 2;
      } else {
        // 원정팀 기권패
        homeScore = 2;
        awayScore = 0;
      }

      await pool.query(
        `UPDATE matches SET status = 'FINISHED', home_score = ?, away_score = ?,
         started_at = NOW(), finished_at = NOW(),
         match_data = '{"forfeit": true, "reason": "스타터 미선발로 인한 기권패"}'
         WHERE id = ?`,
        [homeScore, awayScore, match.id]
      );

      // 리그 순위 업데이트 (기권패)
      if (match.league_id) {
        if (homeScore > awayScore) {
          await pool.query('UPDATE league_participants SET wins = wins + 1, points = points + 3 WHERE league_id = ? AND team_id = ?', [match.league_id, match.home_team_id]);
          await pool.query('UPDATE league_participants SET losses = losses + 1 WHERE league_id = ? AND team_id = ?', [match.league_id, match.away_team_id]);
        } else if (awayScore > homeScore) {
          await pool.query('UPDATE league_participants SET wins = wins + 1, points = points + 3 WHERE league_id = ? AND team_id = ?', [match.league_id, match.away_team_id]);
          await pool.query('UPDATE league_participants SET losses = losses + 1 WHERE league_id = ? AND team_id = ?', [match.league_id, match.home_team_id]);
        }
      }

      io.to(`match_${match.id}`).emit('match_finished', {
        match_id: match.id,
        home_score: homeScore,
        away_score: awayScore,
        forfeit: true
      });

      console.log(`Match ${match.id} ended by forfeit: Home ${homeScore} - ${awayScore} Away`);
      return;
    }

    // 경기 상태를 LIVE로 변경
    await pool.query(
      'UPDATE matches SET status = "LIVE", started_at = NOW() WHERE id = ?',
      [match.id]
    );

    // 포탑 초기 상태 (모두 살아있음)
    const initialTurrets: TurretState = {
      top: { t1: true, t2: true, t3: true, inhib: true },
      mid: { t1: true, t2: true, t3: true, inhib: true },
      bot: { t1: true, t2: true, t3: true, inhib: true },
      nexus: { twin1: true, twin2: true, nexus: true }
    };

    // 경기 시간 30~35분 (프로 경기 평균, 초 단위)
    const maxGameTime = (GAME_CONSTANTS.AVG_GAME_TIME_MIN +
      Math.floor(Math.random() * (GAME_CONSTANTS.AVG_GAME_TIME_MAX - GAME_CONSTANTS.AVG_GAME_TIME_MIN + 1))) * 60;

    // 세트 설정: 플레이오프는 5판3선, 그 외는 3판2선
    const isPlayoff = match.match_type === 'PLAYOFF';
    const maxSets = isPlayoff ? 5 : 3;
    const setsToWin = isPlayoff ? 3 : 2;

    // 경기 데이터 초기화 (롤 시스템)
    const matchData: MatchState = {
      game_time: 0,
      home_score: 0,
      away_score: 0,
      events: [],

      // 세트 정보
      current_set: 1,
      home_set_wins: 0,
      away_set_wins: 0,
      max_sets: maxSets,
      sets_to_win: setsToWin,

      home: {
        kills: 0,
        gold: 500 * 5, // 시작 골드
        dragons: [],
        barons: 0,
        heralds: 0,
        turrets: JSON.parse(JSON.stringify(initialTurrets))
      },
      away: {
        kills: 0,
        gold: 500 * 5,
        dragons: [],
        barons: 0,
        heralds: 0,
        turrets: JSON.parse(JSON.stringify(initialTurrets))
      },

      dragon_alive: false,
      dragon_respawn_at: GAME_CONSTANTS.DRAGON_SPAWN,
      baron_alive: false,
      baron_respawn_at: GAME_CONSTANTS.BARON_SPAWN,
      herald_alive: false,
      herald_taken: false,
      elder_available: false,

      // 리스폰 대기 중인 선수들
      deadPlayers: [],

      // 버프 상태
      baron_buff_team: null,
      baron_buff_until: 0,
      elder_buff_team: null,
      elder_buff_until: 0,

      game_over: false,
      winner: null,
      max_game_time: maxGameTime,
      match_finished: false
    };

    await pool.query(
      'UPDATE matches SET match_data = ? WHERE id = ?',
      [JSON.stringify(matchData), match.id]
    );

    // 경기 시작 이벤트
    io.to(`match_${match.id}`).emit('match_started', {
      match_id: match.id,
      home_players: homePlayers,
      away_players: awayPlayers
    });

    // player_cards 시스템에서는 is_starter=true인 선수만 조회하므로 추가 필터링 불필요
    // 이미 스타터 5명 체크를 통과했으므로 바로 사용
    const availableHomePlayers = homePlayers;
    const availableAwayPlayers = awayPlayers;

    // 기존 match_stats 삭제 후 새로 생성 (중복 방지)
    await pool.query('DELETE FROM match_stats WHERE match_id = ?', [match.id]);

    // 경기 통계 초기화
    for (const player of availableHomePlayers) {
      await pool.query(
        `INSERT INTO match_stats (match_id, player_id, team_id, kills, deaths, assists, cs, gold_earned, damage_dealt, damage_taken, vision_score, wards_placed, wards_destroyed, turret_kills, first_blood)
         VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, FALSE)`,
        [match.id, player.id, match.home_team_id]
      );
    }
    for (const player of availableAwayPlayers) {
      await pool.query(
        `INSERT INTO match_stats (match_id, player_id, team_id, kills, deaths, assists, cs, gold_earned, damage_dealt, damage_taken, vision_score, wards_placed, wards_destroyed, turret_kills, first_blood)
         VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, FALSE)`,
        [match.id, player.id, match.away_team_id]
      );
    }
  } catch (error) {
    console.error('Error starting match:', error);
  }
}

async function updateLiveMatches(io: Server) {
  try {
    const matches = await pool.query(
      "SELECT * FROM matches WHERE status = 'LIVE'"
    );

    for (const match of matches) {
      await simulateMatchProgress(match, io);
    }
  } catch (error) {
    console.error('Error updating live matches:', error);
  }
}

async function simulateMatchProgress(match: any, io: Server) {
  try {
    // matchData 파싱
    let matchData: MatchState;
    if (!match.match_data) {
      console.error('No match_data for match', match.id);
      return;
    } else if (typeof match.match_data === 'string') {
      matchData = JSON.parse(match.match_data);
    } else {
      matchData = JSON.parse(JSON.stringify(match.match_data));
    }

    // 이미 종료된 경기는 스킵
    if (matchData.game_over) {
      await finishMatch(match, matchData, io);
      return;
    }

    // 시간 진행 (1초 = 10초) - 15~45분 게임 = 약 1.5~4.5분 실시간
    matchData.game_time += 10;
    const gameTime = matchData.game_time;
    const gameMinutes = Math.floor(gameTime / 60);

    // 리스폰 처리: 부활 시간이 된 선수들 제거
    if (!matchData.deadPlayers) {
      matchData.deadPlayers = [];
    }
    matchData.deadPlayers = matchData.deadPlayers.filter(dp => dp.respawnAt > gameTime);

    // 각 팀의 죽은 선수 수 계산
    const homeDeadCount = matchData.deadPlayers.filter(dp => dp.team === 'home').length;
    const awayDeadCount = matchData.deadPlayers.filter(dp => dp.team === 'away').length;

    // 팀이 AI인지 확인 (user_id가 NULL이면 AI 팀)
    const homeTeamInfo = await pool.query('SELECT user_id FROM teams WHERE id = ?', [match.home_team_id]);
    const awayTeamInfo = await pool.query('SELECT user_id FROM teams WHERE id = ?', [match.away_team_id]);

    const isHomeAI = !homeTeamInfo[0]?.user_id;
    const isAwayAI = !awayTeamInfo[0]?.user_id;

    // 홈팀 선수 가져오기 (AI 가상 선수 포함)
    let homePlayers;
    if (isHomeAI) {
      // AI 팀: is_starter = true인 선수 (가상 선수 포함)
      homePlayers = await pool.query(
        `SELECT pc.id,
                COALESCE(pp.name, pc.ai_player_name) as name,
                COALESCE(pp.position, pc.ai_position) as position
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ? AND pc.is_contracted = true AND pc.is_starter = true
         ORDER BY FIELD(COALESCE(pp.position, pc.ai_position), 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')`,
        [match.home_team_id]
      );
    } else {
      // 유저 팀: is_starter = true인 선수만
      homePlayers = await pool.query(
        `SELECT pc.id,
                COALESCE(pp.name, pc.ai_player_name) as name,
                COALESCE(pp.position, pc.ai_position) as position
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ? AND pc.is_starter = true AND pc.is_contracted = true
         ORDER BY FIELD(COALESCE(pp.position, pc.ai_position), 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')`,
        [match.home_team_id]
      );
    }

    // 어웨이팀 선수 가져오기 (AI 가상 선수 포함)
    let awayPlayers;
    if (isAwayAI) {
      // AI 팀: is_starter = true인 선수 (가상 선수 포함)
      awayPlayers = await pool.query(
        `SELECT pc.id,
                COALESCE(pp.name, pc.ai_player_name) as name,
                COALESCE(pp.position, pc.ai_position) as position
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ? AND pc.is_contracted = true AND pc.is_starter = true
         ORDER BY FIELD(COALESCE(pp.position, pc.ai_position), 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')`,
        [match.away_team_id]
      );
    } else {
      // 유저 팀: is_starter = true인 선수만
      awayPlayers = await pool.query(
        `SELECT pc.id,
                COALESCE(pp.name, pc.ai_player_name) as name,
                COALESCE(pp.position, pc.ai_position) as position
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ? AND pc.is_starter = true AND pc.is_contracted = true
         ORDER BY FIELD(COALESCE(pp.position, pc.ai_position), 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')`,
        [match.away_team_id]
      );
    }

    if (homePlayers.length === 0 || awayPlayers.length === 0) {
      console.error('No players found for match', match.id);
      return;
    }

    // 팀 파워 계산
    const homePower = await calculateTeamOverall(match.home_team_id, gameTime);
    const awayPower = await calculateTeamOverall(match.away_team_id, gameTime);

    // 기본 승률 계산 (실력 기반)
    const baseChance = homePower / (homePower + awayPower);

    // 역전 시스템: 지고 있는 팀에게 보너스
    const homeKills = matchData.home.kills;
    const awayKills = matchData.away.kills;
    const killDiff = homeKills - awayKills;

    // 킬 차이에 따른 역전 보너스 (지고 있는 팀에게 유리)
    // 킬 차이가 클수록 지는 팀에게 더 큰 보너스
    let comebackBonus = 0;
    if (killDiff > 3) {
      // 홈팀이 이기고 있음 -> 어웨이팀에게 보너스
      comebackBonus = -Math.min(0.15, killDiff * 0.02);
    } else if (killDiff < -3) {
      // 어웨이팀이 이기고 있음 -> 홈팀에게 보너스
      comebackBonus = Math.min(0.15, Math.abs(killDiff) * 0.02);
    }

    // 죽은 선수에 따른 보너스 (상대 팀에 죽은 선수가 많으면 유리)
    // 한 명당 10% 보너스
    const deathBonus = (awayDeadCount - homeDeadCount) * 0.10;

    // 최종 승률: 0.40 ~ 0.60 범위로 더 좁힘 + 역전 보너스 + 죽은 선수 보너스
    const adjustedChance = 0.40 + (baseChance - 0.5) * 0.4 + 0.10 + comebackBonus + deathBonus;
    const homeWinChance = Math.max(0.20, Math.min(0.80, adjustedChance));

    // === 오브젝트 스폰 체크 ===

    // 드래곤 스폰 (5분) - 한 팀이 4마리 먹으면 소울 획득, 이후 장로만
    const homeDragons = matchData.home.dragons.length;
    const awayDragons = matchData.away.dragons.length;
    const soulAcquired = homeDragons >= 4 || awayDragons >= 4;

    if (gameTime >= matchData.dragon_respawn_at && !matchData.dragon_alive && !soulAcquired) {
      matchData.dragon_alive = true;
      const event = createEvent(gameTime, 'DRAGON_SPAWN', '드래곤이 출현했습니다!', {});
      matchData.events.push(event);
      io.to(`match_${match.id}`).emit('match_event', event);
    }

    // 유충 스폰 (8분)
    if (gameTime >= GAME_CONSTANTS.RIFT_HERALD_SPAWN && !matchData.herald_alive && !matchData.herald_taken) {
      matchData.herald_alive = true;
      const event = createEvent(gameTime, 'HERALD_SPAWN', '협곡의 전령이 출현했습니다!', {});
      matchData.events.push(event);
      io.to(`match_${match.id}`).emit('match_event', event);
    }

    // 바론 스폰 (25분)
    if (gameTime >= matchData.baron_respawn_at && !matchData.baron_alive) {
      matchData.baron_alive = true;
      const event = createEvent(gameTime, 'BARON_SPAWN', '바론 내셔가 출현했습니다!', {});
      matchData.events.push(event);
      io.to(`match_${match.id}`).emit('match_event', event);
    }

    // 장로 용 (4용 획득한 팀 있을 때)
    if (!matchData.elder_available &&
        (matchData.home.dragons.length >= 4 || matchData.away.dragons.length >= 4)) {
      matchData.elder_available = true;
    }

    // === 양팀 골드 증가 ===
    // 1. 패시브 수입: 분당 약 100골드 (10초당 약 17골드)
    const passiveGold = Math.floor(100 / 6);
    matchData.home.gold += passiveGold;
    matchData.away.gold += passiveGold;

    // 2. CS 골드: 5명 * 분당 8CS * CS당 20골드 = 분당 800골드 (10초당 약 133골드)
    const csGoldPerTeam = Math.floor(800 / 6);
    matchData.home.gold += csGoldPerTeam;
    matchData.away.gold += csGoldPerTeam;

    // === 이벤트 발생 ===
    const events = await generateEvents(match, matchData, homePlayers, awayPlayers, homeWinChance, gameTime, io);

    // === 선수 통계 업데이트 ===
    await updatePlayerStatsLOL(match.id, homePlayers, awayPlayers, gameTime);

    // === 경기 종료 조건 체크 ===
    // 1. 넥서스 파괴
    if (!matchData.home.turrets.nexus.nexus) {
      matchData.game_over = true;
      matchData.winner = 'away';
      matchData.away_score = 1;
    } else if (!matchData.away.turrets.nexus.nexus) {
      matchData.game_over = true;
      matchData.winner = 'home';
      matchData.home_score = 1;
    }
    // 2. 45분 이상이면 우위팀이 더 적극적으로 공격하여 빨리 끝내기 (강제 아님)
    // matchData.isLateGame = gameTime >= 2700 (45분 이상)
    // 이는 이벤트 생성 시 공격 빈도 증가에 사용됨

    // 경기 종료 처리
    if (matchData.game_over) {
      await finishMatch(match, matchData, io);
      return;
    }

    // 경기 데이터 저장
    await pool.query(
      'UPDATE matches SET match_data = ? WHERE id = ?',
      [JSON.stringify(matchData), match.id]
    );

    // 선수 통계 조회 (AI 가상 선수 포함)
    const playerStats = await pool.query(
      `SELECT ms.player_id as id,
              COALESCE(pp.name, pc.ai_player_name) as player_name,
              COALESCE(pp.position, pc.ai_position) as position,
              t.name as team_name,
              ms.kills, ms.deaths, ms.assists, ms.cs, ms.gold_earned,
              ms.damage_dealt, ms.damage_taken, ms.vision_score,
              ms.wards_placed, ms.wards_destroyed, ms.turret_kills
       FROM match_stats ms
       JOIN player_cards pc ON ms.player_id = pc.id
       LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
       JOIN teams t ON ms.team_id = t.id
       WHERE ms.match_id = ?`,
      [match.id]
    );

    // 실시간 업데이트 전송
    io.to(`match_${match.id}`).emit('match_update', {
      match_id: match.id,
      game_time: matchData.game_time,
      home: matchData.home,
      away: matchData.away,
      dragon_alive: matchData.dragon_alive,
      baron_alive: matchData.baron_alive,
      herald_alive: matchData.herald_alive,
      player_stats: playerStats,
      dead_players: matchData.deadPlayers.filter(dp => dp.respawnAt > matchData.game_time)
    });
  } catch (error) {
    console.error('Error simulating match progress:', error);
  }
}

// 간단한 이벤트 생성 헬퍼
function createEvent(time: number, type: string, description: string, data: any) {
  return { type, time, description, data };
}

// 이벤트 생성 함수
async function generateEvents(
  match: any,
  matchData: MatchState,
  homePlayers: any[],
  awayPlayers: any[],
  homeWinChance: number,
  gameTime: number,
  io: Server
) {
  const events: any[] = [];
  const gameMinutes = Math.floor(gameTime / 60);

  // 리스폰 시간 계산 함수
  const calculateRespawnTime = (currentGameTime: number): number => {
    const minutes = currentGameTime / 60;
    const level = Math.min(18, Math.floor(1 + minutes * 0.6));
    return 6 + (level - 1) * (54 / 17); // 6초 ~ 60초
  };

  // 실제 프로 경기 기반 이벤트 발생 확률
  // 목표: 양팀 합산 15-25킬 (30-35분 경기)
  let eventChance: number;
  let currentPhase: 'EARLY' | 'MID' | 'LATE';

  if (gameMinutes < GAME_CONSTANTS.EARLY_GAME_END) {
    currentPhase = 'EARLY';
    eventChance = GAME_PHASES.EARLY.killChance; // 3%
  } else if (gameMinutes < GAME_CONSTANTS.MID_GAME_END) {
    currentPhase = 'MID';
    eventChance = GAME_PHASES.MID.killChance; // 8%
  } else {
    currentPhase = 'LATE';
    eventChance = GAME_PHASES.LATE.killChance; // 12%
  }

  // 현재 총 킬 수
  const totalKills = matchData.home.kills + matchData.away.kills;

  // 킬 수가 너무 적으면 확률 증가, 너무 많으면 감소
  if (totalKills < 10 && gameMinutes > 15) {
    eventChance *= 1.5; // 킬이 적으면 확률 증가
  } else if (totalKills > 20) {
    eventChance *= 0.7; // 킬이 많으면 확률 감소
  }

  if (Math.random() > eventChance) return events;

  // 버프 만료 체크
  if (matchData.baron_buff_team && gameTime > matchData.baron_buff_until) {
    matchData.baron_buff_team = null;
  }
  if (matchData.elder_buff_team && gameTime > matchData.elder_buff_until) {
    matchData.elder_buff_team = null;
  }

  // 버프에 따른 승리 확률 조정
  let adjustedHomeWinChance = homeWinChance;
  if (matchData.baron_buff_team === 'home') {
    adjustedHomeWinChance += 0.25; // 바론 버프: +25% 승률
  } else if (matchData.baron_buff_team === 'away') {
    adjustedHomeWinChance -= 0.25;
  }
  if (matchData.elder_buff_team === 'home') {
    adjustedHomeWinChance += 0.35; // 장로용 버프: +35% 승률
  } else if (matchData.elder_buff_team === 'away') {
    adjustedHomeWinChance -= 0.35;
  }
  adjustedHomeWinChance = Math.max(0.1, Math.min(0.9, adjustedHomeWinChance));

  // 승리 팀 결정
  const winningTeam = Math.random() < adjustedHomeWinChance ? 'home' : 'away';
  const allWinningPlayers = winningTeam === 'home' ? homePlayers : awayPlayers;
  const allLosingPlayers = winningTeam === 'home' ? awayPlayers : homePlayers;
  const winningState = winningTeam === 'home' ? matchData.home : matchData.away;
  const losingState = winningTeam === 'home' ? matchData.away : matchData.home;

  // 죽은 선수 제외 (리스폰 전까지 이벤트에 참여 불가)
  const deadPlayerIds = matchData.deadPlayers
    .filter(dp => dp.respawnAt > gameTime)
    .map(dp => dp.playerId);

  const winningPlayers = allWinningPlayers.filter(p => !deadPlayerIds.includes(p.id));
  const losingPlayers = allLosingPlayers.filter(p => !deadPlayerIds.includes(p.id));

  if (winningPlayers.length === 0 || losingPlayers.length === 0) return events;

  // 프로 경기 기반 이벤트 타입 선택
  const eventPool: string[] = [];

  // 시간대별 이벤트
  if (currentPhase === 'EARLY') {
    // 초반 (0-15분): 라인전, 정글 갱킹, 첫 드래곤
    if (gameMinutes < 5) {
      // 극초반: 첫 킬 가능성
      eventPool.push('NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'KILL');
      if (totalKills === 0) eventPool.push('FIRST_BLOOD'); // 퍼스트블러드
    } else {
      eventPool.push('KILL', 'GANK', 'NOTHING', 'NOTHING');
    }
  } else if (currentPhase === 'MID') {
    // 중반 (15-25분): 스커미시, 오브젝트 싸움
    eventPool.push('KILL', 'SKIRMISH', 'TURRET');
    if (totalKills < 15) eventPool.push('KILL', 'TEAMFIGHT'); // 킬 부족하면 추가
  } else {
    // 후반 (25분+): 바론/소울 싸움, 대규모 한타
    eventPool.push('TEAMFIGHT', 'TURRET', 'INHIBITOR');
    if (totalKills < 20) eventPool.push('KILL', 'TEAMFIGHT'); // 킬 목표 달성
  }

  // 오브젝트 이벤트
  if (gameMinutes >= 5 && matchData.dragon_alive) eventPool.push('DRAGON');
  if (gameMinutes >= 8 && matchData.herald_alive) eventPool.push('HERALD');
  if (gameMinutes >= 15) eventPool.push('TURRET'); // 포탑은 15분부터
  if (gameMinutes >= 20) eventPool.push('INHIBITOR'); // 억제기는 20분부터
  if (gameMinutes >= 20 && matchData.baron_alive) eventPool.push('BARON');
  if (matchData.elder_available && matchData.dragon_alive) eventPool.push('ELDER_DRAGON');

  // 바론/장로 버프가 있으면 포탑/억제기 파괴 이벤트 대폭 증가
  if (matchData.baron_buff_team) {
    eventPool.push('TURRET', 'TURRET', 'TURRET', 'INHIBITOR', 'INHIBITOR');
  }
  if (matchData.elder_buff_team) {
    eventPool.push('TURRET', 'TURRET', 'INHIBITOR', 'INHIBITOR', 'TEAMFIGHT');
  }

  const eventType = eventPool[Math.floor(Math.random() * eventPool.length)];

  // 포지션별 킬 가중치 (ADC/MID가 가장 많이 킬을 먹음)
  const getPositionWeight = (position: string): number => {
    switch (position?.toUpperCase()) {
      case 'ADC': return 35;
      case 'MID': return 30;
      case 'JUNGLE': return 20;
      case 'TOP': return 10;
      case 'SUPPORT': return 5;
      default: return 10;
    }
  };

  // 가중치 기반 랜덤 선택
  const selectWeightedPlayer = (players: any[]): any => {
    const totalWeight = players.reduce((sum, p) => sum + getPositionWeight(p.position), 0);
    let random = Math.random() * totalWeight;

    for (const player of players) {
      random -= getPositionWeight(player.position);
      if (random <= 0) return player;
    }
    return players[players.length - 1];
  };

  const killer = selectWeightedPlayer(winningPlayers);
  const victim = losingPlayers[Math.floor(Math.random() * losingPlayers.length)];

  let event: any = null;

  switch (eventType) {
    case 'KILL':
      event = createEvent(gameTime, 'KILL', `${killer.name}(이)가 ${victim.name}(을)를 처치했습니다!`, {
        team: winningTeam,
        killer_id: killer.id,
        killer_name: killer.name,
        victim_id: victim.id,
        victim_name: victim.name
      });
      winningState.kills++;
      winningState.gold += 300;
      // DB 업데이트 - 킬
      await pool.query('UPDATE match_stats SET kills = kills + 1 WHERE match_id = ? AND player_id = ?', [match.id, killer.id]);
      await pool.query('UPDATE match_stats SET deaths = deaths + 1 WHERE match_id = ? AND player_id = ?', [match.id, victim.id]);

      // 어시스트 (킬러 제외 1-2명에게 랜덤 부여)
      const assistCandidates = winningPlayers.filter(p => p.id !== killer.id);
      const assistCount = Math.min(assistCandidates.length, 1 + Math.floor(Math.random() * 2)); // 1-2명
      const shuffled = assistCandidates.sort(() => Math.random() - 0.5);
      for (let i = 0; i < assistCount; i++) {
        await pool.query('UPDATE match_stats SET assists = assists + 1 WHERE match_id = ? AND player_id = ?', [match.id, shuffled[i].id]);
      }

      // 죽은 선수를 deadPlayers에 추가
      const respawnSec = calculateRespawnTime(gameTime);
      matchData.deadPlayers.push({
        playerId: victim.id,
        playerName: victim.name,
        team: winningTeam === 'home' ? 'away' : 'home',
        respawnAt: gameTime + respawnSec
      });
      break;

    case 'DRAGON':
      if (matchData.dragon_alive) {
        const dragonTypes = ['불', '바다', '바람', '대지', '마법공학', '화학공학'];
        const dragonType = dragonTypes[Math.floor(Math.random() * dragonTypes.length)];
        winningState.dragons.push(dragonType);
        winningState.gold += 200;
        matchData.dragon_alive = false;
        matchData.dragon_respawn_at = gameTime + GAME_CONSTANTS.DRAGON_RESPAWN;

        // 드래곤 싸움에서 킬 발생 (1-2킬)
        const dragonKills = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < dragonKills && losingPlayers.length > i; i++) {
          const dKiller = winningPlayers[Math.floor(Math.random() * winningPlayers.length)];
          const dVictim = losingPlayers[i];
          winningState.kills++;
          winningState.gold += 300;
          await pool.query('UPDATE match_stats SET kills = kills + 1 WHERE match_id = ? AND player_id = ?', [match.id, dKiller.id]);
          await pool.query('UPDATE match_stats SET deaths = deaths + 1 WHERE match_id = ? AND player_id = ?', [match.id, dVictim.id]);

          const killEvent = createEvent(gameTime - 5, 'KILL', `${dKiller.name}(이)가 ${dVictim.name}(을)를 처치했습니다!`, {
            team: winningTeam, killer_id: dKiller.id, killer_name: dKiller.name, victim_id: dVictim.id, victim_name: dVictim.name
          });
          matchData.events.push(killEvent);
          io.to(`match_${match.id}`).emit('match_event', killEvent);
        }

        // 4번째 드래곤이면 소울 획득
        if (winningState.dragons.length === 4) {
          event = createEvent(gameTime, 'DRAGON_SOUL', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 ${dragonType} 드래곤 소울을 획득했습니다!`, {
            team: winningTeam,
            dragon_type: dragonType
          });
          matchData.elder_available = true;
        } else {
          event = createEvent(gameTime, 'DRAGON', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 ${dragonType} 드래곤을 처치했습니다!`, {
            team: winningTeam,
            dragon_type: dragonType
          });
        }
      }
      break;

    case 'HERALD':
      if (matchData.herald_alive) {
        event = createEvent(gameTime, 'HERALD', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 협곡의 전령을 처치했습니다!`, {
          team: winningTeam
        });
        winningState.heralds++;
        matchData.herald_alive = false;
        matchData.herald_taken = true;

        // 전령으로 90% 확률로 포탑 파괴
        if (Math.random() < 0.9) {
          const heraldLanes = ['top', 'mid', 'bot'] as const;
          const heraldLane = heraldLanes[Math.floor(Math.random() * heraldLanes.length)];
          const enemyTurretsHerald = losingState.turrets[heraldLane];

          if (enemyTurretsHerald.t1) {
            enemyTurretsHerald.t1 = false;
            const turretEvent = createEvent(gameTime + 1, 'TURRET', `전령이 ${heraldLane} 1차 타워를 파괴했습니다!`, {
              team: winningTeam, lane: heraldLane, tier: 1
            });
            matchData.events.push(turretEvent);
            io.to(`match_${match.id}`).emit('match_event', turretEvent);
            winningState.gold += 250;
          } else if (enemyTurretsHerald.t2) {
            enemyTurretsHerald.t2 = false;
            const turretEvent = createEvent(gameTime + 1, 'TURRET', `전령이 ${heraldLane} 2차 타워를 파괴했습니다!`, {
              team: winningTeam, lane: heraldLane, tier: 2
            });
            matchData.events.push(turretEvent);
            io.to(`match_${match.id}`).emit('match_event', turretEvent);
            winningState.gold += 250;
          }
        }
      }
      break;

    case 'BARON':
      if (matchData.baron_alive) {
        // 바론 싸움에서 킬 발생 (2-4킬)
        const baronKills = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < baronKills && losingPlayers.length > i; i++) {
          const bKiller = winningPlayers[Math.floor(Math.random() * winningPlayers.length)];
          const bVictim = losingPlayers[i];
          winningState.kills++;
          winningState.gold += 300;
          await pool.query('UPDATE match_stats SET kills = kills + 1 WHERE match_id = ? AND player_id = ?', [match.id, bKiller.id]);
          await pool.query('UPDATE match_stats SET deaths = deaths + 1 WHERE match_id = ? AND player_id = ?', [match.id, bVictim.id]);

          const killEvent = createEvent(gameTime - 5, 'KILL', `${bKiller.name}(이)가 ${bVictim.name}(을)를 처치했습니다!`, {
            team: winningTeam, killer_id: bKiller.id, killer_name: bKiller.name, victim_id: bVictim.id, victim_name: bVictim.name
          });
          matchData.events.push(killEvent);
          io.to(`match_${match.id}`).emit('match_event', killEvent);
        }

        event = createEvent(gameTime, 'BARON', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 바론 내셔를 처치했습니다!`, {
          team: winningTeam
        });
        winningState.barons++;
        winningState.gold += 1500;
        matchData.baron_alive = false;
        matchData.baron_respawn_at = gameTime + GAME_CONSTANTS.BARON_RESPAWN;
        // 바론 버프 3분 지속
        matchData.baron_buff_team = winningTeam;
        matchData.baron_buff_until = gameTime + 180;
      }
      break;

    case 'ELDER_DRAGON':
      if (matchData.elder_available && matchData.dragon_alive) {
        // 장로 드래곤 싸움에서 킬 발생 (2-4킬)
        const elderKills = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < elderKills && losingPlayers.length > i; i++) {
          const eKiller = winningPlayers[Math.floor(Math.random() * winningPlayers.length)];
          const eVictim = losingPlayers[i];
          winningState.kills++;
          winningState.gold += 300;
          await pool.query('UPDATE match_stats SET kills = kills + 1 WHERE match_id = ? AND player_id = ?', [match.id, eKiller.id]);
          await pool.query('UPDATE match_stats SET deaths = deaths + 1 WHERE match_id = ? AND player_id = ?', [match.id, eVictim.id]);

          const killEvent = createEvent(gameTime - 5, 'KILL', `${eKiller.name}(이)가 ${eVictim.name}(을)를 처치했습니다!`, {
            team: winningTeam, killer_id: eKiller.id, killer_name: eKiller.name, victim_id: eVictim.id, victim_name: eVictim.name
          });
          matchData.events.push(killEvent);
          io.to(`match_${match.id}`).emit('match_event', killEvent);
        }

        event = createEvent(gameTime, 'ELDER_DRAGON', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 장로 드래곤을 처치했습니다!`, {
          team: winningTeam
        });
        winningState.gold += 500;
        matchData.dragon_alive = false;
        matchData.dragon_respawn_at = gameTime + GAME_CONSTANTS.DRAGON_RESPAWN;
        // 장로용 버프 3분 지속
        matchData.elder_buff_team = winningTeam;
        matchData.elder_buff_until = gameTime + 180;
      }
      break;

    case 'TURRET':
      // 포탑 파괴 로직
      const lanes = ['top', 'mid', 'bot'] as const;
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      const enemyTurrets = losingState.turrets[lane];

      if (enemyTurrets.t1) {
        enemyTurrets.t1 = false;
        event = createEvent(gameTime, 'TURRET', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 ${lane} 1차 타워를 파괴했습니다!`, {
          team: winningTeam, lane, tier: 1
        });
        winningState.gold += 250;
      } else if (enemyTurrets.t2) {
        enemyTurrets.t2 = false;
        event = createEvent(gameTime, 'TURRET', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 ${lane} 2차 타워를 파괴했습니다!`, {
          team: winningTeam, lane, tier: 2
        });
        winningState.gold += 250;
      } else if (enemyTurrets.t3) {
        enemyTurrets.t3 = false;
        event = createEvent(gameTime, 'TURRET', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 ${lane} 3차 타워를 파괴했습니다!`, {
          team: winningTeam, lane, tier: 3
        });
        winningState.gold += 250;
      }
      break;

    case 'INHIBITOR':
      // 억제기 파괴 (3차 타워가 파괴된 라인만)
      for (const lane of ['top', 'mid', 'bot'] as const) {
        const turrets = losingState.turrets[lane];
        if (!turrets.t3 && turrets.inhib) {
          turrets.inhib = false;
          event = createEvent(gameTime, 'INHIBITOR', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 ${lane} 억제기를 파괴했습니다!`, {
            team: winningTeam, lane
          });
          winningState.gold += 50;
          break;
        }
      }
      break;

    case 'TEAMFIGHT':
      // 이기는 팀이 더 많은 킬을 얻지만, 지는 팀도 킬을 얻음
      const winnerKills = 1 + Math.floor(Math.random() * 3); // 1-3킬
      const loserKills = Math.floor(Math.random() * 2); // 0-1킬

      // 죽은 선수 이름 선택
      const loserVictims: string[] = [];
      const winnerVictims: string[] = [];
      const loserPlayersCopy = [...losingPlayers];
      const winnerPlayersCopy = [...winningPlayers];

      for (let i = 0; i < winnerKills && loserPlayersCopy.length > 0; i++) {
        const idx = Math.floor(Math.random() * loserPlayersCopy.length);
        loserVictims.push(loserPlayersCopy.splice(idx, 1)[0].name);
      }
      for (let i = 0; i < loserKills && winnerPlayersCopy.length > 0; i++) {
        const idx = Math.floor(Math.random() * winnerPlayersCopy.length);
        winnerVictims.push(winnerPlayersCopy.splice(idx, 1)[0].name);
      }

      const loserTeamName = winningTeam === 'home' ? '레드팀' : '블루팀';
      const winnerTeamName = winningTeam === 'home' ? '블루팀' : '레드팀';

      let teamfightDesc = `한타! ${winnerTeamName} 승리!`;
      if (loserVictims.length > 0) {
        teamfightDesc += ` ${loserTeamName} ${loserVictims.join(', ')} 처치`;
      }
      if (winnerVictims.length > 0) {
        teamfightDesc += ` / ${winnerTeamName} ${winnerVictims.join(', ')} 처치`;
      }

      event = createEvent(gameTime, 'TEAMFIGHT', teamfightDesc, {
        team: winningTeam,
        winner_kills: winnerKills,
        loser_kills: loserKills,
        loser_victims: loserVictims,
        winner_victims: winnerVictims
      });
      winningState.kills += winnerKills;
      winningState.gold += winnerKills * 300;
      losingState.kills += loserKills;
      losingState.gold += loserKills * 300;

      // 죽은 선수들을 deadPlayers에 추가
      const tfRespawnSec = calculateRespawnTime(gameTime);

      // 지는 팀 희생자들
      for (const victimName of loserVictims) {
        const victimPlayer = losingPlayers.find(p => p.name === victimName);
        if (victimPlayer) {
          matchData.deadPlayers.push({
            playerId: victimPlayer.id,
            playerName: victimName,
            team: winningTeam === 'home' ? 'away' : 'home',
            respawnAt: gameTime + tfRespawnSec
          });
        }
      }

      // 이기는 팀 희생자들
      for (const victimName of winnerVictims) {
        const victimPlayer = winningPlayers.find(p => p.name === victimName);
        if (victimPlayer) {
          matchData.deadPlayers.push({
            playerId: victimPlayer.id,
            playerName: victimName,
            team: winningTeam,
            respawnAt: gameTime + tfRespawnSec
          });
        }
      }

      // 한타 승리 후 오브젝트 획득 (장로 > 바론 > 용 > 포탑)
      if (matchData.elder_available && matchData.dragon_alive) {
        // 장로용 획득
        winningState.gold += 500;
        matchData.dragon_alive = false;
        matchData.dragon_respawn_at = gameTime + GAME_CONSTANTS.DRAGON_RESPAWN;
        matchData.elder_buff_team = winningTeam;
        matchData.elder_buff_until = gameTime + 180;
      } else if (gameMinutes >= 20 && matchData.baron_alive) {
        // 바론 획득
        winningState.barons++;
        winningState.gold += 1500;
        matchData.baron_alive = false;
        matchData.baron_respawn_at = gameTime + GAME_CONSTANTS.BARON_RESPAWN;
        matchData.baron_buff_team = winningTeam;
        matchData.baron_buff_until = gameTime + 180;
      } else if (matchData.dragon_alive) {
        // 용 획득
        const dragonTypes = ['불', '바다', '바람', '대지', '마법공학', '화학공학'];
        const dragonType = dragonTypes[Math.floor(Math.random() * dragonTypes.length)];
        winningState.dragons.push(dragonType);
        winningState.gold += 200;
        matchData.dragon_alive = false;
        matchData.dragon_respawn_at = gameTime + GAME_CONSTANTS.DRAGON_RESPAWN;
        if (winningState.dragons.length === 4) {
          matchData.elder_available = true;
        }
      } else {
        // 포탑 1-3개 파괴
        const turretsToDestroy = 1 + Math.floor(Math.random() * 3);
        for (let t = 0; t < turretsToDestroy; t++) {
          const tfLanes = ['top', 'mid', 'bot'] as const;
          const tfLane = tfLanes[Math.floor(Math.random() * tfLanes.length)];
          const tfTurrets = losingState.turrets[tfLane];
          if (tfTurrets.t1) {
            tfTurrets.t1 = false;
            winningState.gold += 250;
          } else if (tfTurrets.t2) {
            tfTurrets.t2 = false;
            winningState.gold += 250;
          } else if (tfTurrets.t3) {
            tfTurrets.t3 = false;
            winningState.gold += 250;
          } else if (tfTurrets.inhib) {
            tfTurrets.inhib = false;
            winningState.gold += 50;
          }
        }
      }
      break;

    case 'FIRST_BLOOD':
      // 퍼스트블러드
      event = createEvent(gameTime, 'KILL', `⚡ FIRST BLOOD! ${killer.name}(이)가 ${victim.name}(을)를 처치했습니다!`, {
        team: winningTeam,
        killer_id: killer.id,
        killer_name: killer.name,
        victim_id: victim.id,
        victim_name: victim.name,
        first_blood: true
      });
      winningState.kills++;
      winningState.gold += 400; // 퍼블 추가 골드
      await pool.query('UPDATE match_stats SET kills = kills + 1, first_blood = TRUE WHERE match_id = ? AND player_id = ?', [match.id, killer.id]);
      await pool.query('UPDATE match_stats SET deaths = deaths + 1 WHERE match_id = ? AND player_id = ?', [match.id, victim.id]);

      // 죽은 선수 추가
      const fbRespawnSec = calculateRespawnTime(gameTime);
      matchData.deadPlayers.push({
        playerId: victim.id,
        playerName: victim.name,
        team: winningTeam === 'home' ? 'away' : 'home',
        respawnAt: gameTime + fbRespawnSec
      });
      break;

    case 'GANK':
      // 갱킹 (정글러가 킬)
      const jungler = winningPlayers.find(p => p.position === 'JUNGLE') || killer;
      event = createEvent(gameTime, 'KILL', `🗡️ ${jungler.name}(이)가 갱킹에 성공하여 ${victim.name}(을)를 처치했습니다!`, {
        team: winningTeam,
        killer_id: jungler.id,
        killer_name: jungler.name,
        victim_id: victim.id,
        victim_name: victim.name
      });
      winningState.kills++;
      winningState.gold += 350;
      await pool.query('UPDATE match_stats SET kills = kills + 1 WHERE match_id = ? AND player_id = ?', [match.id, jungler.id]);
      await pool.query('UPDATE match_stats SET deaths = deaths + 1 WHERE match_id = ? AND player_id = ?', [match.id, victim.id]);

      // 죽은 선수 추가
      const gankRespawnSec = calculateRespawnTime(gameTime);
      matchData.deadPlayers.push({
        playerId: victim.id,
        playerName: victim.name,
        team: winningTeam === 'home' ? 'away' : 'home',
        respawnAt: gameTime + gankRespawnSec
      });
      break;

    case 'SKIRMISH':
      // 소규모 교전 (2-3킬)
      const skirmishKills = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < skirmishKills && losingPlayers.length > i; i++) {
        const skKiller = winningPlayers[Math.floor(Math.random() * winningPlayers.length)];
        const skVictim = losingPlayers[i];
        winningState.kills++;
        winningState.gold += 300;
        await pool.query('UPDATE match_stats SET kills = kills + 1 WHERE match_id = ? AND player_id = ?', [match.id, skKiller.id]);
        await pool.query('UPDATE match_stats SET deaths = deaths + 1 WHERE match_id = ? AND player_id = ?', [match.id, skVictim.id]);
      }
      event = createEvent(gameTime, 'SKIRMISH', `소규모 교전! ${winningTeam === 'home' ? '블루팀' : '레드팀'}이 ${skirmishKills}킬 획득!`, {
        team: winningTeam,
        kills: skirmishKills
      });
      break;

    case 'CS':
      // CS는 updatePlayerStatsLOL에서 자동 증가하므로 이벤트만 생성 (실제 증가 없음)
      break;

    case 'GOLD':
      const goldGained = 100 + Math.floor(Math.random() * 300);
      winningState.gold += goldGained;
      event = createEvent(gameTime, 'GOLD', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 ${goldGained} 골드를 획득했습니다.`, {
        team: winningTeam,
        gold: goldGained
      });
      break;

    case 'NOTHING':
      // 아무 일도 일어나지 않음
      break;
  }

  // 쌍둥이 포탑 및 넥서스 체크
  const enemyNexusTurrets = losingState.turrets.nexus;
  const allInhibsDown = !losingState.turrets.top.inhib && !losingState.turrets.mid.inhib && !losingState.turrets.bot.inhib;

  if (allInhibsDown && (enemyNexusTurrets.twin1 || enemyNexusTurrets.twin2)) {
    if (Math.random() < 0.5) {  // 50% 확률로 증가
      if (enemyNexusTurrets.twin1) {
        enemyNexusTurrets.twin1 = false;
        event = createEvent(gameTime, 'NEXUS_TURRET', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 쌍둥이 타워를 파괴했습니다!`, {
          team: winningTeam
        });
      } else if (enemyNexusTurrets.twin2) {
        enemyNexusTurrets.twin2 = false;
        event = createEvent(gameTime, 'NEXUS_TURRET', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 쌍둥이 타워를 파괴했습니다!`, {
          team: winningTeam
        });
      }
    }
  }

  // 넥서스 공격 (쌍둥이 타워가 모두 파괴된 경우)
  if (!enemyNexusTurrets.twin1 && !enemyNexusTurrets.twin2 && enemyNexusTurrets.nexus) {
    if (Math.random() < 0.6) {  // 60% 확률로 증가
      enemyNexusTurrets.nexus = false;
      event = createEvent(gameTime, 'NEXUS_DESTROYED', `${winningTeam === 'home' ? '블루팀' : '레드팀'}이 넥서스를 파괴했습니다! 게임 종료!`, {
        team: winningTeam
      });
    }
  }

  if (event) {
    matchData.events.push(event);
    // DB에 이벤트 저장
    await pool.query(
      `INSERT INTO match_events (match_id, event_type, event_time, description, event_data)
       VALUES (?, ?, ?, ?, ?)`,
      [match.id, event.type, event.time, event.description, JSON.stringify(event.data)]
    );
    io.to(`match_${match.id}`).emit('match_event', event);
    events.push(event);
  }

  return events;
}

// 롤 스타일 선수 통계 업데이트
async function updatePlayerStatsLOL(matchId: number, homePlayers: any[], awayPlayers: any[], gameTime: number) {
  const allPlayers = [...homePlayers, ...awayPlayers];
  const gameMinutes = gameTime / 60;

  for (const player of allPlayers) {
    const position = player.position;

    // 포지션별 CS 증가율 (분당)
    // 30분 기준: ADC 280-320, MID 250-290, TOP 230-270, JG 180-220, SUP 20-35
    let csPerMin: number;

    switch (position) {
      case 'ADC':
        csPerMin = 9 + Math.random() * 1.5;  // 9-10.5/분
        break;
      case 'MID':
        csPerMin = 8 + Math.random() * 1.5;  // 8-9.5/분
        break;
      case 'TOP':
        csPerMin = 7.5 + Math.random() * 1.5;  // 7.5-9/분
        break;
      case 'JUNGLE':
        csPerMin = 6 + Math.random() * 1.5;  // 6-7.5/분 (캠프)
        break;
      case 'SUPPORT':
        // 서폿은 낮은 CS (게임 끝나면 10-50 CS)
        csPerMin = 0.4 + Math.random() * 1.2;  // 0.4-1.6/분 (30분=12-48 CS)
        break;
      default:
        csPerMin = 7 + Math.random() * 2;
    }

    // 6초마다 호출되므로 분당 값 / 10
    const csIncrease = Math.floor(csPerMin / 10 + Math.random() * 0.5);
    // 골드는 CS당 20-25골드 + 서폿은 추가 패시브 골드
    const goldPerCs = 20 + Math.random() * 5;
    const passiveGold = position === 'SUPPORT' ? 15 : 5; // 서폿은 패시브 골드 더 많음
    const goldIncrease = Math.floor(csIncrease * goldPerCs + passiveGold);

    // 딜량 (경기 끝날 때 2만~6만, 서포터는 1만 이하)
    // 30분 경기 기준 분당 ~1500-2000 딜
    const isSupport = position === 'SUPPORT';
    const damagePerMin = isSupport ? (200 + Math.random() * 100) : (600 + Math.random() * 800);
    const damageIncrease = Math.floor(damagePerMin / 10);

    // 받은 딜량
    const damageTakenPerMin = 400 + Math.random() * 400;
    const damageTakenIncrease = Math.floor(damageTakenPerMin / 10);

    await pool.query(
      `UPDATE match_stats
       SET cs = cs + ?, gold_earned = gold_earned + ?,
           damage_dealt = damage_dealt + ?, damage_taken = damage_taken + ?
       WHERE match_id = ? AND player_id = ?`,
      [csIncrease, goldIncrease, damageIncrease, damageTakenIncrease, matchId, player.id]
    );
  }
}

// 기존 updatePlayerStats는 호환성을 위해 빈 함수로 유지
async function updatePlayerStats(matchId: number, gameTime: number) {
  // 새 시스템에서는 updatePlayerStatsLOL을 사용
}

// 기존 createRandomEvent는 generateEvents로 대체됨

// 팀 전술 조회
async function getTeamTactics(teamId: number) {
  const tactics = await pool.query(
    'SELECT * FROM team_tactics WHERE team_id = ?',
    [teamId]
  );

  if (tactics.length === 0) {
    return {
      teamfight_style: 'TACTICAL',
      split_formation: '0-5-0',
      aggression_level: 'NORMAL',
      priority_objective: 'DRAGON',
      early_game_strategy: 'STANDARD'
    };
  }

  return tactics[0];
}

// 포지션별 전술 조회
async function getPositionTactics(teamId: number) {
  const tactics = await pool.query(
    'SELECT * FROM position_tactics WHERE team_id = ?',
    [teamId]
  );
  return tactics;
}

// 전술 기반 보너스 계산
function getTacticsBonus(tactics: any, gameTime: number): number {
  let bonus = 1.0;

  // 공격 성향 보너스
  switch (tactics.aggression_level) {
    case 'VERY_AGGRESSIVE':
      bonus += 0.15; // 높은 공격력, 높은 리스크
      break;
    case 'AGGRESSIVE':
      bonus += 0.08;
      break;
    case 'NORMAL':
      bonus += 0.0;
      break;
    case 'DEFENSIVE':
      bonus -= 0.05; // 낮은 공격력, 낮은 리스크
      break;
    case 'VERY_DEFENSIVE':
      bonus -= 0.10;
      break;
  }

  // 초반 전략 보너스 (10분 이전)
  if (gameTime < 600) {
    switch (tactics.early_game_strategy) {
      case 'AGGRESSIVE':
        bonus += 0.10;
        break;
      case 'SCALING':
        bonus -= 0.05; // 초반 약세
        break;
    }
  } else if (gameTime >= 1200) {
    // 후반 보너스
    if (tactics.early_game_strategy === 'SCALING') {
      bonus += 0.15; // 스케일링 팀은 후반에 강함
    }
  }

  // 한타 스타일 보너스
  switch (tactics.teamfight_style) {
    case 'BURST':
      bonus += 0.05; // 한타 시 폭발력
      break;
    case 'ORGANIC':
      bonus += 0.03; // 유동적 대응
      break;
  }

  return bonus;
}

async function calculateTeamOverall(teamId: number, gameTime: number = 0): Promise<number> {
  // player_cards + pro_players 사용
  const players = await pool.query(
    `SELECT pc.id, pc.mental, pc.teamfight, pc.focus, pc.laning, pc.ovr
     FROM player_cards pc
     WHERE pc.team_id = ? AND pc.is_starter = true AND pc.is_contracted = true`,
    [teamId]
  );

  // 전술 조회
  const tactics = await getTeamTactics(teamId);
  const tacticsBonus = getTacticsBonus(tactics, gameTime);

  let totalOverall = 0;
  for (const player of players) {
    // player_cards의 스탯 사용
    const overall = player.mental + player.teamfight + player.focus + player.laning;
    totalOverall += overall;
  }

  // 전술 보너스 적용
  return totalOverall * tacticsBonus;
}

async function finishMatch(match: any, matchData: any, io: Server) {
  try {
    // 현재 세트 승자 결정
    if (matchData.winner === 'home') {
      matchData.home_set_wins++;
    } else if (matchData.winner === 'away') {
      matchData.away_set_wins++;
    }

    // 세트 종료 이벤트
    io.to(`match_${match.id}`).emit('set_finished', {
      match_id: match.id,
      set_number: matchData.current_set,
      set_winner: matchData.winner,
      home_set_wins: matchData.home_set_wins,
      away_set_wins: matchData.away_set_wins
    });

    // 전체 매치 승패 확인
    const homeWon = matchData.home_set_wins >= matchData.sets_to_win;
    const awayWon = matchData.away_set_wins >= matchData.sets_to_win;

    if (homeWon || awayWon) {
      // 매치 종료
      matchData.match_finished = true;
      const homeScore = matchData.home_set_wins;
      const awayScore = matchData.away_set_wins;

      // 경기 종료
      await pool.query(
        'UPDATE matches SET status = "FINISHED", finished_at = NOW(), home_score = ?, away_score = ?, match_data = ? WHERE id = ?',
        [homeScore, awayScore, JSON.stringify(matchData), match.id]
      );

      // 이후 리그 점수 업데이트 등 처리
      await processMatchEnd(match, matchData, homeScore, awayScore, io);
      return;
    }

    // 다음 세트 시작
    matchData.current_set++;
    matchData.game_time = 0;
    matchData.game_over = false;
    matchData.winner = null;
    matchData.max_game_time = (15 + Math.floor(Math.random() * 76)) * 60;

    // 포탑 초기화
    const initialTurrets: TurretState = {
      top: { t1: true, t2: true, t3: true, inhib: true },
      mid: { t1: true, t2: true, t3: true, inhib: true },
      bot: { t1: true, t2: true, t3: true, inhib: true },
      nexus: { twin1: true, twin2: true, nexus: true }
    };

    // 팀 상태 초기화
    matchData.home = {
      kills: 0,
      gold: 500 * 5,
      dragons: [],
      barons: 0,
      heralds: 0,
      turrets: JSON.parse(JSON.stringify(initialTurrets))
    };
    matchData.away = {
      kills: 0,
      gold: 500 * 5,
      dragons: [],
      barons: 0,
      heralds: 0,
      turrets: JSON.parse(JSON.stringify(initialTurrets))
    };

    // 오브젝트 상태 초기화
    matchData.dragon_alive = false;
    matchData.dragon_respawn_at = GAME_CONSTANTS.DRAGON_SPAWN;
    matchData.baron_alive = false;
    matchData.baron_respawn_at = GAME_CONSTANTS.BARON_SPAWN;
    matchData.herald_alive = false;
    matchData.herald_taken = false;
    matchData.elder_available = false;

    // 죽은 선수 초기화 (새 세트)
    matchData.deadPlayers = [];

    // 이벤트 초기화 (새 세트)
    matchData.events = [];

    // match_stats 초기화 (새 세트)
    await pool.query(
      `UPDATE match_stats SET kills = 0, deaths = 0, assists = 0, cs = 0,
       gold_earned = 0, damage_dealt = 0, damage_taken = 0, vision_score = 0,
       wards_placed = 0, wards_destroyed = 0, turret_kills = 0, first_blood = false
       WHERE match_id = ?`,
      [match.id]
    );

    // 경기 데이터 저장
    await pool.query(
      'UPDATE matches SET match_data = ? WHERE id = ?',
      [JSON.stringify(matchData), match.id]
    );

    // 새 세트 시작 이벤트
    io.to(`match_${match.id}`).emit('set_started', {
      match_id: match.id,
      set_number: matchData.current_set,
      home_set_wins: matchData.home_set_wins,
      away_set_wins: matchData.away_set_wins
    });

    console.log(`Match ${match.id}: Set ${matchData.current_set} started`);
    return;
  } catch (error) {
    console.error('Error finishing match:', error);
  }
}

// 매치 종료 후 처리 (리그 점수, 보상 등)
async function processMatchEnd(match: any, matchData: any, homeScore: number, awayScore: number, io: Server) {
  try {

    // 리그 점수 업데이트 (친선전은 제외)
    if (match.match_type === 'REGULAR' && match.league_id) {
      if (homeScore > awayScore) {
        // 홈팀 승리
        await pool.query(
          'UPDATE league_participants SET wins = wins + 1, points = points + 3 WHERE league_id = ? AND team_id = ?',
          [match.league_id, match.home_team_id]
        );
        await pool.query(
          'UPDATE league_participants SET losses = losses + 1 WHERE league_id = ? AND team_id = ?',
          [match.league_id, match.away_team_id]
        );
      } else if (awayScore > homeScore) {
        // 어웨이팀 승리
        await pool.query(
          'UPDATE league_participants SET wins = wins + 1, points = points + 3 WHERE league_id = ? AND team_id = ?',
          [match.league_id, match.away_team_id]
        );
        await pool.query(
          'UPDATE league_participants SET losses = losses + 1 WHERE league_id = ? AND team_id = ?',
          [match.league_id, match.home_team_id]
        );
      } else {
        // 무승부
        await pool.query(
          'UPDATE league_participants SET draws = draws + 1, points = points + 1 WHERE league_id = ? AND team_id IN (?, ?)',
          [match.league_id, match.home_team_id, match.away_team_id]
        );
      }

      // 득실차 업데이트
      await pool.query(
        'UPDATE league_participants SET goal_difference = goal_difference + ? WHERE league_id = ? AND team_id = ?',
        [homeScore - awayScore, match.league_id, match.home_team_id]
      );
      await pool.query(
        'UPDATE league_participants SET goal_difference = goal_difference + ? WHERE league_id = ? AND team_id = ?',
        [awayScore - homeScore, match.league_id, match.away_team_id]
      );
    }

    // 경기 종료 이벤트
    io.to(`match_${match.id}`).emit('match_finished', {
      match_id: match.id,
      home_score: homeScore,
      away_score: awayScore,
      winner: homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw'
    });

    // 경기 보상
    const winnerTeamId = homeScore > awayScore ? match.home_team_id : match.away_team_id;
    const loserTeamId = homeScore > awayScore ? match.away_team_id : match.home_team_id;

    if (match.match_type === 'FRIENDLY') {
      // 친선전 보상 - 골드 + 소량 경험치
      await giveFriendlyMatchRewards(match, winnerTeamId, loserTeamId, homeScore, awayScore);
      // 경험치 지급 (친선전은 적은 양)
      await giveMatchExperience(match.id, winnerTeamId, true, 0.5);
      if (homeScore !== awayScore) {
        await giveMatchExperience(match.id, loserTeamId, false, 0.5);
      }
    } else {
      // 리그전 보상 - 입장료 수익 + 랜덤 선수 카드
      await giveLeagueMatchRewards(match, winnerTeamId, loserTeamId, homeScore, awayScore);
      await giveMatchRewards(match, winnerTeamId);
      // 경기당 승리 보너스 지급
      await giveMatchWinBonuses(winnerTeamId);
      // 경험치 지급 (팬 수에 비례)
      const homeExpMultiplier = await getExpMultiplier(match.home_team_id);
      const awayExpMultiplier = await getExpMultiplier(match.away_team_id);
      await giveMatchExperience(match.id, match.home_team_id, match.home_team_id === winnerTeamId, homeExpMultiplier);
      await giveMatchExperience(match.id, match.away_team_id, match.away_team_id === winnerTeamId, awayExpMultiplier);
    }

    // 경기 후 부상 체크 (현재 player_cards 시스템에서는 미지원)
    // TODO: player_cards에 부상 시스템 추가 시 활성화
    // const allPlayers = await pool.query(
    //   `SELECT pc.id FROM player_cards pc
    //    INNER JOIN match_stats ms ON pc.id = ms.player_id
    //    WHERE ms.match_id = ?`,
    //   [match.id]
    // );
    // for (const player of allPlayers) {
    //   await checkInjuryAfterMatch(player.id, 1.0);
    // }

    // 순위 업데이트 (리그 경기만)
    if (match.league_id) {
      await updateLeagueRankings(match.league_id);
    }

    // 뉴스 생성 (리그 경기만)
    if (match.match_type === 'REGULAR' && homeScore !== awayScore) {
      try {
        await NewsService.generateMatchNews(
          match.id,
          winnerTeamId,
          loserTeamId,
          Math.max(homeScore, awayScore),
          Math.min(homeScore, awayScore)
        );
      } catch (newsError) {
        console.error('Error generating match news:', newsError);
      }
    }

    // 벤치 선수 갈등 체크
    await EventService.checkBenchedPlayerConflicts(match.home_team_id);
    await EventService.checkBenchedPlayerConflicts(match.away_team_id);
  } catch (error) {
    console.error('Error finishing match:', error);
  }
}

async function giveMatchRewards(match: any, winnerTeamId: number) {
  try {
    // 승리 팀에게 랜덤 선수 카드 보상
    const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    const position = positions[Math.floor(Math.random() * positions.length)];

    const baseOverall = 130 + Math.floor(Math.random() * 200);
    const mental = Math.floor(baseOverall * 0.25) + Math.floor(Math.random() * 30);
    const teamfight = Math.floor(baseOverall * 0.25) + Math.floor(Math.random() * 30);
    const focus = Math.floor(baseOverall * 0.25) + Math.floor(Math.random() * 30);
    const laning = baseOverall - mental - teamfight - focus;

    const playerNames = [
      'Faker', 'Uzi', 'TheShy', 'Rookie', 'Caps', 'Perkz', 'Doublelift', 'Bjergsen',
      'Knight', 'JackeyLove', '369', 'Tian', 'Doinb', 'Crisp', 'Nuguri', 'Canyon'
    ];

    const name = playerNames[Math.floor(Math.random() * playerNames.length)] +
                 Math.floor(Math.random() * 1000).toString();

    const result = await pool.query(
      `INSERT INTO players (name, position, mental, teamfight, focus, laning, level, exp_to_next)
       VALUES (?, ?, ?, ?, ?, ?, 1, 100)`,
      [name, position, Math.min(mental, 300), Math.min(teamfight, 300), Math.min(focus, 300), Math.min(laning, 300)]
    );

    // 선수 소유권 추가
    await pool.query(
      'INSERT INTO player_ownership (player_id, team_id, is_benched) VALUES (?, ?, true)',
      [result.insertId, winnerTeamId]
    );
  } catch (error) {
    console.error('Error giving match rewards:', error);
  }
}

// 경험치 배율 계산 (팬 수 기반)
async function getExpMultiplier(teamId: number): Promise<number> {
  try {
    const teams = await pool.query(
      'SELECT fan_count FROM teams WHERE id = ?',
      [teamId]
    );

    if (teams.length === 0) return 1.0;

    const fanCount = teams[0].fan_count || 1000;
    // 팬 수에 따른 배율: 1000명 = 1.0, 10000명 = 1.5, 100000명 = 2.0
    const multiplier = 1.0 + Math.log10(fanCount / 1000) * 0.5;
    return Math.max(1.0, Math.min(3.0, multiplier)); // 1.0 ~ 3.0 사이
  } catch (error) {
    console.error('Error getting exp multiplier:', error);
    return 1.0;
  }
}

// 경기장 수용 인원 계산 (1레벨 300명, 10레벨 45000명)
function getStadiumCapacity(level: number): number {
  if (level <= 0) return 0;
  // 300 * 1.75^(level-1): 1레벨=300, 10레벨≈46000
  return Math.floor(300 * Math.pow(1.75, level - 1));
}

// 리그 경기 보상 지급 (입장료 수익)
async function giveLeagueMatchRewards(match: any, winnerTeamId: number, loserTeamId: number, homeScore: number, awayScore: number) {
  try {
    // 홈팀만 입장료 수익을 받음 (홈 경기)
    const homeTeamId = match.home_team_id;

    // 경기장 레벨 조회
    const stadiums = await pool.query(
      `SELECT level FROM team_facilities
       WHERE team_id = ? AND facility_type = 'STADIUM'`,
      [homeTeamId]
    );

    const stadiumLevel = stadiums.length > 0 ? stadiums[0].level : 0;

    if (stadiumLevel === 0) {
      // 경기장이 없으면 입장료 수익 없음
      console.log(`Team ${homeTeamId} has no stadium - no ticket revenue`);

      // 승리/패배 보너스 지급
      const winBonus = 30000;
      const loseBonus = 10000;

      if (homeScore > awayScore) {
        // 홈팀 승리
        await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [winBonus, homeTeamId]);
        await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [loseBonus, match.away_team_id]);
      } else {
        // 원정팀 승리
        await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [loseBonus, homeTeamId]);
        await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [winBonus, match.away_team_id]);
      }
      return;
    }

    // 팬 수, 민심, 입장료 조회
    const teams = await pool.query(
      'SELECT fan_count, fan_morale, ticket_price FROM teams WHERE id = ?',
      [homeTeamId]
    );

    const fanCount = teams.length > 0 ? (teams[0].fan_count || 1000) : 1000;
    const fanMorale = teams.length > 0 ? (teams[0].fan_morale || 50) : 50;
    const ticketPrice = teams.length > 0 ? (teams[0].ticket_price || 1000) : 1000;

    // 입장료 수익 계산
    // 경기장 수용 인원: 레벨별 증가 (1레벨 300명, 10레벨 45000명)
    const stadiumCapacity = getStadiumCapacity(stadiumLevel);

    // 관중 동원율: 기본 10~30% + 민심 보정
    // 민심 0: 관중 50% 감소, 민심 50: 기본, 민심 100: 관중 50% 증가
    const basePotential = 0.1 + Math.random() * 0.2; // 10~30%
    const moraleMultiplier = 0.5 + (fanMorale / 100); // 0.5 ~ 1.5

    // 입장료가 높으면 관중 감소 (기본 1000원 기준)
    const priceMultiplier = Math.max(0.3, 1 - (ticketPrice - 1000) / 10000); // 높은 가격 = 낮은 관중

    const attendanceRate = basePotential * moraleMultiplier * priceMultiplier;
    const attendance = Math.min(Math.floor(fanCount * attendanceRate), stadiumCapacity);

    // 입장료 수익
    const ticketRevenue = attendance * ticketPrice;

    // 중계권 수익 계산 (시청료)
    // 양팀 팬 수 합산으로 시청자 수 추정
    const awayTeams = await pool.query('SELECT fan_count FROM teams WHERE id = ?', [match.away_team_id]);
    const awayFanCount = awayTeams.length > 0 ? (awayTeams[0].fan_count || 1000) : 1000;
    const totalFans = fanCount + awayFanCount;

    // 방송 스튜디오 레벨 조회
    const broadcastStudios = await pool.query(
      `SELECT level FROM team_facilities
       WHERE team_id = ? AND facility_type = 'BROADCAST_STUDIO'`,
      [homeTeamId]
    );
    const broadcastLevel = broadcastStudios.length > 0 ? broadcastStudios[0].level : 0;

    // 리그 티어별 시청자 배율
    const leagues = await pool.query('SELECT region FROM leagues WHERE id = ?', [match.league_id]);
    const leagueTier = leagues.length > 0 ? leagues[0].region : 'SECOND';
    const tierMultiplier = leagueTier === 'SUPER' ? 3.0 : leagueTier === 'FIRST' ? 2.0 : 1.0;

    // 시청자 수: 팬 수의 5~15% + 방송 스튜디오 보너스
    const baseViewers = Math.floor(totalFans * (0.05 + Math.random() * 0.10) * tierMultiplier);
    const studioBonus = broadcastLevel * 0.1; // 레벨당 10% 추가
    const viewers = Math.floor(baseViewers * (1 + studioBonus));

    // 시청자당 수익 (광고 수익): 시청자 1명당 10~50골드
    const revenuePerViewer = 10 + Math.floor(Math.random() * 40);
    const broadcastRevenue = viewers * revenuePerViewer;

    // 승리 보너스
    const winBonus = 50000;
    const loseBonus = 10000;

    // 홈팀 수익 지급 (입장료 + 중계권의 60%)
    let homeGold = ticketRevenue + Math.floor(broadcastRevenue * 0.6);
    if (homeScore > awayScore) {
      homeGold += winBonus;
    } else if (awayScore > homeScore) {
      homeGold += loseBonus;
    } else {
      homeGold += 20000; // 무승부
    }

    await pool.query(
      'UPDATE teams SET gold = gold + ? WHERE id = ?',
      [homeGold, homeTeamId]
    );

    // 원정팀 수익 (중계권의 40% + 승리/패배 보너스)
    let awayGold = Math.floor(broadcastRevenue * 0.4);
    if (awayScore > homeScore) {
      awayGold += winBonus;
    } else if (homeScore > awayScore) {
      awayGold += loseBonus;
    } else {
      awayGold += 20000;
    }

    await pool.query(
      'UPDATE teams SET gold = gold + ? WHERE id = ?',
      [awayGold, match.away_team_id]
    );

    // 팬 수 및 민심 변화
    if (homeScore > awayScore) {
      // 홈팀 승리: 팬 증가, 민심 상승
      const fanIncrease = Math.floor(attendance * 0.05); // 관중의 5%가 새 팬
      const moraleIncrease = Math.floor(3 + Math.random() * 5); // 3~7 증가
      await pool.query(
        'UPDATE teams SET fan_count = fan_count + ?, fan_morale = LEAST(100, fan_morale + ?) WHERE id = ?',
        [fanIncrease, moraleIncrease, homeTeamId]
      );
      // 원정팀 패배: 민심 하락
      const moraleDrop = Math.floor(2 + Math.random() * 4); // 2~5 감소
      await pool.query(
        'UPDATE teams SET fan_morale = GREATEST(0, fan_morale - ?) WHERE id = ?',
        [moraleDrop, match.away_team_id]
      );
    } else if (awayScore > homeScore) {
      // 원정팀 승리: 팬 증가, 민심 상승
      const fanIncrease = Math.floor(100 + Math.random() * 200);
      const moraleIncrease = Math.floor(3 + Math.random() * 5);
      await pool.query(
        'UPDATE teams SET fan_count = fan_count + ?, fan_morale = LEAST(100, fan_morale + ?) WHERE id = ?',
        [fanIncrease, moraleIncrease, match.away_team_id]
      );
      // 홈팀 패배: 민심 크게 하락 (홈에서 지면 더 실망)
      const moraleDrop = Math.floor(4 + Math.random() * 6); // 4~9 감소
      await pool.query(
        'UPDATE teams SET fan_morale = GREATEST(0, fan_morale - ?) WHERE id = ?',
        [moraleDrop, homeTeamId]
      );
    } else {
      // 무승부: 민심 소폭 변화
      const moraleChange = Math.floor(Math.random() * 3) - 1; // -1 ~ 1
      await pool.query(
        'UPDATE teams SET fan_morale = LEAST(100, GREATEST(0, fan_morale + ?)) WHERE id IN (?, ?)',
        [moraleChange, homeTeamId, match.away_team_id]
      );
    }

    console.log(`League match rewards: Home ${homeTeamId} +${homeGold}G (${attendance} attendance, ${viewers} viewers), Away ${match.away_team_id} +${awayGold}G (broadcast: ${broadcastRevenue}G)`);
  } catch (error) {
    console.error('Error giving league match rewards:', error);
  }
}

// 친선전 보상 지급
async function giveFriendlyMatchRewards(match: any, winnerTeamId: number, loserTeamId: number, homeScore: number, awayScore: number) {
  try {
    // 기본 보상
    const winnerGold = 50000 + (homeScore > awayScore ? homeScore : awayScore) * 5000;
    const loserGold = 20000;

    // 승자 팀 골드 지급
    await pool.query(
      'UPDATE teams SET gold = gold + ? WHERE id = ?',
      [winnerGold, winnerTeamId]
    );

    // 패자 팀도 소량의 골드 지급 (무승부가 아닌 경우)
    if (homeScore !== awayScore) {
      await pool.query(
        'UPDATE teams SET gold = gold + ? WHERE id = ?',
        [loserGold, loserTeamId]
      );
    } else {
      // 무승부인 경우 양팀 동일 보상
      const drawGold = 35000;
      await pool.query(
        'UPDATE teams SET gold = gold + ? WHERE id IN (?, ?)',
        [drawGold, winnerTeamId, loserTeamId]
      );
    }

    console.log(`Friendly match rewards: Winner ${winnerTeamId} +${winnerGold}G, Loser ${loserTeamId} +${loserGold}G`);
  } catch (error) {
    console.error('Error giving friendly match rewards:', error);
  }
}

// 경기당 승리 보너스 지급
async function giveMatchWinBonuses(teamId: number) {
  try {
    // 승리 팀의 스타터 선수들의 승리 보너스 조회
    const starters = await pool.query(
      `SELECT id, match_win_bonus FROM player_cards
       WHERE team_id = ? AND is_starter = true AND is_contracted = true AND match_win_bonus > 0`,
      [teamId]
    );

    if (starters.length === 0) return;

    // 총 승리 보너스 계산
    let totalBonus = 0;
    for (const player of starters) {
      totalBonus += player.match_win_bonus || 0;
    }

    if (totalBonus > 0) {
      // 팀 골드에서 차감
      await pool.query(
        'UPDATE teams SET gold = gold - ? WHERE id = ?',
        [totalBonus, teamId]
      );

      console.log(`Match win bonus paid: Team ${teamId} -${totalBonus}G for ${starters.length} players`);
    }
  } catch (error) {
    console.error('Error giving match win bonuses:', error);
  }
}

async function updateLeagueRankings(leagueId: number) {
  try {
    // 순위 업데이트
    await pool.query(
      `UPDATE league_participants lp
       SET rank = (
         SELECT COUNT(*) + 1
         FROM league_participants lp2
         WHERE lp2.league_id = lp.league_id
         AND (
           (lp2.wins * 3 + lp2.draws) > (lp.wins * 3 + lp.draws)
           OR ((lp2.wins * 3 + lp2.draws) = (lp.wins * 3 + lp.draws) AND lp2.goal_difference > lp.goal_difference)
           OR ((lp2.wins * 3 + lp2.draws) = (lp.wins * 3 + lp.draws) AND lp2.goal_difference = lp.goal_difference AND lp2.wins > lp.wins)
         )
       )
       WHERE lp.league_id = ?`,
      [leagueId]
    );
  } catch (error) {
    console.error('Error updating league rankings:', error);
  }
}

