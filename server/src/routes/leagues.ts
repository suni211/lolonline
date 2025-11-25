import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import LeagueMatchService from '../services/leagueMatchService.js';

const router = express.Router();

// 내 팀의 리그 순위 조회
router.get('/my-standing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId;

    // 현재 활성 리그에서 내 팀 순위 조회
    const standing = await pool.query(
      `SELECT l.id, l.name, l.region, l.season, l.status, l.current_month,
              lp.wins, lp.losses, lp.draws, (lp.wins * 3 + lp.draws) as points,
              (SELECT COUNT(*) + 1 FROM league_participants lp2
               WHERE lp2.league_id = lp.league_id AND (lp2.wins * 3 + lp2.draws) > (lp.wins * 3 + lp.draws)) as team_rank,
              (SELECT COUNT(*) FROM league_participants WHERE league_id = lp.league_id) as total_teams
       FROM league_participants lp
       JOIN leagues l ON lp.league_id = l.id
       WHERE lp.team_id = ? AND l.status IN ('ACTIVE', 'REGULAR', 'PLAYOFF')
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
      `SELECT lp.*, t.name as team_name, t.logo_url, t.is_ai,
              (lp.wins * 3 + lp.draws) as total_points
       FROM league_participants lp
       INNER JOIN teams t ON lp.team_id = t.id
       WHERE lp.league_id = ?
       ORDER BY total_points DESC, lp.goal_difference DESC, lp.wins DESC`,
      [leagueId]
    );

    // 다음 경기 일정
    const upcomingMatches = await pool.query(
      `SELECT m.id, m.league_id, m.home_team_id, m.away_team_id, m.match_type, m.round,
              m.status, m.home_score, m.away_score,
              DATE_FORMAT(m.scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at,
              ht.name as home_team_name, ht.abbreviation as home_team_abbr, ht.logo_url as home_team_logo,
              at.name as away_team_name, at.abbreviation as away_team_abbr, at.logo_url as away_team_logo
       FROM matches m
       INNER JOIN teams ht ON m.home_team_id = ht.id
       INNER JOIN teams at ON m.away_team_id = at.id
       WHERE m.league_id = ? AND m.status IN ('SCHEDULED', 'LIVE')
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

    // 현재 플레이오프 조회
    const playoffs = await pool.query(
      `SELECT * FROM playoffs WHERE league_id = ? ORDER BY id DESC LIMIT 1`,
      [leagueId]
    );

    if (playoffs.length === 0) {
      return res.json([]);
    }

    const playoffId = playoffs[0].id;

    // 플레이오프 경기 조회
    const matches = await pool.query(
      `SELECT pm.*,
              ht.name as team1_name, at.name as team2_name, wt.name as winner_name,
              pm.status as match_status
       FROM playoff_matches pm
       LEFT JOIN teams ht ON pm.home_team_id = ht.id
       LEFT JOIN teams at ON pm.away_team_id = at.id
       LEFT JOIN teams wt ON pm.winner_team_id = wt.id
       WHERE pm.playoff_id = ?
       ORDER BY
         CASE pm.round
           WHEN 'WILDCARD' THEN 1
           WHEN 'SEMI' THEN 2
           WHEN 'FINAL' THEN 3
         END,
         pm.match_number`,
      [playoffId]
    );

    // 부전승 팀 조회 (1위, 2위)
    const byes = await pool.query(
      `SELECT pb.*, t.name as team_name
       FROM playoff_byes pb
       JOIN teams t ON pb.team_id = t.id
       WHERE pb.playoff_id = ?
       ORDER BY pb.seed`,
      [playoffId]
    );

    // 프론트엔드 호환을 위해 형식 변환
    const formattedMatches = matches.map((m: any) => ({
      id: m.id,
      round: m.round === 'WILDCARD' ? '와일드카드' : m.round === 'SEMI' ? '준결승' : '결승',
      team1_id: m.home_team_id,
      team2_id: m.away_team_id,
      team1_name: m.team1_name,
      team2_name: m.team2_name,
      winner_id: m.winner_team_id,
      winner_name: m.winner_name,
      match_status: m.match_status,
      home_score: m.home_score,
      away_score: m.away_score
    }));

    // 부전승 정보 추가
    if (byes.length > 0) {
      res.json({
        matches: formattedMatches,
        byes: byes.map((b: any) => ({
          seed: b.seed,
          team_id: b.team_id,
          team_name: b.team_name
        })),
        status: playoffs[0].status
      });
    } else {
      res.json(formattedMatches);
    }
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

// 리그 경기 목록 조회
router.get('/:leagueId/matches', async (req, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    const { status } = req.query;

    let query = `
      SELECT lm.*,
             ht.name as home_team_name,
             at.name as away_team_name
      FROM league_matches lm
      JOIN teams ht ON lm.home_team_id = ht.id
      JOIN teams at ON lm.away_team_id = at.id
      WHERE lm.league_id = ?
    `;
    const params: any[] = [leagueId];

    if (status) {
      query += ' AND lm.status = ?';
      params.push(status);
    }

    query += ' ORDER BY lm.scheduled_at';

    const matches = await pool.query(query, params);
    res.json(matches);
  } catch (error) {
    console.error('Get league matches error:', error);
    res.status(500).json({ error: '경기 목록 조회 실패' });
  }
});

// 경기 상세 (관전용)
router.get('/matches/:matchId', async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const matchDetails = await LeagueMatchService.getMatchDetails(matchId);

    if (!matchDetails) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다' });
    }

    res.json(matchDetails);
  } catch (error) {
    console.error('Get match details error:', error);
    res.status(500).json({ error: '경기 상세 조회 실패' });
  }
});

// 내 팀 예정된 경기 조회
router.get('/all-matches/upcoming', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId;

    if (!teamId) {
      return res.status(400).json({ error: '팀이 필요합니다' });
    }

    const matches = await pool.query(
      `SELECT m.id, m.league_id, m.home_team_id, m.away_team_id, m.match_type, m.round,
              m.status, m.home_score, m.away_score,
              DATE_FORMAT(m.scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at,
              ht.name as home_team_name, ht.abbreviation as home_team_abbr, ht.logo_url as home_team_logo,
              at.name as away_team_name, at.abbreviation as away_team_abbr, at.logo_url as away_team_logo,
              l.name as league_name
       FROM matches m
       JOIN teams ht ON m.home_team_id = ht.id
       JOIN teams at ON m.away_team_id = at.id
       JOIN leagues l ON m.league_id = l.id
       WHERE m.status = 'SCHEDULED'
         AND (m.home_team_id = ? OR m.away_team_id = ?)
       ORDER BY m.scheduled_at
       LIMIT 10`,
      [teamId, teamId]
    );
    res.json(matches);
  } catch (error) {
    console.error('Get upcoming matches error:', error);
    res.status(500).json({ error: '예정 경기 조회 실패' });
  }
});

// 다음 예정 경기 조회 (모든 팀)
router.get('/all-matches/recent', async (req, res) => {
  try {
    const matches = await pool.query(
      `SELECT m.id, m.league_id, m.home_team_id, m.away_team_id, m.match_type, m.round,
              m.status, m.home_score, m.away_score,
              DATE_FORMAT(m.scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at,
              ht.name as home_team_name, ht.abbreviation as home_team_abbr, ht.logo_url as home_team_logo,
              at.name as away_team_name, at.abbreviation as away_team_abbr, at.logo_url as away_team_logo,
              l.name as league_name
       FROM matches m
       JOIN teams ht ON m.home_team_id = ht.id
       JOIN teams at ON m.away_team_id = at.id
       JOIN leagues l ON m.league_id = l.id
       WHERE m.status IN ('SCHEDULED', 'LIVE')
       ORDER BY m.scheduled_at ASC
       LIMIT 100`
    );

    console.log(`📊 /all-matches/recent - 반환된 경기 수: ${matches.length}`);
    console.log('📊 첫 3개 경기:', matches.slice(0, 3).map((m: any) => ({
      id: m.id,
      league: m.league_name,
      status: m.status,
      home: m.home_team_name,
      away: m.away_team_name,
      scheduled: m.scheduled_at
    })));

    res.json(matches);
  } catch (error) {
    console.error('Get next matches error:', error);
    res.status(500).json({ error: '다음 경기 조회 실패' });
  }
});

// 리그 순위 재계산 (모든 경기 결과 기반)
router.post('/:leagueId/recalculate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);

    // 모든 참가팀 순위 초기화
    await pool.query(
      'UPDATE league_participants SET wins = 0, losses = 0, draws = 0, points = 0 WHERE league_id = ?',
      [leagueId]
    );

    // 완료된 경기 가져오기
    const matches = await pool.query(
      `SELECT home_team_id, away_team_id, home_score, away_score
       FROM matches
       WHERE league_id = ? AND status = 'FINISHED'`,
      [leagueId]
    );

    // 각 경기 결과 반영
    for (const match of matches) {
      if (match.home_score > match.away_score) {
        // 홈팀 승리
        await pool.query(
          'UPDATE league_participants SET wins = wins + 1, points = points + 3 WHERE league_id = ? AND team_id = ?',
          [leagueId, match.home_team_id]
        );
        await pool.query(
          'UPDATE league_participants SET losses = losses + 1 WHERE league_id = ? AND team_id = ?',
          [leagueId, match.away_team_id]
        );
      } else if (match.away_score > match.home_score) {
        // 원정팀 승리
        await pool.query(
          'UPDATE league_participants SET wins = wins + 1, points = points + 3 WHERE league_id = ? AND team_id = ?',
          [leagueId, match.away_team_id]
        );
        await pool.query(
          'UPDATE league_participants SET losses = losses + 1 WHERE league_id = ? AND team_id = ?',
          [leagueId, match.home_team_id]
        );
      } else {
        // 무승부
        await pool.query(
          'UPDATE league_participants SET draws = draws + 1, points = points + 1 WHERE league_id = ? AND team_id IN (?, ?)',
          [leagueId, match.home_team_id, match.away_team_id]
        );
      }
    }

    res.json({ message: '순위가 재계산되었습니다', matches_processed: matches.length });
  } catch (error: any) {
    console.error('Recalculate standings error:', error);
    res.status(500).json({ error: '순위 재계산 실패' });
  }
});

export default router;

