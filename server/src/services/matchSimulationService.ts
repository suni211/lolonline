import { Server } from 'socket.io';
import pool from '../database/db';
import cron from 'node-cron';
import { giveMatchExperience } from './playerService';
import { checkInjuryAfterMatch, getInjuryPenalty } from './injuryService';

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
    // 경기 상태를 LIVE로 변경
    await pool.query(
      'UPDATE matches SET status = "LIVE", started_at = NOW() WHERE id = ?',
      [match.id]
    );

    // 팀 선수 정보 가져오기
    const homePlayers = await pool.query(
      `SELECT p.* FROM players p
       INNER JOIN player_ownership po ON p.id = po.player_id
       WHERE po.team_id = ? AND po.is_starter = true
       ORDER BY p.position`,
      [match.home_team_id]
    );

    const awayPlayers = await pool.query(
      `SELECT p.* FROM players p
       INNER JOIN player_ownership po ON p.id = po.player_id
       WHERE po.team_id = ? AND po.is_starter = true
       ORDER BY p.position`,
      [match.away_team_id]
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

    // 부상 선수는 경기 출전 불가
    const availableHomePlayers = homePlayers.filter((p: any) => p.injury_status === 'NONE');
    const availableAwayPlayers = awayPlayers.filter((p: any) => p.injury_status === 'NONE');

    if (availableHomePlayers.length < 5 || availableAwayPlayers.length < 5) {
      // 경기 취소 (부상 선수로 인해 최소 인원 부족)
      await pool.query(
        'UPDATE matches SET status = "FINISHED", home_score = 0, away_score = 0, finished_at = NOW() WHERE id = ?',
        [match.id]
      );
      return;
    }

    // 경기 통계 초기화
    for (const player of availableHomePlayers) {
      await pool.query(
        `INSERT INTO match_stats (match_id, player_id, team_id, kills, deaths, assists, gold_earned, damage_dealt, vision_score)
         VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)`,
        [match.id, player.id, match.home_team_id]
      );
    }
    for (const player of availableAwayPlayers) {
      await pool.query(
        `INSERT INTO match_stats (match_id, player_id, team_id, kills, deaths, assists, gold_earned, damage_dealt, vision_score)
         VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)`,
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
    const matchData = match.match_data ? JSON.parse(match.match_data) : { game_time: 0, home_score: 0, away_score: 0, events: [] };
    
    matchData.game_time += 10; // 10초씩 진행

    // 경기 시간이 30분(1800초) 이상이면 종료
    if (matchData.game_time >= 1800) {
      await finishMatch(match, matchData, io);
      return;
    }

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

        // 점수 업데이트 (킬 발생 시)
        if (event.type === 'KILL') {
          if (event.data.team === 'home') {
            matchData.home_score++;
          } else {
            matchData.away_score++;
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

async function createRandomEvent(match: any, gameTime: number) {
  const eventTypes = ['KILL', 'ASSIST', 'TOWER', 'DRAGON', 'BARON', 'TEAMFIGHT'];
  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  
  const descriptions = matchEvents[Math.floor(Math.random() * matchEvents.length)];

  // 팀별 오버롤 계산
  const homeTeamOverall = await calculateTeamOverall(match.home_team_id);
  const awayTeamOverall = await calculateTeamOverall(match.away_team_id);

  // 오버롤에 따른 이벤트 결과 결정
  const homeWinChance = homeTeamOverall / (homeTeamOverall + awayTeamOverall);

  let eventData: any = {
    team: Math.random() < homeWinChance ? 'home' : 'away',
    description: descriptions
  };

  if (eventType === 'KILL') {
    eventData.killer = 'Player' + Math.floor(Math.random() * 5 + 1);
    eventData.victim = 'Player' + Math.floor(Math.random() * 5 + 1);
  }

  return {
    type: eventType,
    time: gameTime,
    description: descriptions,
    data: eventData
  };
}

async function calculateTeamOverall(teamId: number): Promise<number> {
  const players = await pool.query(
    `SELECT p.* FROM players p
     INNER JOIN player_ownership po ON p.id = po.player_id
     WHERE po.team_id = ? AND po.is_starter = true AND p.injury_status = 'NONE'`,
    [teamId]
  );

  let totalOverall = 0;
  for (const player of players) {
    const overall = player.mental + player.teamfight + player.focus + player.laning;
    // 컨디션 반영
    const adjustedOverall = overall * ((player as any).player_condition / 100);
    // 부상 페널티 반영
    const injuryPenalty = getInjuryPenalty(player.injury_status);
    totalOverall += adjustedOverall * injuryPenalty;
  }

  return totalOverall;
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

    // 경기 보상 (랜덤 선수 카드)
    const winnerTeamId = homeScore > awayScore ? match.home_team_id : match.away_team_id;
    const loserTeamId = homeScore > awayScore ? match.away_team_id : match.home_team_id;
    
    await giveMatchRewards(match, winnerTeamId);
    
    // 경험치 지급
    await giveMatchExperience(match.id, winnerTeamId, true);
    if (homeScore !== awayScore) {
      await giveMatchExperience(match.id, loserTeamId, false);
    }

    // 경기 후 부상 체크 (모든 출전 선수)
    const allPlayers = await pool.query(
      `SELECT p.id FROM players p
       INNER JOIN match_stats ms ON p.id = ms.player_id
       WHERE ms.match_id = ?`,
      [match.id]
    );

    for (const player of allPlayers) {
      await checkInjuryAfterMatch(player.id, 1.0);
    }

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

