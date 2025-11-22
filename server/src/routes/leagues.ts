import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 내 팀의 리그 순위 조회
router.get('/my-standing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId;

    // 현재 활성 리그에서 내 팀 순위 조회
    const standing = await pool.query(
      `SELECT l.id, l.name, l.region, l.season, l.status,
              ls.wins, ls.losses, ls.points,
              (SELECT COUNT(*) + 1 FROM league_standings ls2
               WHERE ls2.league_id = ls.league_id AND ls2.points > ls.points) as team_rank,
              (SELECT COUNT(*) FROM league_standings WHERE league_id = ls.league_id) as total_teams
       FROM league_standings ls
       JOIN leagues l ON ls.league_id = l.id
       WHERE ls.team_id = ? AND l.status = 'ACTIVE'
       LIMIT 1`,
      [teamId]
    );

    if (standing.length === 0) {
      return res.status(404).json({ error: '참가 중인 리그가 없습니다' });
    }

    res.json(standing[0]);
  } catch (error: any) {
    console.error('Get my standing error:', error);
    res.status(500).json({ error: '리그 순위 조회 실패' });
  }
});

// 리그 목록
router.get('/', async (req, res) => {
  try {
    const { region } = req.query;

    let query = 'SELECT * FROM leagues WHERE 1=1';
    const params: any[] = [];

    if (region) {
      query += ' AND region = ?';
      params.push(region);
    }

    query += ' ORDER BY season DESC, region ASC';

    const leagues = await pool.query(query, params);

    res.json(leagues);
  } catch (error: any) {
    console.error('Get leagues error:', error);
    res.status(500).json({ error: 'Failed to get leagues' });
  }
});

// 리그 상세 정보
router.get('/:leagueId', async (req, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);

    const leagues = await pool.query('SELECT * FROM leagues WHERE id = ?', [leagueId]);
    if (leagues.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    // 리그 참가 팀 및 순위
    const participants = await pool.query(
      `SELECT lp.*, t.name as team_name, t.logo_url,
              (lp.wins * 3 + lp.draws) as total_points
       FROM league_participants lp
       INNER JOIN teams t ON lp.team_id = t.id
       WHERE lp.league_id = ?
       ORDER BY total_points DESC, lp.goal_difference DESC, lp.wins DESC`,
      [leagueId]
    );

    // 다음 경기 일정
    const upcomingMatches = await pool.query(
      `SELECT m.*, ht.name as home_team_name, at.name as away_team_name
       FROM matches m
       INNER JOIN teams ht ON m.home_team_id = ht.id
       INNER JOIN teams at ON m.away_team_id = at.id
       WHERE m.league_id = ? AND m.status = 'SCHEDULED'
       ORDER BY m.scheduled_at ASC
       LIMIT 10`,
      [leagueId]
    );

    res.json({
      league: leagues[0],
      standings: participants,
      upcomingMatches
    });
  } catch (error: any) {
    console.error('Get league error:', error);
    res.status(500).json({ error: 'Failed to get league' });
  }
});

// 플레이오프 브래킷
router.get('/:leagueId/playoff', async (req, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);

    const brackets = await pool.query(
      `SELECT pb.*, 
              t1.name as team1_name, t2.name as team2_name, tw.name as winner_name,
              m.status as match_status, m.home_score, m.away_score
       FROM playoff_brackets pb
       LEFT JOIN teams t1 ON pb.team1_id = t1.id
       LEFT JOIN teams t2 ON pb.team2_id = t2.id
       LEFT JOIN teams tw ON pb.winner_id = tw.id
       LEFT JOIN matches m ON pb.match_id = m.id
       WHERE pb.league_id = ?
       ORDER BY 
         CASE pb.round
           WHEN 'QUARTERFINAL' THEN 1
           WHEN 'SEMIFINAL' THEN 2
           WHEN 'FINAL' THEN 3
         END`,
      [leagueId]
    );

    res.json(brackets);
  } catch (error: any) {
    console.error('Get playoff error:', error);
    res.status(500).json({ error: 'Failed to get playoff bracket' });
  }
});

// 리더보드
router.get('/:leagueId/leaderboard', async (req, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    const { season } = req.query;

    let query = `
      SELECT lb.*, t.name as team_name, t.logo_url, l.name as league_name
      FROM leaderboards lb
      INNER JOIN teams t ON lb.team_id = t.id
      INNER JOIN leagues l ON lb.league_id = l.id
      WHERE lb.league_id = ?
    `;

    const params: any[] = [leagueId];

    if (season) {
      query += ' AND lb.season = ?';
      params.push(season);
    }

    query += ' ORDER BY lb.rank ASC, lb.total_points DESC LIMIT 100';

    const leaderboard = await pool.query(query, params);

    res.json(leaderboard);
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

export default router;

