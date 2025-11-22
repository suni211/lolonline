import cron from 'node-cron';
import pool from '../database/db';
import { generateRegularSeasonMatches } from './leagueService';

// 6시간마다 한 달 진행 (1-11월 시즌, 11-12월 스토브리그)
export async function initializeSeasonSystem() {
  // 매 6시간마다 실행
  cron.schedule('0 */6 * * *', async () => {
    await advanceMonth();
  });

  console.log('Season system initialized');
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

