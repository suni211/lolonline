import cron from 'node-cron';
import pool from '../database/db.js';
import { generateRegularSeasonMatches } from './leagueService.js';
import LPOLeagueService from './lpoLeagueService.js';

// 6시간마다 한 달 진행 (1-11월 시즌, 11-12월 스토브리그)
export async function initializeSeasonSystem() {
  // 매 6시간마다 실행 (구 시스템)
  cron.schedule('0 */6 * * *', async () => {
    await advanceMonth();
  });

  // 매주 일요일 00:00 KST (토요일 15:00 UTC) - 스토브리그 시작
  cron.schedule('0 15 * * 6', async () => {
    await startStoveLeague();
  });

  // 매주 월요일 00:00 KST (일요일 15:00 UTC) - 새 시즌 시작
  cron.schedule('0 15 * * 0', async () => {
    await startNewSeasonAuto();
  });

  // 매시간 시즌 종료 체크
  cron.schedule('0 * * * *', async () => {
    await checkSeasonCompletion();
  });

  console.log('Season system initialized');
}

// 스토브리그 시작 (일요일)
async function startStoveLeague() {
  try {
    console.log('Starting Stove League...');

    // 모든 LPO 리그를 OFFSEASON 상태로 변경
    await pool.query(
      `UPDATE leagues SET status = 'OFFSEASON', is_offseason = true
       WHERE name LIKE 'LPO%' AND status IN ('REGULAR', 'PLAYOFF')`
    );

    // 이적시장 활성화 플래그 설정 (game_settings 테이블이 있다면)
    try {
      await pool.query(
        `INSERT INTO game_settings (setting_key, setting_value, updated_at)
         VALUES ('transfer_market_open', 'true', NOW())
         ON DUPLICATE KEY UPDATE setting_value = 'true', updated_at = NOW()`
      );
    } catch (e) {
      // game_settings 테이블이 없으면 무시
    }

    console.log('Stove League started - Transfer market open');
  } catch (error) {
    console.error('Error starting stove league:', error);
  }
}

// 새 시즌 자동 시작 (월요일)
async function startNewSeasonAuto() {
  try {
    console.log('Starting new season automatically...');

    // 현재 LPO 리그 시즌 조회
    const currentLeagues = await pool.query(
      `SELECT DISTINCT season FROM leagues WHERE name LIKE 'LPO%' ORDER BY season DESC LIMIT 1`
    );

    if (currentLeagues.length === 0) {
      console.log('No LPO leagues found');
      return;
    }

    const currentSeason = currentLeagues[0].season;

    // LPO 리그 시스템으로 새 시즌 시작
    await LPOLeagueService.startNewSeason(currentSeason);

    // 이적시장 비활성화
    try {
      await pool.query(
        `INSERT INTO game_settings (setting_key, setting_value, updated_at)
         VALUES ('transfer_market_open', 'false', NOW())
         ON DUPLICATE KEY UPDATE setting_value = 'false', updated_at = NOW()`
      );
    } catch (e) {
      // game_settings 테이블이 없으면 무시
    }

    console.log(`Season ${currentSeason + 1} started automatically`);
  } catch (error) {
    console.error('Error starting new season:', error);
  }
}

// 시즌 종료 체크 (모든 경기 완료 여부)
async function checkSeasonCompletion() {
  try {
    // LPO 리그별로 체크
    const leagues = await pool.query(
      `SELECT l.id, l.name, l.season, l.status,
              (SELECT COUNT(*) FROM matches m WHERE m.league_id = l.id AND m.status = 'SCHEDULED') as remaining_matches
       FROM leagues l
       WHERE l.name LIKE 'LPO%' AND l.status = 'REGULAR'`
    );

    for (const league of leagues) {
      if (league.remaining_matches === 0) {
        console.log(`League ${league.name} completed all matches`);

        // 플레이오프가 없으면 바로 OFFSEASON으로
        // 플레이오프가 있으면 PLAYOFF 상태로 변경
        const standings = await pool.query(
          `SELECT lp.team_id, t.name,
                  (lp.wins * 3 + lp.draws) as points
           FROM league_participants lp
           JOIN teams t ON lp.team_id = t.id
           WHERE lp.league_id = ?
           ORDER BY points DESC, lp.goal_difference DESC
           LIMIT 8`,
          [league.id]
        );

        if (standings.length >= 4) {
          // 플레이오프 시작 가능
          await pool.query(
            `UPDATE leagues SET status = 'PLAYOFF' WHERE id = ?`,
            [league.id]
          );
          console.log(`League ${league.name} entering playoffs`);
        } else {
          // 팀이 부족하면 바로 OFFSEASON
          await pool.query(
            `UPDATE leagues SET status = 'OFFSEASON', is_offseason = true WHERE id = ?`,
            [league.id]
          );
        }
      }
    }
  } catch (error) {
    console.error('Error checking season completion:', error);
  }
}

// 재계약 기간 확인
export async function isRecontractPeriod(): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM leagues
       WHERE name LIKE 'LPO%' AND (status = 'OFFSEASON' OR is_offseason = true)`
    );
    return result[0].count > 0;
  } catch (error) {
    return false;
  }
}

// 이적시장 상태 확인
export async function isTransferMarketOpen(): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT setting_value FROM game_settings WHERE setting_key = 'transfer_market_open'`
    );
    return result.length > 0 && result[0].setting_value === 'true';
  } catch (error) {
    // 테이블이 없으면 스토브리그 여부로 판단
    return await isRecontractPeriod();
  }
}

async function advanceMonth() {
  try {
    // 모든 활성 리그 가져오기
    const leagues = await pool.query(
      'SELECT * FROM leagues WHERE status IN ("REGULAR", "PLAYOFF", "OFFSEASON")'
    );

    for (const league of leagues) {
      let newMonth = league.current_month + 1;
      let newSeason = league.season;
      let isOffseason = league.is_offseason;
      let status = league.status;

      // 11월이 끝나면 스토브리그 시작
      if (newMonth === 11 && !isOffseason) {
        isOffseason = true;
        status = 'OFFSEASON';
      }

      // 12월이 끝나면 새 시즌 시작
      if (newMonth > 12) {
        newMonth = 1;
        newSeason = league.season + 1;
        isOffseason = false;
        status = 'REGULAR';

        // 새 리그 생성
        const newLeagueResult = await pool.query(
          `INSERT INTO leagues (name, region, season, current_month, is_offseason, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [`${league.region} LEAGUE`, league.region, newSeason, 1, false, 'REGULAR']
        );

        const newLeagueId = newLeagueResult.insertId;

        // 기존 참가 팀을 새 리그로 이동
        await pool.query(
          'UPDATE league_participants SET league_id = ?, wins = 0, losses = 0, draws = 0, points = 0, goal_difference = 0, rank = NULL WHERE league_id = ?',
          [newLeagueId, league.id]
        );

        // 새 리그 경기 일정 생성
        await generateRegularSeasonMatches(newLeagueId);

        // 기존 리그는 종료
        await pool.query(
          'UPDATE leagues SET status = "FINISHED" WHERE id = ?',
          [league.id]
        );
      } else {
        // 월 업데이트
        await pool.query(
          'UPDATE leagues SET current_month = ?, is_offseason = ?, status = ? WHERE id = ?',
          [newMonth, isOffseason, status, league.id]
        );
      }

      // 정규시즌이 끝나면 플레이오프 시작 (11월 말)
      if (newMonth === 11 && status === 'REGULAR') {
        await startPlayoffs(league.id);
      }
    }

    console.log('Month advanced for all leagues');
  } catch (error) {
    console.error('Error advancing month:', error);
  }
}

async function startPlayoffs(leagueId: number) {
  try {
    // 상위 4팀 가져오기
    const topTeams = await pool.query(
      `SELECT lp.team_id, lp.rank
       FROM league_participants lp
       WHERE lp.league_id = ?
       ORDER BY (lp.wins * 3 + lp.draws) DESC, lp.goal_difference DESC, lp.wins DESC
       LIMIT 4`,
      [leagueId]
    );

    if (topTeams.length < 4) {
      return;
    }

    // 리그 상태를 플레이오프로 변경
    await pool.query(
      'UPDATE leagues SET status = "PLAYOFF" WHERE id = ?',
      [leagueId]
    );

    // 플레이오프 브래킷 생성
    // 1위 vs 4위, 2위 vs 3위
    const quarterfinal1 = await pool.query(
      `INSERT INTO playoff_brackets (league_id, round, team1_id, team2_id)
       VALUES (?, 'QUARTERFINAL', ?, ?)`,
      [leagueId, topTeams[0].team_id, topTeams[3].team_id]
    );

    const quarterfinal2 = await pool.query(
      `INSERT INTO playoff_brackets (league_id, round, team1_id, team2_id)
       VALUES (?, 'QUARTERFINAL', ?, ?)`,
      [leagueId, topTeams[1].team_id, topTeams[2].team_id]
    );

    // 8강 경기 생성
    await createPlayoffMatches(leagueId, quarterfinal1.insertId, topTeams[0].team_id, topTeams[3].team_id);
    await createPlayoffMatches(leagueId, quarterfinal2.insertId, topTeams[1].team_id, topTeams[2].team_id);

    console.log('Playoffs started for league', leagueId);
  } catch (error) {
    console.error('Error starting playoffs:', error);
  }
}

async function createPlayoffMatches(leagueId: number, bracketId: number, team1Id: number, team2Id: number) {
  const scheduledAt = new Date();
  scheduledAt.setHours(scheduledAt.getHours() + 1); // 1시간 후

  const match = await pool.query(
    `INSERT INTO matches (league_id, home_team_id, away_team_id, match_type, round, scheduled_at)
     VALUES (?, ?, ?, 'PLAYOFF', 1, ?)`,
    [leagueId, team1Id, team2Id, scheduledAt]
  );

  await pool.query(
    'UPDATE playoff_brackets SET match_id = ? WHERE id = ?',
    [match.insertId, bracketId]
  );
}

export async function getCurrentSeasonInfo() {
  const leagues = await pool.query(
    'SELECT * FROM leagues WHERE status IN ("REGULAR", "PLAYOFF", "OFFSEASON") ORDER BY region'
  );

  return leagues;
}

// 시즌 종료 처리 및 상금 분배
export async function endSeasonAndDistributePrizes(leagueId: number) {
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

    // 최종 순위 조회
    const standings = await pool.query(
      `SELECT lp.*, t.name as team_name
       FROM league_participants lp
       JOIN teams t ON lp.team_id = t.id
       WHERE lp.league_id = ?
       ORDER BY lp.points DESC, lp.goal_difference DESC, lp.wins DESC`,
      [leagueId]
    );

    // 상금 설정 조회
    const prizes = await pool.query(
      'SELECT * FROM season_prizes WHERE league_type = ? ORDER BY rank_position',
      [league.region]
    );

    const prizeMap = new Map();
    for (const prize of prizes) {
      prizeMap.set(prize.rank_position, prize);
    }

    // 각 팀에 상금 분배 및 기록
    for (let i = 0; i < standings.length; i++) {
      const team = standings[i];
      const rank = i + 1;
      const prize = prizeMap.get(rank);

      const prizeGold = prize?.prize_gold || 0;
      const prizeDiamond = prize?.prize_diamond || 0;

      // 상금 지급
      if (prizeGold > 0 || prizeDiamond > 0) {
        await pool.query(
          'UPDATE teams SET gold = gold + ?, diamond = diamond + ? WHERE id = ?',
          [prizeGold, prizeDiamond, team.team_id]
        );

        // 재정 기록
        await pool.query(
          `INSERT INTO financial_records (team_id, record_type, category, amount, description)
           VALUES (?, 'INCOME', 'OTHER', ?, ?)`,
          [team.team_id, prizeGold, `시즌 ${league.season} ${rank}위 상금`]
        );
      }

      // 시즌 기록 저장
      await pool.query(
        `INSERT INTO season_history
         (season, league_id, team_id, final_rank, wins, losses, points, prize_money, is_champion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          league.season,
          leagueId,
          team.team_id,
          rank,
          team.wins,
          team.losses,
          team.points,
          prizeGold,
          rank === 1
        ]
      );
    }

    // 리그 상태를 오프시즌으로 변경
    await pool.query(
      'UPDATE leagues SET status = "OFFSEASON", is_offseason = true WHERE id = ?',
      [leagueId]
    );

    console.log(`Season ${league.season} ended for league ${leagueId}. Prizes distributed.`);

    return {
      success: true,
      season: league.season,
      standings: standings.map((t: any, i: number) => ({
        rank: i + 1,
        teamName: t.team_name,
        wins: t.wins,
        losses: t.losses,
        points: t.points,
        prize: prizeMap.get(i + 1)?.prize_gold || 0
      }))
    };
  } catch (error) {
    console.error('Error ending season:', error);
    throw error;
  }
}

// 팀 시즌 기록 조회
export async function getTeamSeasonHistory(teamId: number) {
  try {
    const history = await pool.query(
      `SELECT sh.*, l.name as league_name, l.region
       FROM season_history sh
       JOIN leagues l ON sh.league_id = l.id
       WHERE sh.team_id = ?
       ORDER BY sh.season DESC`,
      [teamId]
    );

    return history;
  } catch (error) {
    console.error('Error getting team history:', error);
    return [];
  }
}

// 역대 시즌 순위 조회
export async function getSeasonStandings(season: number, leagueId?: number) {
  try {
    let query = `
      SELECT sh.*, t.name as team_name, t.logo_url, l.name as league_name, l.region
      FROM season_history sh
      JOIN teams t ON sh.team_id = t.id
      JOIN leagues l ON sh.league_id = l.id
      WHERE sh.season = ?
    `;
    const params: any[] = [season];

    if (leagueId) {
      query += ' AND sh.league_id = ?';
      params.push(leagueId);
    }

    query += ' ORDER BY l.region, sh.final_rank';

    const standings = await pool.query(query, params);
    return standings;
  } catch (error) {
    console.error('Error getting season standings:', error);
    return [];
  }
}

// 명예의 전당 (우승 기록)
export async function getHallOfFame() {
  try {
    const champions = await pool.query(
      `SELECT sh.season, sh.league_id, t.id as team_id, t.name as team_name, t.logo_url,
              l.name as league_name, l.region, sh.wins, sh.prize_money
       FROM season_history sh
       JOIN teams t ON sh.team_id = t.id
       JOIN leagues l ON sh.league_id = l.id
       WHERE sh.is_champion = true OR sh.is_playoff_winner = true
       ORDER BY sh.season DESC, l.region`
    );

    return champions;
  } catch (error) {
    console.error('Error getting hall of fame:', error);
    return [];
  }
}

