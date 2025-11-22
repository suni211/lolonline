import pool from '../database/db';

// 정규리그 경기 일정 자동 생성
export async function generateRegularSeasonMatches(leagueId: number) {
  try {
    // 리그 참가 팀 가져오기
    const participants = await pool.query(
      'SELECT team_id FROM league_participants WHERE league_id = ?',
      [leagueId]
    );

    if (participants.length < 2) {
      return; // 최소 2팀 필요
    }

    const teamIds = participants.map((p: any) => p.team_id);

    // 이미 경기가 생성되어 있는지 확인
    const existingMatches = await pool.query(
      'SELECT COUNT(*) as count FROM matches WHERE league_id = ? AND match_type = "REGULAR"',
      [leagueId]
    );

    if (existingMatches[0].count > 0) {
      return; // 이미 경기 생성됨
    }

    // 라운드로빈 방식으로 경기 생성 (각 팀이 다른 팀과 2경기씩)
    const matches: any[] = [];
    const scheduledDate = new Date();
    scheduledDate.setHours(scheduledDate.getHours() + 1); // 1시간 후부터 시작

    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        // 홈 경기
        matches.push({
          league_id: leagueId,
          home_team_id: teamIds[i],
          away_team_id: teamIds[j],
          scheduled_at: new Date(scheduledDate)
        });

        scheduledDate.setHours(scheduledDate.getHours() + 6); // 6시간마다 경기

        // 어웨이 경기
        matches.push({
          league_id: leagueId,
          home_team_id: teamIds[j],
          away_team_id: teamIds[i],
          scheduled_at: new Date(scheduledDate)
        });

        scheduledDate.setHours(scheduledDate.getHours() + 6);
      }
    }

    // 경기 일괄 생성
    for (const match of matches) {
      await pool.query(
        `INSERT INTO matches (league_id, home_team_id, away_team_id, match_type, scheduled_at, status)
         VALUES (?, ?, ?, 'REGULAR', ?, 'SCHEDULED')`,
        [match.league_id, match.home_team_id, match.away_team_id, match.scheduled_at]
      );
    }

    console.log(`Generated ${matches.length} matches for league ${leagueId}`);
  } catch (error) {
    console.error('Error generating regular season matches:', error);
  }
}

// 새 시즌 시작 시 경기 일정 생성
export async function initializeNewSeason(leagueId: number) {
  await generateRegularSeasonMatches(leagueId);
}

