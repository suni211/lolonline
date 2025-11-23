import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import LPOLeagueService from '../services/lpoLeagueService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 이미지 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // client/dist/players 폴더에 저장
    const uploadPath = path.join(__dirname, '..', '..', '..', 'client', 'dist', 'players');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // player_id.확장자 형식으로 저장
    const playerId = (req as any).params.playerId;
    const ext = path.extname(file.originalname);
    cb(null, `${playerId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다'));
    }
  }
});

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
      `INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, true)`,
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
      `UPDATE teams SET gold = 1000, diamond = 100, fan_count = 1000 WHERE id = ?`,
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

// 전체 팀 목록 조회
router.get('/teams', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const teams = await pool.query(
      `SELECT id, name, league, is_ai FROM teams ORDER BY league, name`
    );
    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: '팀 목록 조회 실패' });
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

// 새 시즌 리그 생성 (EAST, WEST) + 자동 스케줄 생성
router.post('/leagues/create-season', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { season, eastName, westName } = req.body;

    // 기존 활성 리그 비활성화
    await pool.query(`UPDATE leagues SET status = 'FINISHED' WHERE status = 'ACTIVE'`);

    // EAST 리그 생성
    const eastResult = await pool.query(
      `INSERT INTO leagues (name, season, region, status) VALUES (?, ?, 'EAST', 'UPCOMING')`,
      [eastName || `EAST League S${season}`, season]
    );

    // WEST 리그 생성
    const westResult = await pool.query(
      `INSERT INTO leagues (name, season, region, status) VALUES (?, ?, 'WEST', 'UPCOMING')`,
      [westName || `WEST League S${season}`, season]
    );

    res.json({
      success: true,
      message: `시즌 ${season} 리그가 생성되었습니다`,
      east_league_id: eastResult.insertId,
      west_league_id: westResult.insertId
    });
  } catch (error) {
    console.error('Create season error:', error);
    res.status(500).json({ error: '시즌 생성 실패' });
  }
});

// 리그 스케줄 자동 생성 및 시작
router.post('/leagues/:leagueId/start', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);

    // 리그 참가팀 조회
    const teams = await pool.query(
      `SELECT team_id FROM league_standings WHERE league_id = ?`,
      [leagueId]
    );

    if (teams.length < 2) {
      return res.status(400).json({ error: '최소 2팀이 필요합니다' });
    }

    const teamIds = teams.map((t: any) => t.team_id);

    // 라운드 로빈 스케줄 생성 (각 팀이 다른 모든 팀과 홈/어웨이 1번씩)
    const matches: { home: number; away: number; round: number }[] = [];
    let round = 1;

    // 모든 팀 조합 생성
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        // 홈 경기
        matches.push({ home: teamIds[i], away: teamIds[j], round });
        round++;
        // 어웨이 경기
        matches.push({ home: teamIds[j], away: teamIds[i], round });
        round++;
      }
    }

    // 현재 시간 기준으로 스케줄 생성 (6시간 = 1달)
    const now = Date.now();
    const MS_PER_GAME_MONTH = 6 * 60 * 60 * 1000;
    const MS_PER_GAME_DAY = MS_PER_GAME_MONTH / 30;

    // 경기 간격: 게임 내 2일마다 1경기
    const matchInterval = MS_PER_GAME_DAY * 2;

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const scheduledTime = new Date(now + (i * matchInterval));

      await pool.query(
        `INSERT INTO league_matches (league_id, home_team_id, away_team_id, round, scheduled_at, status)
         VALUES (?, ?, ?, ?, ?, 'SCHEDULED')`,
        [leagueId, match.home, match.away, match.round, scheduledTime]
      );
    }

    // 리그 상태 업데이트
    await pool.query(`UPDATE leagues SET status = 'ACTIVE' WHERE id = ?`, [leagueId]);

    res.json({
      success: true,
      message: `${matches.length}개의 경기가 스케줄되었습니다`,
      matchCount: matches.length
    });
  } catch (error) {
    console.error('Start league error:', error);
    res.status(500).json({ error: '리그 시작 실패' });
  }
});

// 리그 스케줄 조회
router.get('/leagues/:leagueId/schedule', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);

    const matches = await pool.query(
      `SELECT lm.*,
              ht.name as home_team_name,
              at.name as away_team_name
       FROM league_matches lm
       JOIN teams ht ON lm.home_team_id = ht.id
       JOIN teams at ON lm.away_team_id = at.id
       WHERE lm.league_id = ?
       ORDER BY lm.scheduled_at`,
      [leagueId]
    );

    res.json(matches);
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: '스케줄 조회 실패' });
  }
});

// 팀을 리그에 배정
router.post('/leagues/:leagueId/register-team', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    const { teamId } = req.body;

    // 이미 해당 시즌에 배정되었는지 확인
    const existing = await pool.query(
      `SELECT ls.* FROM league_standings ls
       JOIN leagues l ON ls.league_id = l.id
       WHERE ls.team_id = ? AND l.status = 'ACTIVE'`,
      [teamId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: '이미 이번 시즌 리그에 배정된 팀입니다' });
    }

    await pool.query(
      `INSERT INTO league_standings (league_id, team_id, wins, losses, points) VALUES (?, ?, 0, 0, 0)`,
      [leagueId, teamId]
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

// 전체 선수 목록 조회 (어드민용) - pro_players 테이블 사용
router.get('/players', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const players = await pool.query(
      `SELECT id, name, team as team_name, position, base_ovr as overall, face_image
       FROM pro_players
       WHERE is_active = true
       ORDER BY league, team, position`
    );
    res.json(players);
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: '선수 목록 조회 실패' });
  }
});

// 선수 얼굴 이미지 업로드
router.post('/players/:playerId/face', authenticateToken, adminMiddleware, upload.single('image'), async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);

    if (!req.file) {
      return res.status(400).json({ error: '이미지 파일이 필요합니다' });
    }

    // 선수 존재 확인 (pro_players 테이블)
    const players = await pool.query('SELECT id FROM pro_players WHERE id = ?', [playerId]);
    if (players.length === 0) {
      // 업로드된 파일 삭제
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: '선수를 찾을 수 없습니다' });
    }

    // 이미지 경로 저장 (public/players/id.ext 형식)
    const imagePath = `/players/${req.file.filename}`;

    await pool.query(
      'UPDATE pro_players SET face_image = ? WHERE id = ?',
      [imagePath, playerId]
    );

    res.json({
      success: true,
      message: '이미지가 업로드되었습니다',
      imagePath
    });
  } catch (error) {
    console.error('Upload face image error:', error);
    res.status(500).json({ error: '이미지 업로드 실패' });
  }
});

// 선수 얼굴 이미지 삭제
router.delete('/players/:playerId/face', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);

    // 현재 이미지 경로 조회 (pro_players 테이블)
    const players = await pool.query('SELECT face_image FROM pro_players WHERE id = ?', [playerId]);
    if (players.length === 0) {
      return res.status(404).json({ error: '선수를 찾을 수 없습니다' });
    }

    if (players[0].face_image) {
      // 파일 삭제
      const filePath = path.join(__dirname, '..', '..', '..', 'client', 'dist', players[0].face_image);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // DB에서 이미지 경로 제거
    await pool.query('UPDATE pro_players SET face_image = NULL WHERE id = ?', [playerId]);

    res.json({ success: true, message: '이미지가 삭제되었습니다' });
  } catch (error) {
    console.error('Delete face image error:', error);
    res.status(500).json({ error: '이미지 삭제 실패' });
  }
});

// LPO 리그 초기화
router.post('/lpo/initialize', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    await LPOLeagueService.initializeLPOLeagues();
    res.json({ success: true, message: 'LPO 리그가 초기화되었습니다' });
  } catch (error: any) {
    console.error('Initialize LPO error:', error);
    res.status(500).json({ error: 'LPO 리그 초기화 실패: ' + error.message });
  }
});

// 다음 시즌 시작
router.post('/lpo/next-season', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { currentSeason } = req.body;

    if (!currentSeason) {
      return res.status(400).json({ error: '현재 시즌을 입력해주세요' });
    }

    await LPOLeagueService.startNewSeason(currentSeason);
    res.json({ success: true, message: `시즌 ${currentSeason + 1}이 시작되었습니다` });
  } catch (error: any) {
    console.error('Start new season error:', error);
    res.status(500).json({ error: '시즌 시작 실패: ' + error.message });
  }
});

// LPO 리그 현황 조회
router.get('/lpo/status', authenticateToken, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const leagues = await pool.query(
      `SELECT l.*,
              (SELECT COUNT(*) FROM league_participants lp WHERE lp.league_id = l.id) as team_count,
              (SELECT COUNT(*) FROM league_participants lp
               JOIN teams t ON lp.team_id = t.id
               WHERE lp.league_id = l.id AND t.is_ai = true) as ai_team_count,
              (SELECT COUNT(*) FROM league_participants lp
               JOIN teams t ON lp.team_id = t.id
               WHERE lp.league_id = l.id AND t.is_ai = false) as player_team_count
       FROM leagues l
       WHERE l.name LIKE 'LPO%'
       ORDER BY
         CASE l.region
           WHEN 'SUPER' THEN 1
           WHEN 'FIRST' THEN 2
           WHEN 'SECOND' THEN 3
         END,
         l.season DESC`
    );

    res.json(leagues);
  } catch (error) {
    console.error('Get LPO status error:', error);
    res.status(500).json({ error: 'LPO 현황 조회 실패' });
  }
});

export default router;
