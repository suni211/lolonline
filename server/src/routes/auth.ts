import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';

const router = express.Router();

// Google OAuth 클라이언트
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

    // IP 예외 목록 (관리자 등)
    const allowedIPs = ['211.234.48.52'];
    const isAllowedIP = allowedIPs.some(ip => ipAddress?.includes(ip));

    if (!isAllowedIP) {
      // IP 중복 확인 (같은 IP에서 영구 차단)
      const existingRegistrations = await pool.query(
        `SELECT * FROM users WHERE registration_ip = ?`,
        [ipAddress]
      );

      if (existingRegistrations.length > 0) {
        return res.status(400).json({ error: '이 IP에서는 이미 회원가입이 되어 있습니다' });
      }

      // VPN/프록시 감지 (일반적인 VPN IP 패턴 차단)
      const vpnPatterns = [
        /^10\./,           // 사설 IP
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 사설 IP
        /^192\.168\./,     // 사설 IP
      ];

      // 의심스러운 헤더 체크
      const suspiciousHeaders = [
        'via',
        'x-forwarded-for',
        'forwarded',
        'x-real-ip'
      ];

      let proxyDetected = false;
      for (const header of suspiciousHeaders) {
        const value = req.headers[header];
        if (value && header !== 'x-forwarded-for') {
          // x-forwarded-for는 일반적이므로 제외, 나머지는 프록시 의심
          if (header === 'via') {
            proxyDetected = true;
            break;
          }
        }
      }

      if (proxyDetected) {
        return res.status(400).json({ error: 'VPN 또는 프록시 사용이 감지되었습니다. 직접 연결로 시도해주세요.' });
      }
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

    const teamId = teams.length > 0 ? teams[0].id : null;

    // 마지막 로그인 업데이트
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    const token = jwt.sign(
      { userId: user.id, teamId, isAdmin: user.is_admin || false },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({ token, userId: user.id, teamId });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인에 실패했습니다: ' + (error.message || '알 수 없는 오류') });
  }
});

// Google 로그인
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential이 필요합니다' });
    }

    // Google 토큰 검증
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const { sub: googleId, email, name, picture } = payload;

    // 기존 유저 확인 (google_id로)
    let users = await pool.query(
      'SELECT * FROM users WHERE google_id = ?',
      [googleId]
    );

    let userId: number;
    let isNewUser = false;

    if (users.length === 0) {
      // 이메일로 기존 계정 확인
      if (email) {
        const emailUsers = await pool.query(
          'SELECT * FROM users WHERE email = ?',
          [email]
        );

        if (emailUsers.length > 0) {
          // 기존 이메일 계정에 Google 연동
          userId = emailUsers[0].id;
          await pool.query(
            'UPDATE users SET google_id = ?, profile_picture = ? WHERE id = ?',
            [googleId, picture || null, userId]
          );
        } else {
          // 새 유저 생성
          isNewUser = true;
          const username = name || email?.split('@')[0] || `user_${googleId.slice(-8)}`;

          // 유저네임 중복 체크
          let finalUsername = username;
          let counter = 1;
          while (true) {
            const existing = await pool.query(
              'SELECT id FROM users WHERE username = ?',
              [finalUsername]
            );
            if (existing.length === 0) break;
            finalUsername = `${username}_${counter}`;
            counter++;
          }

          const result = await pool.query(
            `INSERT INTO users (username, email, google_id, profile_picture)
             VALUES (?, ?, ?, ?)`,
            [finalUsername, email, googleId, picture || null]
          );
          userId = result.insertId;
        }
      } else {
        // 이메일 없는 경우 새 유저 생성
        isNewUser = true;
        const username = name || `user_${googleId.slice(-8)}`;

        let finalUsername = username;
        let counter = 1;
        while (true) {
          const existing = await pool.query(
            'SELECT id FROM users WHERE username = ?',
            [finalUsername]
          );
          if (existing.length === 0) break;
          finalUsername = `${username}_${counter}`;
          counter++;
        }

        const result = await pool.query(
          `INSERT INTO users (username, google_id, profile_picture)
           VALUES (?, ?, ?)`,
          [finalUsername, googleId, picture || null]
        );
        userId = result.insertId;
      }
    } else {
      userId = users[0].id;
      // 프로필 사진 업데이트
      if (picture) {
        await pool.query(
          'UPDATE users SET profile_picture = ? WHERE id = ?',
          [picture, userId]
        );
      }
    }

    // 팀 정보 가져오기
    const teams = await pool.query(
      'SELECT id FROM teams WHERE user_id = ?',
      [userId]
    );

    const teamId = teams.length > 0 ? teams[0].id : null;

    // 마지막 로그인 업데이트
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [userId]
    );

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId, teamId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      userId,
      teamId,
      isNewUser,
      needsTeam: !teamId
    });
  } catch (error: any) {
    console.error('Google login error:', error);
    res.status(500).json({ error: '구글 로그인에 실패했습니다: ' + (error.message || '알 수 없는 오류') });
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

