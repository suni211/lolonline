import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  generateScoutDialogue,
  generatePersonality,
  PersonalityType
} from '../services/geminiService.js';

const router = express.Router();

// 스카우터 이름 목록
const scouterNames = [
  '김정훈', '이상민', '박성호', '최영준', '정대영',
  '한승우', '조민수', '윤재현', '임동혁', '강태준',
  '신현우', '오준혁', '전성민', '황민규', '배진호'
];

// 스카우터 영입 비용 (성급별)
const scouterCosts: Record<number, number> = {
  1: 1000000,     // 1성: 100만
  2: 5000000,     // 2성: 500만
  3: 20000000,    // 3성: 2000만
  4: 50000000,    // 4성: 5000만
  5: 100000000    // 5성: 1억
};

// 스카우터 영입 확률 (금액별)
const getScouterStarProbability = (cost: number): number[] => {
  // 비용이 높을수록 고성급 확률 증가
  if (cost >= 100000000) {
    return [5, 10, 25, 35, 25]; // 5성 25% 확률
  } else if (cost >= 50000000) {
    return [10, 15, 30, 30, 15]; // 4성 30%, 5성 15%
  } else if (cost >= 20000000) {
    return [15, 25, 35, 20, 5]; // 3성 35%
  } else if (cost >= 5000000) {
    return [30, 35, 25, 8, 2]; // 2성 35%
  } else {
    return [50, 30, 15, 4, 1]; // 1성 50%
  }
};

// 스카우터 등급에 따른 선수 오버롤 범위 (현재 선수 오버롤 40~100 기준)
const getOverallRangeByStarRating = (starRating: number): { min: number; max: number } => {
  switch (starRating) {
    case 5: return { min: 80, max: 120 };   // 5성: 최상급 선수
    case 4: return { min: 60, max: 100 };   // 4성: 상급 선수
    case 3: return { min: 45, max: 80 };    // 3성: 중급 선수
    case 2: return { min: 30, max: 60 };    // 2성: 하급 선수
    case 1: return { min: 20, max: 45 };    // 1성: 최하급 선수
    default: return { min: 20, max: 45 };
  }
};

// 팀의 스카우터 목록 조회
router.get('/scouters', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const scouters = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM scouter_discoveries sd WHERE sd.scouter_id = s.id AND sd.signed = false) as pending_discoveries
       FROM scouters s
       WHERE s.team_id = ?
       ORDER BY s.star_rating DESC, s.hired_at DESC`,
      [req.teamId]
    );

    res.json(scouters);
  } catch (error: any) {
    console.error('Get scouters error:', error);
    res.status(500).json({ error: '스카우터 목록 조회에 실패했습니다' });
  }
});

// 스카우터 영입
router.post('/hire-scouter', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { cost } = req.body;

    if (!cost || cost < 1000000) {
      return res.status(400).json({ error: '최소 100만 골드 이상이 필요합니다' });
    }

    // 팀 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0) {
      return res.status(404).json({ error: '팀을 찾을 수 없습니다' });
    }

    if (teams[0].gold < cost) {
      return res.status(400).json({ error: '골드가 부족합니다' });
    }

    // 스카우터 성급 결정
    const probabilities = getScouterStarProbability(cost);
    const roll = Math.random() * 100;
    let cumulative = 0;
    let starRating = 1;

    for (let i = 0; i < probabilities.length; i++) {
      cumulative += probabilities[i];
      if (roll < cumulative) {
        starRating = i + 1;
        break;
      }
    }

    // 스카우터 이름 랜덤 선택
    const name = scouterNames[Math.floor(Math.random() * scouterNames.length)];

    // 전문 분야 랜덤 선택
    const specialties = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', null];
    const specialty = specialties[Math.floor(Math.random() * specialties.length)];

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [cost, req.teamId]);

    // 스카우터 생성
    const result = await pool.query(
      `INSERT INTO scouters (team_id, name, star_rating, specialty) VALUES (?, ?, ?, ?)`,
      [req.teamId, name, starRating, specialty]
    );

    res.json({
      success: true,
      message: `${starRating}성 스카우터 ${name}을(를) 영입했습니다!`,
      scouter: {
        id: result.insertId,
        name,
        star_rating: starRating,
        specialty
      },
      cost
    });
  } catch (error: any) {
    console.error('Hire scouter error:', error);
    res.status(500).json({ error: '스카우터 영입에 실패했습니다' });
  }
});

// 스카우터 해고
router.delete('/scouters/:scouterId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const scouterId = parseInt(req.params.scouterId);

    // 스카우터가 팀 소속인지 확인
    const scouters = await pool.query(
      'SELECT * FROM scouters WHERE id = ? AND team_id = ?',
      [scouterId, req.teamId]
    );

    if (scouters.length === 0) {
      return res.status(404).json({ error: '스카우터를 찾을 수 없습니다' });
    }

    // 스카우터 삭제 (발굴 기록도 CASCADE로 삭제됨)
    await pool.query('DELETE FROM scouters WHERE id = ?', [scouterId]);

    res.json({ success: true, message: '스카우터를 해고했습니다' });
  } catch (error: any) {
    console.error('Fire scouter error:', error);
    res.status(500).json({ error: '스카우터 해고에 실패했습니다' });
  }
});

// 스카우터로 선수 발굴
router.post('/scouters/:scouterId/discover', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const scouterId = parseInt(req.params.scouterId);

    // 스카우터 정보 조회
    const scouters = await pool.query(
      'SELECT * FROM scouters WHERE id = ? AND team_id = ?',
      [scouterId, req.teamId]
    );

    if (scouters.length === 0) {
      return res.status(404).json({ error: '스카우터를 찾을 수 없습니다' });
    }

    const scouter = scouters[0];

    // 발굴 비용 (스카우터 등급 * 50만)
    const discoverCost = scouter.star_rating * 500000;

    // 팀 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams[0].gold < discoverCost) {
      return res.status(400).json({
        error: `발굴 비용이 부족합니다. 필요: ${discoverCost.toLocaleString()} 골드`
      });
    }

    // 스카우터 등급에 따른 오버롤 범위
    const overallRange = getOverallRangeByStarRating(scouter.star_rating);

    // 소유되지 않은 선수 중에서 오버롤 범위에 맞는 선수 찾기
    let query = `
      SELECT pp.*, (pp.mental + pp.teamfight + pp.focus + pp.laning) as overall
      FROM pro_players pp
      WHERE NOT EXISTS (
        SELECT 1 FROM player_cards pc WHERE pc.pro_player_id = pp.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM scouter_discoveries sd WHERE sd.pro_player_id = pp.id AND sd.signed = false
      )
      AND (pp.mental + pp.teamfight + pp.focus + pp.laning) >= ?
      AND (pp.mental + pp.teamfight + pp.focus + pp.laning) <= ?
    `;

    const params: any[] = [overallRange.min, overallRange.max];

    // 스카우터 전문 분야가 있으면 해당 포지션 우선
    if (scouter.specialty) {
      query += ' ORDER BY CASE WHEN pp.position = ? THEN 0 ELSE 1 END, RAND() LIMIT 1';
      params.push(scouter.specialty);
    } else {
      query += ' ORDER BY RAND() LIMIT 1';
    }

    const players = await pool.query(query, params);

    if (players.length === 0) {
      return res.status(400).json({ error: '발굴할 수 있는 선수가 없습니다' });
    }

    const player = players[0];

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [discoverCost, req.teamId]);

    // 발굴 기록 저장
    await pool.query(
      `INSERT INTO scouter_discoveries (scouter_id, team_id, pro_player_id) VALUES (?, ?, ?)`,
      [scouterId, req.teamId, player.id]
    );

    res.json({
      success: true,
      message: `${scouter.name} 스카우터가 ${player.name} 선수를 발굴했습니다!`,
      player: {
        id: player.id,
        name: player.name,
        position: player.position,
        nationality: player.nationality,
        mental: player.mental,
        teamfight: player.teamfight,
        focus: player.focus,
        laning: player.laning,
        overall: player.overall,
        face_image: player.face_image
      },
      cost: discoverCost
    });
  } catch (error: any) {
    console.error('Discover player error:', error);
    res.status(500).json({ error: '선수 발굴에 실패했습니다' });
  }
});

// 발굴된 선수 목록 조회
router.get('/discoveries', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const discoveries = await pool.query(
      `SELECT sd.*, pp.name, pp.position, pp.nationality, pp.face_image,
              pp.mental, pp.teamfight, pp.focus, pp.laning,
              (pp.mental + pp.teamfight + pp.focus + pp.laning) as overall,
              s.name as scouter_name, s.star_rating as scouter_star
       FROM scouter_discoveries sd
       INNER JOIN pro_players pp ON sd.pro_player_id = pp.id
       INNER JOIN scouters s ON sd.scouter_id = s.id
       WHERE sd.team_id = ? AND sd.signed = false
       ORDER BY sd.discovered_at DESC`,
      [req.teamId]
    );

    res.json(discoveries);
  } catch (error: any) {
    console.error('Get discoveries error:', error);
    res.status(500).json({ error: '발굴 선수 목록 조회에 실패했습니다' });
  }
});

// 발굴된 선수 영입 (계약)
router.post('/discoveries/:discoveryId/sign', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const discoveryId = parseInt(req.params.discoveryId);

    // 발굴 기록 조회
    const discoveries = await pool.query(
      `SELECT sd.*, pp.*, (pp.mental + pp.teamfight + pp.focus + pp.laning) as overall
       FROM scouter_discoveries sd
       INNER JOIN pro_players pp ON sd.pro_player_id = pp.id
       WHERE sd.id = ? AND sd.team_id = ? AND sd.signed = false`,
      [discoveryId, req.teamId]
    );

    if (discoveries.length === 0) {
      return res.status(404).json({ error: '발굴 기록을 찾을 수 없습니다' });
    }

    const discovery = discoveries[0];

    // 이미 다른 팀에 소속된 선수인지 확인
    const existingCards = await pool.query(
      'SELECT * FROM player_cards WHERE pro_player_id = ?',
      [discovery.pro_player_id]
    );

    if (existingCards.length > 0) {
      // 발굴 기록 삭제
      await pool.query('DELETE FROM scouter_discoveries WHERE id = ?', [discoveryId]);
      return res.status(400).json({ error: '이 선수는 이미 다른 팀에 소속되었습니다' });
    }

    // 계약금 (오버롤 * 1000)
    const signCost = discovery.overall * 1000;

    // 팀 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams[0].gold < signCost) {
      return res.status(400).json({
        error: `계약금이 부족합니다. 필요: ${signCost.toLocaleString()} 골드`
      });
    }

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [signCost, req.teamId]);

    // 성격 생성
    const personality = generatePersonality(discovery.mental);

    // 선수 카드 생성
    const result = await pool.query(
      `INSERT INTO player_cards (
        pro_player_id, team_id, mental, teamfight, focus, laning,
        condition_value, form, personality, is_starter
      ) VALUES (?, ?, ?, ?, ?, ?, 100, 'NORMAL', ?, false)`,
      [
        discovery.pro_player_id,
        req.teamId,
        discovery.mental,
        discovery.teamfight,
        discovery.focus,
        discovery.laning,
        personality
      ]
    );

    // 발굴 기록 업데이트
    await pool.query('UPDATE scouter_discoveries SET signed = true WHERE id = ?', [discoveryId]);

    // AI 대사 생성
    const dialogue = await generateScoutDialogue(
      discovery.name,
      discovery.position,
      personality,
      discovery.overall,
      'SUCCESS'
    );

    res.json({
      success: true,
      message: `${discovery.name} 선수와 계약을 체결했습니다!`,
      player_card_id: result.insertId,
      player: {
        id: result.insertId,
        name: discovery.name,
        position: discovery.position,
        overall: discovery.overall,
        personality
      },
      dialogue,
      cost: signCost
    });
  } catch (error: any) {
    console.error('Sign discovered player error:', error);
    res.status(500).json({ error: '선수 계약에 실패했습니다' });
  }
});

// 발굴된 선수 거절 (삭제)
router.delete('/discoveries/:discoveryId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const discoveryId = parseInt(req.params.discoveryId);

    const result = await pool.query(
      'DELETE FROM scouter_discoveries WHERE id = ? AND team_id = ? AND signed = false',
      [discoveryId, req.teamId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '발굴 기록을 찾을 수 없습니다' });
    }

    res.json({ success: true, message: '발굴 기록을 삭제했습니다' });
  } catch (error: any) {
    console.error('Reject discovery error:', error);
    res.status(500).json({ error: '발굴 기록 삭제에 실패했습니다' });
  }
});

// 스카우트 기록 조회
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const history = await pool.query(
      `SELECT sh.*, pp.name, pp.position
       FROM scout_history sh
       INNER JOIN pro_players pp ON sh.pro_player_id = pp.id
       WHERE sh.team_id = ?
       ORDER BY sh.created_at DESC
       LIMIT 50`,
      [req.teamId]
    );

    res.json(history);
  } catch (error: any) {
    console.error('Get scout history error:', error);
    res.status(500).json({ error: '스카우트 기록 조회에 실패했습니다' });
  }
});

export default router;
