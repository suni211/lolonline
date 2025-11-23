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

