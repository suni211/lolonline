import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcrypt';

const router = express.Router();

// 어드민 인증 미들웨어
const adminMiddleware = async (req: AuthRequest, res: any, next: any) => {
  try {
    const users = await pool.query('SELECT is_admin FROM users WHERE id = ?', [req.userId]);
    if (users.length === 0 || !users[0].is_admin) {
      return res.status(403).json({ error: '어드민 권한이 필요합니다' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: '권한 확인 실패' });
  }
};

// 어드민 계정 생성 (초기 설정용 - 한 번만 사용)
router.post('/create-admin', async (req, res) => {
  try {
    // 이미 어드민이 있는지 확인
    const existingAdmin = await pool.query('SELECT id FROM users WHERE is_admin = true');
    if (existingAdmin.length > 0) {
      return res.status(400).json({ error: '어드민 계정이 이미 존재합니다' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (username, password, is_admin) VALUES (?, ?, true)`,
      [username, hashedPassword]
    );

    res.json({ success: true, message: '어드민 계정이 생성되었습니다' });
  } catch (error: any) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: '어드민 계정 생성 실패' });
  }
});

// 모든 유저 목록 조회
router.get('/users', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const users = await pool.query(
      `SELECT u.id, u.username, u.is_admin, u.created_at, u.last_login,
              t.id as team_id, t.name as team_name, t.gold, t.diamond, t.fan_count
       FROM users u
       LEFT JOIN teams t ON u.id = t.user_id
       ORDER BY u.created_at DESC`
    );
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: '유저 목록 조회 실패' });
  }
});

// 유저 초기화 (팀, 선수, 시설 등 모두 삭제)
router.post('/users/:userId/reset', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // 팀 정보 조회
    const teams = await pool.query('SELECT id FROM teams WHERE user_id = ?', [userId]);
    if (teams.length === 0) {
      return res.status(404).json({ error: '해당 유저의 팀을 찾을 수 없습니다' });
    }

    const teamId = teams[0].id;

    // 관련 데이터 삭제 (순서 중요)
    await pool.query('DELETE FROM team_events WHERE team_id = ?', [teamId]);
    await pool.query('DELETE FROM team_sponsors WHERE team_id = ?', [teamId]);
    await pool.query('DELETE FROM financial_records WHERE team_id = ?', [teamId]);
    await pool.query('DELETE FROM contract_negotiations WHERE team_id = ?', [teamId]);
    await pool.query('DELETE FROM player_ownership WHERE team_id = ?', [teamId]);
    await pool.query('DELETE FROM team_facilities WHERE team_id = ?', [teamId]);
    await pool.query('DELETE FROM team_coaches WHERE team_id = ?', [teamId]);
    await pool.query('DELETE FROM match_results WHERE home_team_id = ? OR away_team_id = ?', [teamId, teamId]);
    await pool.query('DELETE FROM league_standings WHERE team_id = ?', [teamId]);

    // 팀 리소스 초기화
    await pool.query(
      `UPDATE teams SET gold = 100000, diamond = 100, fan_count = 1000 WHERE id = ?`,
      [teamId]
    );

    res.json({ success: true, message: '유저가 초기화되었습니다' });
  } catch (error) {
    console.error('Reset user error:', error);
    res.status(500).json({ error: '유저 초기화 실패' });
  }
});

// 유저 삭제
router.delete('/users/:userId', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // 어드민 계정은 삭제 불가
    const user = await pool.query('SELECT is_admin FROM users WHERE id = ?', [userId]);
    if (user.length > 0 && user[0].is_admin) {
      return res.status(400).json({ error: '어드민 계정은 삭제할 수 없습니다' });
    }

    // 팀 정보 조회
    const teams = await pool.query('SELECT id FROM teams WHERE user_id = ?', [userId]);
    if (teams.length > 0) {
      const teamId = teams[0].id;

      // 관련 데이터 삭제
      await pool.query('DELETE FROM team_events WHERE team_id = ?', [teamId]);
      await pool.query('DELETE FROM team_sponsors WHERE team_id = ?', [teamId]);
      await pool.query('DELETE FROM financial_records WHERE team_id = ?', [teamId]);
      await pool.query('DELETE FROM contract_negotiations WHERE team_id = ?', [teamId]);
      await pool.query('DELETE FROM player_ownership WHERE team_id = ?', [teamId]);
      await pool.query('DELETE FROM team_facilities WHERE team_id = ?', [teamId]);
      await pool.query('DELETE FROM team_coaches WHERE team_id = ?', [teamId]);
      await pool.query('DELETE FROM match_results WHERE home_team_id = ? OR away_team_id = ?', [teamId, teamId]);
      await pool.query('DELETE FROM league_standings WHERE team_id = ?', [teamId]);
      await pool.query('DELETE FROM teams WHERE id = ?', [teamId]);
    }

    await pool.query('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ success: true, message: '유저가 삭제되었습니다' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '유저 삭제 실패' });
  }
});

// 리그 목록 조회
router.get('/leagues', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const leagues = await pool.query(
      `SELECT l.*,
              (SELECT COUNT(*) FROM league_standings WHERE league_id = l.id) as team_count
       FROM leagues l
       ORDER BY l.created_at DESC`
    );
    res.json(leagues);
  } catch (error) {
    console.error('Get leagues error:', error);
    res.status(500).json({ error: '리그 목록 조회 실패' });
  }
});

// 새 시즌 리그 생성 (EAST, WEST)
router.post('/leagues/create-season', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { season_number } = req.body;

    // 기존 활성 리그 비활성화
    await pool.query(`UPDATE leagues SET status = 'FINISHED' WHERE status = 'ACTIVE'`);

    // EAST 리그 생성
    const eastResult = await pool.query(
      `INSERT INTO leagues (name, season, region, status) VALUES (?, ?, 'EAST', 'ACTIVE')`,
      [`EAST League S${season_number}`, season_number]
    );

    // WEST 리그 생성
    const westResult = await pool.query(
      `INSERT INTO leagues (name, season, region, status) VALUES (?, ?, 'WEST', 'ACTIVE')`,
      [`WEST League S${season_number}`, season_number]
    );

    res.json({
      success: true,
      message: `시즌 ${season_number} 리그가 생성되었습니다`,
      east_league_id: eastResult.insertId,
      west_league_id: westResult.insertId
    });
  } catch (error) {
    console.error('Create season error:', error);
    res.status(500).json({ error: '시즌 생성 실패' });
  }
});

// 팀을 리그에 배정
router.post('/leagues/:leagueId/add-team', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    const { team_id } = req.body;

    // 이미 해당 시즌에 배정되었는지 확인
    const existing = await pool.query(
      `SELECT ls.* FROM league_standings ls
       JOIN leagues l ON ls.league_id = l.id
       WHERE ls.team_id = ? AND l.status = 'ACTIVE'`,
      [team_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: '이미 이번 시즌 리그에 배정된 팀입니다' });
    }

    await pool.query(
      `INSERT INTO league_standings (league_id, team_id, wins, losses, points) VALUES (?, ?, 0, 0, 0)`,
      [leagueId, team_id]
    );

    res.json({ success: true, message: '팀이 리그에 배정되었습니다' });
  } catch (error) {
    console.error('Add team to league error:', error);
    res.status(500).json({ error: '팀 배정 실패' });
  }
});

// 월즈 토너먼트 생성 (각 리그 상위 4팀)
router.post('/worlds/create', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { season_number } = req.body;

    // EAST 상위 4팀
    const eastTeams = await pool.query(
      `SELECT ls.team_id, t.name as team_name
       FROM league_standings ls
       JOIN leagues l ON ls.league_id = l.id
       JOIN teams t ON ls.team_id = t.id
       WHERE l.region = 'EAST' AND l.status = 'ACTIVE'
       ORDER BY ls.points DESC, ls.wins DESC
       LIMIT 4`
    );

    // WEST 상위 4팀
    const westTeams = await pool.query(
      `SELECT ls.team_id, t.name as team_name
       FROM league_standings ls
       JOIN leagues l ON ls.league_id = l.id
       JOIN teams t ON ls.team_id = t.id
       WHERE l.region = 'WEST' AND l.status = 'ACTIVE'
       ORDER BY ls.points DESC, ls.wins DESC
       LIMIT 4`
    );

    if (eastTeams.length < 4 || westTeams.length < 4) {
      return res.status(400).json({
        error: '각 리그에 최소 4팀이 필요합니다',
        east_count: eastTeams.length,
        west_count: westTeams.length
      });
    }

    // 월즈 토너먼트 생성
    const worldsResult = await pool.query(
      `INSERT INTO tournaments (name, season, type, prize_pool, status) VALUES (?, ?, 'WORLDS', 500000000, 'PENDING')`,
      [`Worlds S${season_number}`, season_number]
    );

    const tournamentId = worldsResult.insertId;

    // 8강 매치 생성 (크로스 매치: EAST 1위 vs WEST 4위 등)
    const matches = [
      { home: eastTeams[0].team_id, away: westTeams[3].team_id, round: 'QUARTER' },
      { home: westTeams[0].team_id, away: eastTeams[3].team_id, round: 'QUARTER' },
      { home: eastTeams[1].team_id, away: westTeams[2].team_id, round: 'QUARTER' },
      { home: westTeams[1].team_id, away: eastTeams[2].team_id, round: 'QUARTER' },
    ];

    for (const match of matches) {
      await pool.query(
        `INSERT INTO tournament_matches (tournament_id, home_team_id, away_team_id, round, status)
         VALUES (?, ?, ?, ?, 'PENDING')`,
        [tournamentId, match.home, match.away, match.round]
      );
    }

    res.json({
      success: true,
      message: '월즈 토너먼트가 생성되었습니다',
      tournament_id: tournamentId,
      teams: {
        east: eastTeams.map((t: any) => t.team_name),
        west: westTeams.map((t: any) => t.team_name)
      }
    });
  } catch (error) {
    console.error('Create worlds error:', error);
    res.status(500).json({ error: '월즈 생성 실패' });
  }
});

// 월즈 경기 결과 입력 및 다음 라운드 진행
router.post('/worlds/:tournamentId/match/:matchId/result', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const tournamentId = parseInt(req.params.tournamentId);
    const matchId = parseInt(req.params.matchId);
    const { winner_team_id, home_score, away_score } = req.body;

    // 경기 결과 업데이트
    await pool.query(
      `UPDATE tournament_matches
       SET winner_team_id = ?, home_score = ?, away_score = ?, status = 'FINISHED'
       WHERE id = ?`,
      [winner_team_id, home_score, away_score, matchId]
    );

    // 현재 라운드 확인
    const match = await pool.query('SELECT round FROM tournament_matches WHERE id = ?', [matchId]);
    const currentRound = match[0].round;

    // 해당 라운드 모든 경기 완료 확인
    const pendingMatches = await pool.query(
      `SELECT COUNT(*) as count FROM tournament_matches
       WHERE tournament_id = ? AND round = ? AND status = 'PENDING'`,
      [tournamentId, currentRound]
    );

    if (pendingMatches[0].count === 0) {
      // 다음 라운드 생성
      const winners = await pool.query(
        `SELECT winner_team_id FROM tournament_matches
         WHERE tournament_id = ? AND round = ? AND status = 'FINISHED'`,
        [tournamentId, currentRound]
      );

      if (currentRound === 'QUARTER' && winners.length === 4) {
        // 4강 생성
        await pool.query(
          `INSERT INTO tournament_matches (tournament_id, home_team_id, away_team_id, round, status) VALUES (?, ?, ?, 'SEMI', 'PENDING')`,
          [tournamentId, winners[0].winner_team_id, winners[1].winner_team_id]
        );
        await pool.query(
          `INSERT INTO tournament_matches (tournament_id, home_team_id, away_team_id, round, status) VALUES (?, ?, ?, 'SEMI', 'PENDING')`,
          [tournamentId, winners[2].winner_team_id, winners[3].winner_team_id]
        );
      } else if (currentRound === 'SEMI' && winners.length === 2) {
        // 결승 생성
        await pool.query(
          `INSERT INTO tournament_matches (tournament_id, home_team_id, away_team_id, round, status) VALUES (?, ?, ?, 'FINAL', 'PENDING')`,
          [tournamentId, winners[0].winner_team_id, winners[1].winner_team_id]
        );
      } else if (currentRound === 'FINAL') {
        // 우승팀에게 5억 지급
        await pool.query(
          `UPDATE teams SET gold = gold + 500000000 WHERE id = ?`,
          [winner_team_id]
        );

        // 토너먼트 종료
        await pool.query(
          `UPDATE tournaments SET status = 'FINISHED', winner_team_id = ? WHERE id = ?`,
          [winner_team_id, tournamentId]
        );

        return res.json({
          success: true,
          message: '월즈가 종료되었습니다! 우승팀에게 5억원이 지급되었습니다.',
          is_finished: true
        });
      }
    }

    res.json({ success: true, message: '경기 결과가 입력되었습니다' });
  } catch (error) {
    console.error('Match result error:', error);
    res.status(500).json({ error: '경기 결과 입력 실패' });
  }
});

// 월즈 토너먼트 상태 조회
router.get('/worlds/:tournamentId', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const tournamentId = parseInt(req.params.tournamentId);

    const tournament = await pool.query('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
    if (tournament.length === 0) {
      return res.status(404).json({ error: '토너먼트를 찾을 수 없습니다' });
    }

    const matches = await pool.query(
      `SELECT tm.*,
              ht.name as home_team_name,
              at.name as away_team_name,
              wt.name as winner_team_name
       FROM tournament_matches tm
       JOIN teams ht ON tm.home_team_id = ht.id
       JOIN teams at ON tm.away_team_id = at.id
       LEFT JOIN teams wt ON tm.winner_team_id = wt.id
       WHERE tm.tournament_id = ?
       ORDER BY FIELD(tm.round, 'QUARTER', 'SEMI', 'FINAL'), tm.id`,
      [tournamentId]
    );

    res.json({
      tournament: tournament[0],
      matches
    });
  } catch (error) {
    console.error('Get worlds error:', error);
    res.status(500).json({ error: '토너먼트 조회 실패' });
  }
});

export default router;
