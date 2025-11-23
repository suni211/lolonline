import { Server } from 'socket.io';
import pool from '../database/db.js';
import cron from 'node-cron';
import { giveMatchExperience } from './playerService.js';
import { checkInjuryAfterMatch, getInjuryPenalty } from './injuryService.js';

const matchEvents = [
  '선수가 라인에서 CS를 먹고 있습니다.',
  '정글러가 정글 몬스터를 처치했습니다.',
  '한타가 벌어졌습니다!',
  '킬이 발생했습니다!',
  '드래곤을 처치했습니다!',
  '바론을 처치했습니다!',
  '타워가 파괴되었습니다!',
  '킬 스트릭이 이어지고 있습니다!',
  '역전의 기회가 왔습니다!',
  '압도적인 팀파이트 승리!',
];

export async function initializeMatchSimulation(io: Server) {
  // 매 1분마다 경기 진행 확인
  cron.schedule('* * * * *', async () => {
    await processScheduledMatches(io);
  });

  // 매 10초마다 진행 중인 경기 업데이트
  cron.schedule('*/10 * * * * *', async () => {
    await updateLiveMatches(io);
  });

  console.log('Match simulation system initialized');
}

async function processScheduledMatches(io: Server) {
  try {
    // 예정된 경기 중 시작 시간이 된 경기 찾기
    const matches = await pool.query(
      `SELECT * FROM matches 
       WHERE status = 'SCHEDULED' 
       AND scheduled_at <= NOW() 
       LIMIT 10`
    );

    for (const match of matches) {
      await startMatch(match, io);
    }
  } catch (error) {
    console.error('Error processing scheduled matches:', error);
  }
}

async function startMatch(match: any, io: Server) {
  try {
    // 팀 선수 정보 가져오기 (스타터 체크) - player_cards + pro_players JOIN
    const homePlayers = await pool.query(
      `SELECT pc.id, pp.name, pp.team, pp.position, pp.league, pp.nationality,
              pc.mental, pc.teamfight, pc.focus, pc.laning, pc.ovr
       FROM player_cards pc
       JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.team_id = ? AND pc.is_starter = true AND pc.is_contracted = true
       ORDER BY pp.position`,
      [match.home_team_id]
    );

    const awayPlayers = await pool.query(
      `SELECT pc.id, pp.name, pp.team, pp.position, pp.league, pp.nationality,
              pc.mental, pc.teamfight, pc.focus, pc.laning, pc.ovr
       FROM player_cards pc
       JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.team_id = ? AND pc.is_starter = true AND pc.is_contracted = true
       ORDER BY pp.position`,
      [match.away_team_id]
    );

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

    // 경기 데이터 초기화
    const matchData = {
      home_score: 0,
      away_score: 0,
      game_time: 0,
      events: []
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
    let matchData;
    if (!match.match_data) {
      matchData = {
        game_time: 0,
        home_score: 0,
        away_score: 0,
        events: [],
        player_stats: {}
      };
    } else if (typeof match.match_data === 'string') {
      matchData = JSON.parse(match.match_data);
    } else {
      // 객체인 경우 깊은 복사로 새 객체 생성
      matchData = JSON.parse(JSON.stringify(match.match_data));
    }

    // 필드가 없으면 초기화
    if (typeof matchData.game_time !== 'number') matchData.game_time = 0;
    if (typeof matchData.home_score !== 'number') matchData.home_score = 0;
    if (typeof matchData.away_score !== 'number') matchData.away_score = 0;
    if (!Array.isArray(matchData.events)) matchData.events = [];
    
    matchData.game_time += 10; // 10초씩 진행

    // 경기 시간이 30분(1800초) 이상이면 종료
    if (matchData.game_time >= 1800) {
      await finishMatch(match, matchData, io);
      return;
    }

    // 선수 통계 업데이트 (CS, 골드 등 지속적으로 증가)
    await updatePlayerStats(match.id, matchData.game_time);

    // 랜덤 이벤트 발생 (10% 확률)
    if (Math.random() < 0.1) {
      const event = await createRandomEvent(match, matchData.game_time);
      if (event) {
        matchData.events.push(event);
        
        // 이벤트를 데이터베이스에 저장
        await pool.query(
          `INSERT INTO match_events (match_id, event_type, event_time, description, event_data)
           VALUES (?, ?, ?, ?, ?)`,
          [match.id, event.type, event.time, event.description, JSON.stringify(event.data)]
        );

        // 실시간 이벤트 전송
        io.to(`match_${match.id}`).emit('match_event', event);

        // 점수 및 통계 업데이트
        if (event.type === 'KILL') {
          if (event.data.team === 'home') {
            matchData.home_score++;
            // 킬 통계 업데이트
            if (event.data.killer_id) {
              await pool.query(
                'UPDATE match_stats SET kills = kills + 1 WHERE match_id = ? AND player_id = ?',
                [match.id, event.data.killer_id]
              );
            }
            if (event.data.victim_id) {
              await pool.query(
                'UPDATE match_stats SET deaths = deaths + 1 WHERE match_id = ? AND player_id = ?',
                [match.id, event.data.victim_id]
              );
            }
            // 어시스트 업데이트
            if (event.data.assist_ids) {
              for (const assistId of event.data.assist_ids) {
                await pool.query(
                  'UPDATE match_stats SET assists = assists + 1 WHERE match_id = ? AND player_id = ?',
                  [match.id, assistId]
                );
              }
            }
          } else {
            matchData.away_score++;
            if (event.data.killer_id) {
              await pool.query(
                'UPDATE match_stats SET kills = kills + 1 WHERE match_id = ? AND player_id = ?',
                [match.id, event.data.killer_id]
              );
            }
            if (event.data.victim_id) {
              await pool.query(
                'UPDATE match_stats SET deaths = deaths + 1 WHERE match_id = ? AND player_id = ?',
                [match.id, event.data.victim_id]
              );
            }
            if (event.data.assist_ids) {
              for (const assistId of event.data.assist_ids) {
                await pool.query(
                  'UPDATE match_stats SET assists = assists + 1 WHERE match_id = ? AND player_id = ?',
                  [match.id, assistId]
                );
              }
            }
          }
        }
      }
    }

    // 경기 데이터 업데이트
    await pool.query(
      'UPDATE matches SET match_data = ? WHERE id = ?',
      [JSON.stringify(matchData), match.id]
    );

    // 실시간 업데이트 전송
    io.to(`match_${match.id}`).emit('match_update', {
      match_id: match.id,
      game_time: matchData.game_time,
      home_score: matchData.home_score,
      away_score: matchData.away_score
    });
  } catch (error) {
    console.error('Error simulating match progress:', error);
  }
}

// 선수 통계 업데이트 (CS, 골드 등)
async function updatePlayerStats(matchId: number, gameTime: number) {
  try {
    // 모든 선수 통계 가져오기
    const allStats = await pool.query(
      'SELECT * FROM match_stats WHERE match_id = ?',
      [matchId]
    );

    for (const stat of allStats) {
      // CS 증가 (분당 약 8-12 CS)
      const csIncrease = Math.floor(8 + Math.random() * 4);
      await pool.query(
        'UPDATE match_stats SET cs = cs + ? WHERE id = ?',
        [csIncrease, stat.id]
      );

      // 골드 수급 (분당 약 400-600 골드)
      const goldIncrease = Math.floor(400 + Math.random() * 200);
      await pool.query(
        'UPDATE match_stats SET gold_earned = gold_earned + ? WHERE id = ?',
        [goldIncrease, stat.id]
      );

      // 딜량 증가 (분당 약 2000-4000)
      const damageIncrease = Math.floor(2000 + Math.random() * 2000);
      await pool.query(
        'UPDATE match_stats SET damage_dealt = damage_dealt + ? WHERE id = ?',
        [damageIncrease, stat.id]
      );

      // 받은 딜량 증가
      const damageTakenIncrease = Math.floor(1500 + Math.random() * 1500);
      await pool.query(
        'UPDATE match_stats SET damage_taken = damage_taken + ? WHERE id = ?',
        [damageTakenIncrease, stat.id]
      );

      // 와드 설치 (가끔)
      if (Math.random() < 0.1) {
        await pool.query(
          'UPDATE match_stats SET wards_placed = wards_placed + 1 WHERE id = ?',
          [stat.id]
        );
      }

      // 와드 제거 (가끔)
      if (Math.random() < 0.05) {
        await pool.query(
          'UPDATE match_stats SET wards_destroyed = wards_destroyed + 1 WHERE id = ?',
          [stat.id]
        );
      }

      // 비전 점수 증가
      const visionIncrease = Math.floor(1 + Math.random() * 2);
      await pool.query(
        'UPDATE match_stats SET vision_score = vision_score + ? WHERE id = ?',
        [visionIncrease, stat.id]
      );
    }
  } catch (error) {
    console.error('Error updating player stats:', error);
  }
}

async function createRandomEvent(match: any, gameTime: number) {
  // 팀 전술 조회
  const homeTactics = await getTeamTactics(match.home_team_id);
  const awayTactics = await getTeamTactics(match.away_team_id);

  // 전술에 따른 이벤트 타입 가중치
  let eventTypes = ['KILL', 'ASSIST', 'TOWER', 'DRAGON', 'BARON', 'TEAMFIGHT'];

  // 우선순위 오브젝트에 따른 가중치 조정
  const objectiveWeights: Record<string, string[]> = {
    'DRAGON': ['DRAGON', 'DRAGON'],
    'BARON': ['BARON', 'BARON'],
    'TOWER': ['TOWER', 'TOWER'],
    'TEAMFIGHT': ['TEAMFIGHT', 'KILL', 'KILL']
  };

  // 홈팀과 어웨이팀 전술에 따라 이벤트 타입 추가
  if (homeTactics.priority_objective && objectiveWeights[homeTactics.priority_objective]) {
    eventTypes = eventTypes.concat(objectiveWeights[homeTactics.priority_objective]);
  }
  if (awayTactics.priority_objective && objectiveWeights[awayTactics.priority_objective]) {
    eventTypes = eventTypes.concat(objectiveWeights[awayTactics.priority_objective]);
  }

  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

  const descriptions = matchEvents[Math.floor(Math.random() * matchEvents.length)];

  // 팀별 오버롤 계산 (전술 보너스 포함)
  const homeTeamOverall = await calculateTeamOverall(match.home_team_id, gameTime);
  const awayTeamOverall = await calculateTeamOverall(match.away_team_id, gameTime);

  // 오버롤에 따른 이벤트 결과 결정
  const homeWinChance = homeTeamOverall / (homeTeamOverall + awayTeamOverall);

  // 선수 목록 가져오기 (player_cards + pro_players 사용)
  const homePlayers = await pool.query(
    `SELECT pc.id, pp.name, pp.position FROM player_cards pc
     JOIN pro_players pp ON pc.pro_player_id = pp.id
     WHERE pc.team_id = ? AND pc.is_starter = true AND pc.is_contracted = true`,
    [match.home_team_id]
  );
  const awayPlayers = await pool.query(
    `SELECT pc.id, pp.name, pp.position FROM player_cards pc
     JOIN pro_players pp ON pc.pro_player_id = pp.id
     WHERE pc.team_id = ? AND pc.is_starter = true AND pc.is_contracted = true`,
    [match.away_team_id]
  );

  const winningTeam = Math.random() < homeWinChance ? 'home' : 'away';
  const winningPlayers = winningTeam === 'home' ? homePlayers : awayPlayers;
  const losingPlayers = winningTeam === 'home' ? awayPlayers : homePlayers;

  // 선수가 없으면 이벤트 생성 불가
  if (winningPlayers.length === 0 || losingPlayers.length === 0) {
    return null;
  }

  let eventData: any = {
    team: winningTeam,
    description: descriptions
  };

  if (eventType === 'KILL') {
    const killer = winningPlayers[Math.floor(Math.random() * winningPlayers.length)];
    const victim = losingPlayers[Math.floor(Math.random() * losingPlayers.length)];

    if (!killer || !victim) {
      return null;
    }

    const assistCount = Math.floor(Math.random() * 3); // 0-2명 어시스트
    const assistIds: number[] = [];
    for (let i = 0; i < assistCount && i < winningPlayers.length - 1; i++) {
      const otherPlayers = winningPlayers.filter((p: any) => p.id !== killer.id);
      if (otherPlayers.length > 0) {
        const assistPlayer = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        if (assistPlayer && !assistIds.includes(assistPlayer.id)) {
          assistIds.push(assistPlayer.id);
        }
      }
    }

    eventData.killer_id = killer.id;
    eventData.killer_name = killer.name;
    eventData.victim_id = victim.id;
    eventData.victim_name = victim.name;
    eventData.assist_ids = assistIds;

    // 퍼스트블러드 체크
    const existingKills = await pool.query(
      'SELECT SUM(kills) as total FROM match_stats WHERE match_id = ?',
      [match.id]
    );
    if (existingKills[0].total === 0) {
      eventData.first_blood = true;
      await pool.query(
        'UPDATE match_stats SET first_blood = TRUE WHERE match_id = ? AND player_id = ?',
        [match.id, killer.id]
      );
    }
  } else if (eventType === 'TOWER') {
    const turretKiller = winningPlayers[Math.floor(Math.random() * winningPlayers.length)];
    if (!turretKiller) {
      return null;
    }
    eventData.killer_id = turretKiller.id;
    eventData.killer_name = turretKiller.name;
    await pool.query(
      'UPDATE match_stats SET turret_kills = turret_kills + 1 WHERE match_id = ? AND player_id = ?',
      [match.id, turretKiller.id]
    );
  }

  return {
    type: eventType,
    time: gameTime,
    description: descriptions,
    data: eventData
  };
}

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
    const homeScore = matchData.home_score;
    const awayScore = matchData.away_score;

    // 경기 종료
    await pool.query(
      'UPDATE matches SET status = "FINISHED", finished_at = NOW(), home_score = ?, away_score = ? WHERE id = ?',
      [homeScore, awayScore, match.id]
    );

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
  } catch (error) {
    console.error('Error finishing match:', error);
  }
}

async function giveMatchRewards(match: any, winnerTeamId: number) {
  try {
    // 승리 팀에게 랜덤 선수 카드 보상
    const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    const position = positions[Math.floor(Math.random() * positions.length)];

    const baseOverall = 150 + Math.floor(Math.random() * 200);
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

      // 승리 보너스만 지급
      const winBonus = 30000;
      if (homeScore > awayScore) {
        await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [winBonus, homeTeamId]);
      } else if (awayScore > homeScore) {
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

    // 승리 보너스
    const winBonus = 50000;
    const loseBonus = 10000;

    // 홈팀 수익 지급
    let homeGold = ticketRevenue;
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

    // 원정팀 승리/패배 보너스만
    let awayGold = 0;
    if (awayScore > homeScore) {
      awayGold = winBonus;
    } else if (homeScore > awayScore) {
      awayGold = loseBonus;
    } else {
      awayGold = 20000;
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

    console.log(`League match rewards: Home ${homeTeamId} +${homeGold}G (${attendance} attendance, capacity: ${stadiumCapacity}), Away ${match.away_team_id} +${awayGold}G`);
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

