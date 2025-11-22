import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // 중복 확인
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // 비밀번호 해시
    const passwordHash = await bcrypt.hash(password, 10);

    // 유저 생성
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
      [username, passwordHash, email || null]
    );

    const userId = result.insertId;

    // 팀 자동 생성
    const teamName = `${username}'s Team`;
    const league = Math.random() > 0.5 ? 'EAST' : 'WEST';
    
    const teamResult = await pool.query(
      `INSERT INTO teams (user_id, name, league, gold, diamond) 
       VALUES (?, ?, ?, 100000, 100)`,
      [userId, teamName, league]
    );

    const teamId = teamResult.insertId;

    // 리그 참가
    const leagueResult = await pool.query(
      'SELECT id FROM leagues WHERE region = ? AND season = (SELECT MAX(season) FROM leagues WHERE region = ?)',
      [league, league]
    );

    if (leagueResult.length > 0) {
      await pool.query(
        'INSERT INTO league_participants (league_id, team_id) VALUES (?, ?)',
        [leagueResult[0].id, teamId]
      );
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId, teamId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({ token, userId, teamId });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
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
    res.status(500).json({ error: 'Login failed' });
  }
});

// 현재 유저 정보
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const users = await pool.query('SELECT id, username, email, created_at, last_login FROM users WHERE id = ?', [req.userId]);
    const teams = await pool.query('SELECT * FROM teams WHERE id = ?', [req.teamId]);

    if (users.length === 0 || teams.length === 0) {
      return res.status(404).json({ error: 'User or team not found' });
    }

    res.json({
      user: users[0],
      team: teams[0]
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export default router;

