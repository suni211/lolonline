import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 내 감독/코치 목록
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const coaches = await pool.query(
      `SELECT c.*, co.acquired_at 
       FROM coaches c
       INNER JOIN coach_ownership co ON c.id = co.coach_id
       WHERE co.team_id = ?`,
      [req.teamId]
    );

    res.json(coaches);
  } catch (error: any) {
    console.error('Get coaches error:', error);
    res.status(500).json({ error: 'Failed to get coaches' });
  }
});

// 감독/코치 스카우팅
router.post('/scout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { cost_type } = req.body;
    const cost = cost_type === 'diamond' ? 20 : 2000;

    // 재화 확인
    const teams = await pool.query('SELECT gold, diamond FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teams[0];
    if (cost_type === 'diamond' && team.diamond < cost) {
      return res.status(400).json({ error: 'Insufficient diamond' });
    }
    if (cost_type === 'gold' && team.gold < cost) {
      return res.status(400).json({ error: 'Insufficient gold' });
    }

    // 재화 차감
    if (cost_type === 'diamond') {
      await pool.query('UPDATE teams SET diamond = diamond - ? WHERE id = ?', [cost, req.teamId]);
    } else {
      await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [cost, req.teamId]);
    }

    // 이미 소유된 감독/코치는 제외하고 랜덤 선택
    const availableCoaches = await pool.query(
      `SELECT c.* FROM coaches c
       LEFT JOIN coach_ownership co ON c.id = co.coach_id
       WHERE co.coach_id IS NULL`
    );

    if (availableCoaches.length === 0) {
      // 새로운 감독/코치 생성
      const roles: ('HEAD_COACH' | 'ASSISTANT_COACH')[] = ['HEAD_COACH', 'ASSISTANT_COACH'];
      const role = roles[Math.floor(Math.random() * roles.length)];
      
      const coachNames = [
        'kkOma', 'Bengi', 'Score', 'RapidStar', 'NoFe', 'Zefa', 'Kim', 'Edgar',
        'Homme', 'Mafa', 'Ssong', 'CvMax', 'Dragon', 'Hirai', 'Ggoong', 'Reapered'
      ];
      
      const nationalities = ['KR', 'CN', 'EU', 'NA'];
      const name = coachNames[Math.floor(Math.random() * coachNames.length)];
      const nationality = nationalities[Math.floor(Math.random() * nationalities.length)];
      
      const scoutingAbility = 50 + Math.floor(Math.random() * 50);
      const trainingBoost = 1.0 + (Math.random() * 0.5); // 1.0 ~ 1.5

      const result = await pool.query(
        `INSERT INTO coaches (name, nationality, role, scouting_ability, training_boost) 
         VALUES (?, ?, ?, ?, ?)`,
        [name, nationality, role, scoutingAbility, trainingBoost]
      );

      const newCoach = await pool.query('SELECT * FROM coaches WHERE id = ?', [result.insertId]);
      
      // 선수 소유권 추가
      await pool.query(
        'INSERT INTO coach_ownership (coach_id, team_id) VALUES (?, ?)',
        [result.insertId, req.teamId]
      );

      res.json({ coach: newCoach[0], message: 'Coach scouted successfully' });
    } else {
      const selectedCoach = availableCoaches[Math.floor(Math.random() * availableCoaches.length)];

      // 감독/코치 소유권 추가
      await pool.query(
        'INSERT INTO coach_ownership (coach_id, team_id) VALUES (?, ?)',
        [selectedCoach.id, req.teamId]
      );

      res.json({ coach: selectedCoach, message: 'Coach scouted successfully' });
    }
  } catch (error: any) {
    console.error('Scout coach error:', error);
    res.status(500).json({ error: 'Failed to scout coach' });
  }
});

// 감독/코치 검색
router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, role } = req.query;

    let query = `
      SELECT c.*, COUNT(co2.coach_id) as owned_count
      FROM coaches c
      LEFT JOIN coach_ownership co ON c.id = co.coach_id AND co.team_id = ?
      LEFT JOIN coach_ownership co2 ON c.id = co2.coach_id
      WHERE co.coach_id IS NULL
    `;

    const params: any[] = [req.teamId];

    if (name) {
      query += ' AND c.name LIKE ?';
      params.push(`%${name}%`);
    }

    if (role) {
      query += ' AND c.role = ?';
      params.push(role);
    }

    query += ' GROUP BY c.id';

    const coaches = await pool.query(query, params);
    res.json(coaches);
  } catch (error: any) {
    console.error('Search coaches error:', error);
    res.status(500).json({ error: 'Failed to search coaches' });
  }
});

export default router;

