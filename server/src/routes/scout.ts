import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  generateScoutDialogue,
  generatePersonality,
  generateContractNegotiationDialogue,
  personalityTraits,
  PersonalityType
} from '../services/geminiService.js';

// 성격에 따른 계약금 배수
const personalityContractModifiers: Record<PersonalityType, number> = {
  LEADER: 1.2,      // 리더형: +20% (적당히 요구)
  REBELLIOUS: 1.5,  // 반항적: +50% (까다로움)
  CALM: 1.0,        // 차분함: 정상
  EMOTIONAL: 1.3,   // 감정적: +30%
  COMPETITIVE: 1.25 // 승부욕: +25%
};

// 협상 결과 계산
function calculateNegotiationResult(
  personality: PersonalityType,
  askingPrice: number,
  offeredPrice: number
): { result: 'ACCEPT' | 'REJECT' | 'COUNTER'; counterPrice?: number; message: string } {
  const ratio = offeredPrice / askingPrice;
  const traits = personalityTraits[personality];

  // 성격에 따른 수락 기준
  const acceptThresholds: Record<PersonalityType, number> = {
    LEADER: 0.85,      // 85% 이상이면 수락
    REBELLIOUS: 0.95,  // 95% 이상이면 수락 (까다로움)
    CALM: 0.75,        // 75% 이상이면 수락 (관대함)
    EMOTIONAL: 0.80,   // 80% 이상이면 수락
    COMPETITIVE: 0.90  // 90% 이상이면 수락
  };

  const acceptThreshold = acceptThresholds[personality];

  if (ratio >= acceptThreshold) {
    return { result: 'ACCEPT', message: '계약 조건을 수락했습니다.' };
  }

  // 너무 낮은 제안은 거절 (협상 결렬)
  const rejectThresholds: Record<PersonalityType, number> = {
    LEADER: 0.5,
    REBELLIOUS: 0.7,   // 30% 이상 깎으면 바로 거절
    CALM: 0.4,
    EMOTIONAL: 0.55,
    COMPETITIVE: 0.6
  };

  if (ratio < rejectThresholds[personality]) {
    return { result: 'REJECT', message: '모욕적인 제안입니다. 협상을 종료합니다.' };
  }

  // 카운터 오퍼 (중간 지점 제안)
  const counterPrice = Math.floor(askingPrice * (0.5 + ratio * 0.5));
  return {
    result: 'COUNTER',
    counterPrice,
    message: `${counterPrice.toLocaleString()} 골드는 되어야 할 것 같습니다.`
  };
}

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

// 스카우터 등급에 따른 선수 오버롤 범위 (현재 선수 오버롤 30~80 기준)
// 범위를 넓게 잡고, 고등급일수록 높은 오버롤 선수가 나올 확률 증가
const getOverallRangeByStarRating = (starRating: number): { min: number; max: number } => {
  switch (starRating) {
    case 5: return { min: 30, max: 80 };   // 5성: 전체 범위 (고오버롤 확률 높음)
    case 4: return { min: 30, max: 80 };   // 4성: 전체 범위
    case 3: return { min: 30, max: 80 };   // 3성: 전체 범위
    case 2: return { min: 30, max: 80 };   // 2성: 전체 범위
    case 1: return { min: 30, max: 80 };   // 1성: 전체 범위
    default: return { min: 30, max: 80 };
  }
};

// 오늘 남은 발굴 횟수 조회
router.get('/daily-limit', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayDiscoveries = await pool.query(
      `SELECT COUNT(*) as count FROM scouter_discoveries
       WHERE team_id = ? AND discovered_at >= ? AND discovered_at < ?`,
      [req.teamId, today, tomorrow]
    );

    const used = todayDiscoveries[0].count;
    const remaining = Math.max(0, 5 - used);

    res.json({
      daily_limit: 5,
      used: used,
      remaining: remaining
    });
  } catch (error: any) {
    console.error('Get daily limit error:', error);
    res.status(500).json({ error: '일일 제한 조회에 실패했습니다' });
  }
});

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

    // 오늘 발굴 횟수 체크 (하루 5회 제한)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayDiscoveries = await pool.query(
      `SELECT COUNT(*) as count FROM scouter_discoveries
       WHERE team_id = ? AND discovered_at >= ? AND discovered_at < ?`,
      [req.teamId, today, tomorrow]
    );

    if (todayDiscoveries[0].count >= 5) {
      return res.status(400).json({ error: '오늘 발굴 횟수를 모두 사용했습니다 (일일 5회 제한)' });
    }

    // 스카우터 정보 조회
    const scouters = await pool.query(
      'SELECT * FROM scouters WHERE id = ? AND team_id = ?',
      [scouterId, req.teamId]
    );

    if (scouters.length === 0) {
      return res.status(404).json({ error: '스카우터를 찾을 수 없습니다' });
    }

    const scouter = scouters[0];

    // 스카우터 등급에 따른 오버롤 범위
    const overallRange = getOverallRangeByStarRating(scouter.star_rating);

    // 소유되지 않은 선수 중에서 오버롤 범위에 맞는 선수 찾기 (후보 20명)
    let query = `
      SELECT pp.*, pp.base_ovr as overall
      FROM pro_players pp
      WHERE NOT EXISTS (
        SELECT 1 FROM player_cards pc WHERE pc.pro_player_id = pp.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM scouter_discoveries sd WHERE sd.pro_player_id = pp.id AND sd.signed = false
      )
      AND pp.base_ovr >= ?
      AND pp.base_ovr <= ?
    `;

    const params: any[] = [overallRange.min, overallRange.max];

    // 스카우터 전문 분야가 있으면 해당 포지션 우선
    if (scouter.specialty) {
      query += ` ORDER BY CASE WHEN pp.position = ? THEN 0 ELSE 1 END, RAND() LIMIT 20`;
      params.push(scouter.specialty);
    } else {
      query += ` ORDER BY RAND() LIMIT 20`;
    }

    const candidates = await pool.query(query, params);

    if (candidates.length === 0) {
      return res.status(400).json({ error: '발굴할 수 있는 선수가 없습니다' });
    }

    // 스카우터 등급에 따른 가중치 기반 선택
    // 높은 등급일수록 높은 오버롤 선수 확률 증가
    const getWeight = (ovr: number): number => {
      switch (scouter.star_rating) {
        case 5: return Math.pow(ovr, 3);      // 5성: 오버롤^3 가중치
        case 4: return Math.pow(ovr, 2);      // 4성: 오버롤^2 가중치
        case 3: return ovr;                   // 3성: 오버롤 가중치
        case 2: return 1;                     // 2성: 균등 확률
        case 1: return 1 / (ovr + 1);         // 1성: 낮은 오버롤 유리
        default: return 1;
      }
    };

    // 가중치 합계 계산
    const totalWeight = candidates.reduce((sum: number, p: any) => sum + getWeight(p.overall), 0);

    // 가중치 기반 랜덤 선택
    let random = Math.random() * totalWeight;
    let selectedPlayer = candidates[0];

    for (const candidate of candidates) {
      random -= getWeight(candidate.overall);
      if (random <= 0) {
        selectedPlayer = candidate;
        break;
      }
    }

    const players = [selectedPlayer];

    if (players.length === 0) {
      return res.status(400).json({ error: '발굴할 수 있는 선수가 없습니다' });
    }

    const player = players[0];

    // 스탯 및 성격 미리 생성 (협상에 사용)
    // 총합이 baseOvr * 4가 되도록 스탯 분배
    const baseOvr = player.overall;
    const totalStats = baseOvr * 4;

    // 4개 스탯을 랜덤하게 분배하되 총합 유지
    let remaining = totalStats;
    const baseStat = Math.floor(totalStats / 4);
    const variance = 10; // 스탯 간 편차

    // 먼저 3개 스탯을 랜덤하게 생성
    const mental = Math.max(1, Math.min(200, baseStat + Math.floor(Math.random() * variance * 2) - variance));
    remaining -= mental;

    const teamfight = Math.max(1, Math.min(200, baseStat + Math.floor(Math.random() * variance * 2) - variance));
    remaining -= teamfight;

    const focus = Math.max(1, Math.min(200, baseStat + Math.floor(Math.random() * variance * 2) - variance));
    remaining -= focus;

    // 마지막 스탯은 나머지로 설정하여 총합 보장
    const laning = Math.max(1, Math.min(200, remaining));

    const personality = generatePersonality(mental);

    // 발굴 기록 저장 (스카우터 정보 및 성격/스탯 저장)
    await pool.query(
      `INSERT INTO scouter_discoveries (scouter_id, team_id, pro_player_id, scouter_name, scouter_star, personality, mental, teamfight, focus, laning)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [scouterId, req.teamId, player.id, scouter.name, scouter.star_rating, personality, mental, teamfight, focus, laning]
    );

    // 스카우터는 일회용 - 발굴 후 삭제
    await pool.query('DELETE FROM scouters WHERE id = ?', [scouterId]);

    // 성격 정보
    const traits = personalityTraits[personality as PersonalityType];

    res.json({
      success: true,
      message: `${scouter.name} 스카우터가 ${player.name} 선수를 발굴하고 떠났습니다!`,
      player: {
        id: player.id,
        name: player.name,
        position: player.position,
        nationality: player.nationality,
        overall: player.overall,
        face_image: player.face_image,
        personality: {
          type: personality,
          name: traits.name
        }
      }
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
              pp.base_ovr as overall
       FROM scouter_discoveries sd
       INNER JOIN pro_players pp ON sd.pro_player_id = pp.id
       WHERE sd.team_id = ? AND sd.signed = false
       ORDER BY sd.discovered_at DESC`,
      [req.teamId]
    );

    // 성격 정보 및 요구 금액 추가
    const enrichedDiscoveries = discoveries.map((d: any) => {
      const personality = (d.personality || 'CALM') as PersonalityType;
      const traits = personalityTraits[personality];
      const baseCost = d.overall * 100000;
      const modifier = personalityContractModifiers[personality];
      const askingPrice = Math.floor(baseCost * modifier);

      return {
        ...d,
        personality_info: {
          type: personality,
          name: traits.name
        },
        asking_price: askingPrice
      };
    });

    res.json(enrichedDiscoveries);
  } catch (error: any) {
    console.error('Get discoveries error:', error);
    res.status(500).json({ error: '발굴 선수 목록 조회에 실패했습니다' });
  }
});

// 협상 정보 조회 (초기 요구 금액 등)
router.get('/discoveries/:discoveryId/negotiation', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const discoveryId = parseInt(req.params.discoveryId);

    const discoveries = await pool.query(
      `SELECT sd.*, pp.name, pp.position, pp.nationality, pp.face_image,
              pp.base_ovr as overall
       FROM scouter_discoveries sd
       INNER JOIN pro_players pp ON sd.pro_player_id = pp.id
       WHERE sd.id = ? AND sd.team_id = ? AND sd.signed = false`,
      [discoveryId, req.teamId]
    );

    if (discoveries.length === 0) {
      return res.status(404).json({ error: '발굴 기록을 찾을 수 없습니다' });
    }

    const discovery = discoveries[0];
    const baseOvr = discovery.overall;

    // 저장된 성격 사용 (발굴 시 저장됨)
    const personality = (discovery.personality || 'CALM') as PersonalityType;

    // 기본 계약금 (OVR * 100000)
    const baseCost = baseOvr * 100000;

    // 성격에 따른 요구 금액
    const modifier = personalityContractModifiers[personality];
    const askingPrice = Math.floor(baseCost * modifier);

    const traits = personalityTraits[personality];

    res.json({
      discovery_id: discoveryId,
      player: {
        name: discovery.name,
        position: discovery.position,
        overall: discovery.overall,
        face_image: discovery.face_image
      },
      personality: {
        type: personality,
        name: traits.name,
        description: traits.description
      },
      base_cost: baseCost,
      asking_price: askingPrice,
      modifier: modifier
    });
  } catch (error: any) {
    console.error('Get negotiation info error:', error);
    res.status(500).json({ error: '협상 정보 조회에 실패했습니다' });
  }
});

// 발굴된 선수 영입 (계약 협상)
router.post('/discoveries/:discoveryId/sign', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const discoveryId = parseInt(req.params.discoveryId);
    const { offered_price } = req.body;

    if (!offered_price || offered_price <= 0) {
      return res.status(400).json({ error: '제안 금액을 입력해주세요' });
    }

    // 발굴 기록 조회
    const discoveries = await pool.query(
      `SELECT sd.id, sd.scouter_id, sd.team_id, sd.pro_player_id, sd.scouter_name,
              sd.scouter_star, sd.personality, sd.mental, sd.teamfight, sd.focus,
              sd.laning, sd.signed, sd.discovered_at,
              pp.name, pp.position, pp.nationality, pp.face_image, pp.base_ovr as overall
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
      await pool.query('DELETE FROM scouter_discoveries WHERE id = ?', [discoveryId]);
      return res.status(400).json({ error: '이 선수는 이미 다른 팀에 소속되었습니다' });
    }

    // 저장된 스탯 및 성격 사용 (발굴 시 저장됨)
    const baseOvr = discovery.overall;
    const mental = discovery.mental || Math.floor(baseOvr / 4);
    const teamfight = discovery.teamfight || Math.floor(baseOvr / 4);
    const focus = discovery.focus || Math.floor(baseOvr / 4);
    const laning = discovery.laning || Math.floor(baseOvr / 4);
    const personality = (discovery.personality || 'CALM') as PersonalityType;

    // 요구 금액 계산
    const baseCost = baseOvr * 100000;
    const modifier = personalityContractModifiers[personality];
    const askingPrice = Math.floor(baseCost * modifier);

    // 협상 결과 계산
    const negotiationResult = calculateNegotiationResult(personality, askingPrice, offered_price);

    // AI 대사 생성
    const dialogue = await generateContractNegotiationDialogue(
      discovery.name,
      personality,
      offered_price,
      askingPrice,
      negotiationResult.result,
      negotiationResult.counterPrice
    );

    // 거절된 경우 - 선수가 떠남
    if (negotiationResult.result === 'REJECT') {
      await pool.query('DELETE FROM scouter_discoveries WHERE id = ?', [discoveryId]);

      return res.json({
        success: false,
        result: 'REJECT',
        message: '협상이 결렬되어 선수가 떠났습니다.',
        dialogue,
        player: {
          name: discovery.name,
          personality: personality
        }
      });
    }

    // 카운터 오퍼인 경우 - 추가 협상 필요
    if (negotiationResult.result === 'COUNTER') {
      return res.json({
        success: false,
        result: 'COUNTER',
        message: negotiationResult.message,
        dialogue,
        counter_price: negotiationResult.counterPrice,
        player: {
          name: discovery.name,
          personality: personality,
          overall: discovery.overall
        }
      });
    }

    // 수락된 경우 - 계약 체결
    const finalCost = offered_price;

    // 팀 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams[0].gold < finalCost) {
      return res.status(400).json({
        error: `계약금이 부족합니다. 필요: ${finalCost.toLocaleString()} 골드`
      });
    }

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [finalCost, req.teamId]);

    // OVR 계산
    const ovr = Math.round((mental + teamfight + focus + laning) / 4);

    // 선수 카드 생성
    const result = await pool.query(
      `INSERT INTO player_cards (
        pro_player_id, team_id, mental, teamfight, focus, laning,
        ovr, card_type, personality, is_starter, is_contracted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NORMAL', ?, false, true)`,
      [
        discovery.pro_player_id,
        req.teamId,
        mental,
        teamfight,
        focus,
        laning,
        ovr,
        personality
      ]
    );

    // 발굴 기록 업데이트
    await pool.query('UPDATE scouter_discoveries SET signed = true WHERE id = ?', [discoveryId]);

    res.json({
      success: true,
      result: 'ACCEPT',
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
      cost: finalCost,
      saved: askingPrice - finalCost
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
