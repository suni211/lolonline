import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '사용자명과 비밀번호가 필요합니다' });
    }

    // 사용자명 유효성 검사
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '사용자명은 3자 이상 20자 이하여야 합니다' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다' });
    }

    // IP 주소 가져오기
    let ipAddress = req.ip;
    if (!ipAddress) {
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        ipAddress = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]?.trim();
      } else {
        ipAddress = req.connection?.remoteAddress || 'unknown';
      }
    }

    // IP 중복 확인 (같은 IP에서 24시간 이내 회원가입 확인)
    const recentRegistrations = await pool.query(
      `SELECT * FROM users 
       WHERE registration_ip = ? 
       AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [ipAddress]
    );

    if (recentRegistrations.length > 0) {
      return res.status(400).json({ error: '같은 IP에서 24시간 이내에 이미 회원가입하셨습니다' });
    }

    // 사용자명 중복 확인
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: '이미 사용 중인 사용자명입니다' });
    }

    // 비밀번호 해시
    const passwordHash = await bcrypt.hash(password, 10);

    // 유저 생성
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email, registration_ip) VALUES (?, ?, ?, ?)',
      [username, passwordHash, email || null, ipAddress]
    );

    const userId = result.insertId;

    // JWT 토큰 생성 (팀이 없으므로 teamId는 null)
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.json({ token, userId, message: '회원가입 성공', needsTeam: true });
  } catch (error: any) {
    console.error('Registration error:', error);
    // 데이터베이스 에러 상세 정보
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '이미 사용 중인 사용자명입니다' });
    }
    res.status(500).json({ error: '회원가입에 실패했습니다: ' + (error.message || '알 수 없는 오류') });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const users = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 팀 정보 가져오기
    const teams = await pool.query(
      'SELECT id FROM teams WHERE user_id = ?',
      [user.id]
    );

    if (teams.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const teamId = teams[0].id;

    // 마지막 로그인 업데이트
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    const token = jwt.sign(
      { userId: user.id, teamId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({ token, userId: user.id, teamId });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인에 실패했습니다: ' + (error.message || '알 수 없는 오류') });
  }
});

// 현재 유저 정보
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }

    const users = await pool.query(
      'SELECT id, username, email, created_at, last_login FROM users WHERE id = ?', 
      [req.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    // 팀 정보 가져오기 (teamId가 없을 수도 있음)
    let team = null;
    if (req.teamId) {
      const teams = await pool.query('SELECT * FROM teams WHERE id = ?', [req.teamId]);
      if (teams.length > 0) {
        team = teams[0];
      }
    }

    // 팀이 없으면 user_id로 찾기
    if (!team) {
      const teams = await pool.query('SELECT * FROM teams WHERE user_id = ?', [req.userId]);
      if (teams.length > 0) {
        team = teams[0];
      }
    }

    // 팀이 없으면 빈 객체 반환 (에러 아님)
    res.json({
      user: users[0],
      team: team || null
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    console.error('Error details:', error.stack);
    res.status(500).json({ error: '사용자 정보를 가져오는데 실패했습니다: ' + (error.message || '알 수 없는 오류') });
  }
});

export default router;

