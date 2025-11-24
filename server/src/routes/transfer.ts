import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { generatePersonality, generateContractNegotiationDialogue, generateTransferBlockedDialogue, personalityTraits, PersonalityType } from '../services/geminiService.js';
import { NewsService } from '../services/newsService.js';

const router = express.Router();

// 성격에 따른 계약금 배수
const personalityContractModifiers: Record<PersonalityType, number> = {
  LEADER: 1.2,
  REBELLIOUS: 1.5,
  CALM: 1.0,
  EMOTIONAL: 1.3,
  COMPETITIVE: 1.25,
  TIMID: 0.7,
  GREEDY: 1.8,
  LOYAL: 0.9,
  PERFECTIONIST: 1.3,
  LAZY: 0.8
};

// 협상 결과 계산
function calculateNegotiationResult(
  personality: PersonalityType,
  askingPrice: number,
  offeredPrice: number
): { result: 'ACCEPT' | 'REJECT' | 'COUNTER'; counterPrice?: number; message: string } {
  const ratio = offeredPrice / askingPrice;

  const acceptThresholds: Record<PersonalityType, number> = {
    LEADER: 0.85,
    REBELLIOUS: 0.95,
    CALM: 0.75,
    EMOTIONAL: 0.80,
    COMPETITIVE: 0.90,
    TIMID: 0.50,
    GREEDY: 0.98,
    LOYAL: 0.70,
    PERFECTIONIST: 0.88,
    LAZY: 0.60
  };

  if (ratio >= acceptThresholds[personality]) {
    return { result: 'ACCEPT', message: '계약 조건을 수락했습니다.' };
  }

  const rejectThresholds: Record<PersonalityType, number> = {
    LEADER: 0.5,
    REBELLIOUS: 0.7,
    CALM: 0.4,
    EMOTIONAL: 0.55,
    COMPETITIVE: 0.6,
    TIMID: 0.2,
    GREEDY: 0.8,
    LOYAL: 0.35,
    PERFECTIONIST: 0.6,
    LAZY: 0.3
  };

  if (ratio < rejectThresholds[personality]) {
    return { result: 'REJECT', message: '모욕적인 제안입니다. 협상을 종료합니다.' };
  }

  const counterPrice = Math.floor(askingPrice * (0.5 + ratio * 0.5));
  return {
    result: 'COUNTER',
    counterPrice,
    message: `${counterPrice.toLocaleString()} 골드는 되어야 할 것 같습니다.`
  };
}

// FA 선수 목록 (계약되지 않은 선수만)
router.get('/fa', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { position, league, minOvr, maxOvr, search, sort = 'ovr_desc', page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // 계약되지 않은 선수만 표시
    let whereClause = `WHERE NOT EXISTS (
      SELECT 1 FROM player_cards pc WHERE pc.pro_player_id = pp.id AND pc.is_contracted = true
    )`;
    const params: any[] = [];

    if (position && position !== 'all') {
      whereClause += ' AND pp.position = ?';
      params.push(position);
    }
    if (league && league !== 'all') {
      whereClause += ' AND pp.league = ?';
      params.push(league);
    }
    if (minOvr) {
      whereClause += ' AND COALESCE(pp.base_ovr, 50) >= ?';
      params.push(Number(minOvr));
    }
    if (maxOvr) {
      whereClause += ' AND COALESCE(pp.base_ovr, 50) <= ?';
      params.push(Number(maxOvr));
    }
    if (search) {
      whereClause += ' AND pp.name LIKE ?';
      params.push(`%${search}%`);
    }

    // 카운트 쿼리
    const countQuery = `SELECT COUNT(*) as total FROM pro_players pp ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = countResult[0]?.total || 0;

    // 메인 쿼리
    let query = `
      SELECT pp.id, pp.name, pp.position, pp.nationality, pp.team as original_team,
             pp.league, pp.face_image, COALESCE(pp.base_ovr, 50) as overall
      FROM pro_players pp
      ${whereClause}
    `;

    // 정렬
    if (sort === 'ovr_desc') {
      query += ' ORDER BY COALESCE(pp.base_ovr, 50) DESC';
    } else if (sort === 'ovr_asc') {
      query += ' ORDER BY COALESCE(pp.base_ovr, 50) ASC';
    } else if (sort === 'name') {
      query += ' ORDER BY pp.name ASC';
    } else {
      query += ' ORDER BY COALESCE(pp.base_ovr, 50) DESC';
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const players = await pool.query(query, params);

    const playersWithPrice = players.map((p: any) => ({
      ...p,
      price: p.overall * 100000
    }));

    res.json({
      players: playersWithPrice,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error: any) {
    console.error('Get FA players error:', error);
    res.status(500).json({ error: 'FA 선수 조회 실패' });
  }
});

// FA 선수 협상 시작 (요구 연봉 확인)
router.get('/fa/negotiate/:playerId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);

    const players = await pool.query(
      `SELECT pp.*, COALESCE(pp.base_ovr, 50) as overall FROM pro_players pp WHERE pp.id = ?`,
      [playerId]
    );

    if (players.length === 0) {
      return res.status(404).json({ error: '선수를 찾을 수 없습니다' });
    }

    const player = players[0];

    // 이미 계약된 카드가 있는지 확인
    const existingCards = await pool.query(
      'SELECT * FROM player_cards WHERE pro_player_id = ? AND is_contracted = true',
      [playerId]
    );

    if (existingCards.length > 0) {
      const card = existingCards[0];
      if (card.team_id === req.teamId) {
        return res.status(400).json({ error: '이미 보유한 선수입니다' });
      } else {
        return res.status(400).json({ error: '다른 팀에 계약된 선수입니다' });
      }
    }

    // 스탯 생성 (선수 ID 기반으로 고정)
    const baseOvr = player.overall;
    const totalStats = baseOvr * 4;
    const baseStat = Math.floor(totalStats / 4);
    const variance = 10;

    // 선수 ID를 시드로 사용하여 일관된 스탯 생성
    const seed = playerId;
    const seededRandom = (n: number) => {
      const x = Math.sin(seed * n) * 10000;
      return x - Math.floor(x);
    };

    const mental = Math.max(1, Math.min(200, baseStat + Math.floor(seededRandom(1) * variance * 2) - variance));
    const teamfight = Math.max(1, Math.min(200, baseStat + Math.floor(seededRandom(2) * variance * 2) - variance));
    const focus = Math.max(1, Math.min(200, baseStat + Math.floor(seededRandom(3) * variance * 2) - variance));
    const laning = Math.max(1, Math.min(200, totalStats - mental - teamfight - focus));

    // 성격도 선수 ID 기반으로 고정
    const personalities: PersonalityType[] = ['LEADER', 'REBELLIOUS', 'CALM', 'EMOTIONAL', 'COMPETITIVE', 'TIMID', 'GREEDY', 'LOYAL', 'PERFECTIONIST', 'LAZY'];
    const personalityIndex = Math.floor(seededRandom(4) * personalities.length);
    const personality = personalities[personalityIndex];

    const ovr = Math.round((mental + teamfight + focus + laning) / 4);

    // 요구 연봉 계산
    const baseCost = ovr * 100000;
    const modifier = personalityContractModifiers[personality];
    const askingPrice = Math.floor(baseCost * modifier);

    const traits = personalityTraits[personality];

    res.json({
      player: {
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team,
        league: player.league,
        face_image: player.face_image,
        overall: ovr
      },
      stats: { mental, teamfight, focus, laning },
      personality: {
        type: personality,
        name: traits?.name || personality,
        description: traits?.description || ''
      },
      asking_price: askingPrice,
      base_price: baseCost
    });
  } catch (error: any) {
    console.error('Negotiate FA error:', error);
    res.status(500).json({ error: '협상 시작 실패' });
  }
});

// FA 선수 계약 (연봉협상)
router.post('/fa/sign/:playerId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { offered_price, mental, teamfight, focus, laning, personality } = req.body;

    if (!offered_price || !mental || !teamfight || !focus || !laning || !personality) {
      return res.status(400).json({ error: '협상 정보가 필요합니다' });
    }

    const players = await pool.query(
      `SELECT pp.*, COALESCE(pp.base_ovr, 50) as overall FROM pro_players pp WHERE pp.id = ?`,
      [playerId]
    );

    if (players.length === 0) {
      return res.status(404).json({ error: '선수를 찾을 수 없습니다' });
    }

    const player = players[0];

    // 이미 계약된 카드가 있는지 확인
    const existingCards = await pool.query(
      'SELECT * FROM player_cards WHERE pro_player_id = ? AND is_contracted = true',
      [playerId]
    );

    if (existingCards.length > 0) {
      const card = existingCards[0];
      if (card.team_id === req.teamId) {
        return res.status(400).json({ error: '이미 보유한 선수입니다' });
      } else {
        return res.status(400).json({ error: '다른 팀에 계약된 선수입니다' });
      }
    }

    const ovr = Math.round((mental + teamfight + focus + laning) / 4);
    const baseCost = ovr * 100000;
    const modifier = personalityContractModifiers[personality as PersonalityType];
    const askingPrice = Math.floor(baseCost * modifier);

    // 협상 결과 계산
    const negotiationResult = calculateNegotiationResult(personality as PersonalityType, askingPrice, offered_price);

    // AI 대사 생성
    const dialogue = await generateContractNegotiationDialogue(
      player.name,
      personality,
      offered_price,
      askingPrice,
      negotiationResult.result,
      negotiationResult.counterPrice
    );

    // 거절
    if (negotiationResult.result === 'REJECT') {
      return res.json({
        success: false,
        result: 'REJECT',
        message: '협상이 결렬되었습니다.',
        dialogue,
        player: { name: player.name, personality }
      });
    }

    // 카운터 오퍼
    if (negotiationResult.result === 'COUNTER') {
      return res.json({
        success: false,
        result: 'COUNTER',
        message: negotiationResult.message,
        dialogue,
        counter_price: negotiationResult.counterPrice,
        player: { name: player.name, personality, overall: ovr }
      });
    }

    // 수락 - 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams[0].gold < offered_price) {
      return res.status(400).json({ error: '골드 부족. 필요: ' + offered_price.toLocaleString() });
    }

    // 골드 차감 및 카드 생성
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [offered_price, req.teamId]);

    const result = await pool.query(
      `INSERT INTO player_cards (pro_player_id, team_id, mental, teamfight, focus, laning, ovr, card_type, personality, is_starter, is_contracted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'NORMAL', ?, false, true)`,
      [playerId, req.teamId, mental, teamfight, focus, laning, ovr, personality]
    );

    // 오피셜 뉴스 생성 (FA 영입)
    try {
      await NewsService.createTransferOfficial(playerId, null, req.teamId!, null);
    } catch (newsError) {
      console.error('Failed to create transfer news:', newsError);
    }

    res.json({
      success: true,
      result: 'ACCEPT',
      message: player.name + ' 선수와 계약 완료!',
      dialogue,
      player_card_id: result.insertId,
      cost: offered_price
    });
  } catch (error: any) {
    console.error('Sign FA error:', error);
    res.status(500).json({ error: '계약 실패' });
  }
});

// 선수 방출
router.post('/release/:cardId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const cardId = parseInt(req.params.cardId);

    const cards = await pool.query(
      `SELECT pc.*, pp.name FROM player_cards pc JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.id = ? AND pc.team_id = ?`,
      [cardId, req.teamId]
    );

    if (cards.length === 0) {
      return res.status(404).json({ error: '선수를 찾을 수 없습니다' });
    }

    const card = cards[0];
    const sellPrice = Math.floor(card.ovr * 50000 * 0.5);

    await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [sellPrice, req.teamId]);
    await pool.query('DELETE FROM player_cards WHERE id = ?', [cardId]);

    res.json({
      success: true,
      message: card.name + ' 방출. ' + sellPrice.toLocaleString() + ' 골드 획득',
      gold_earned: sellPrice
    });
  } catch (error: any) {
    console.error('Release error:', error);
    res.status(500).json({ error: '방출 실패' });
  }
});

// 선수 프로필
router.get('/player/:playerId', async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId);

    const players = await pool.query(
      `SELECT pp.*, COALESCE(pp.base_ovr, 50) as overall FROM pro_players pp WHERE pp.id = ?`,
      [playerId]
    );

    if (players.length === 0) {
      return res.status(404).json({ error: '선수를 찾을 수 없습니다' });
    }

    const player = players[0];

    // 계약된 카드 확인
    const cards = await pool.query(
      `SELECT pc.*, t.name as contracted_team_name FROM player_cards pc
       LEFT JOIN teams t ON pc.team_id = t.id
       WHERE pc.pro_player_id = ? AND pc.is_contracted = true`,
      [playerId]
    );

    const card = cards.length > 0 ? cards[0] : null;

    // 스탯 계산 (카드가 없으면 base_ovr 기반으로 추정)
    let mental, teamfight, focus, laning, ovr;

    if (card) {
      mental = card.mental;
      teamfight = card.teamfight;
      focus = card.focus;
      laning = card.laning;
      ovr = card.ovr;
    } else {
      // 계약되지 않은 선수는 base_ovr 기반 추정 스탯
      const baseOvr = player.overall;
      const baseStat = baseOvr;
      mental = baseStat;
      teamfight = baseStat;
      focus = baseStat;
      laning = baseStat;
      ovr = baseOvr;
    }

    const matchStats = card ? (await pool.query(
      `SELECT COUNT(*) as total_games, SUM(ms.kills) as total_kills, SUM(ms.deaths) as total_deaths,
              SUM(ms.assists) as total_assists, SUM(ms.damage_dealt) as total_damage, AVG(ms.damage_dealt) as avg_damage
       FROM match_stats ms WHERE ms.player_id = ?`,
      [card.id]
    ))[0] : { total_games: 0, total_kills: 0, total_deaths: 0, total_assists: 0, total_damage: 0, avg_damage: 0 };

    const dpm = matchStats.avg_damage ? Math.round(matchStats.avg_damage / 25) : 0;

    let personalityInfo = null;
    if (card?.personality) {
      const traits = personalityTraits[card.personality as PersonalityType];
      personalityInfo = { type: card.personality, name: traits?.name, description: traits?.description };
    }

    // 순위 계산
    const allPlayers = await pool.query(
      `SELECT pc.id, SUM(ms.damage_dealt) as total_damage, SUM(ms.kills) as total_kills,
              CASE WHEN SUM(ms.deaths) > 0 THEN (SUM(ms.kills) + SUM(ms.assists)) / SUM(ms.deaths) ELSE 0 END as kda,
              AVG(ms.damage_dealt) / 25 as dpm
       FROM player_cards pc
       LEFT JOIN match_stats ms ON pc.id = ms.player_id
       GROUP BY pc.id
       ORDER BY total_damage DESC`
    );

    let damageRank = 0, killsRank = 0, kdaRank = 0, dpmRank = 0;
    const totalPlayers = allPlayers.length || 1;

    if (card) {
      const sortedByDamage = [...allPlayers].sort((a: any, b: any) => (b.total_damage || 0) - (a.total_damage || 0));
      const sortedByKills = [...allPlayers].sort((a: any, b: any) => (b.total_kills || 0) - (a.total_kills || 0));
      const sortedByKda = [...allPlayers].sort((a: any, b: any) => (b.kda || 0) - (a.kda || 0));
      const sortedByDpm = [...allPlayers].sort((a: any, b: any) => (b.dpm || 0) - (a.dpm || 0));

      damageRank = sortedByDamage.findIndex((p: any) => p.id === card.id) + 1;
      killsRank = sortedByKills.findIndex((p: any) => p.id === card.id) + 1;
      kdaRank = sortedByKda.findIndex((p: any) => p.id === card.id) + 1;
      dpmRank = sortedByDpm.findIndex((p: any) => p.id === card.id) + 1;
    }

    res.json({
      player: {
        id: player.id,
        name: player.name,
        position: player.position,
        nationality: player.nationality,
        original_team: player.team,  // 팀컬러 (원래 소속팀)
        league: player.league,
        face_image: player.face_image,
        overall: ovr
      },
      contract: card ? {
        team_id: card.team_id,
        team_name: card.contracted_team_name,
        is_starter: card.is_starter
      } : null,  // 계약 정보 (없으면 FA)
      stats: { mental, teamfight, focus, laning },
      personality: personalityInfo,
      monthly_salary: ovr * 100000,  // 월급
      annual_salary: ovr * 100000 * 12,  // 연봉 = 월급 × 12
      career_stats: {
        total_games: matchStats.total_games || 0,
        total_kills: matchStats.total_kills || 0,
        total_deaths: matchStats.total_deaths || 0,
        total_assists: matchStats.total_assists || 0,
        total_damage: matchStats.total_damage || 0,
        avg_dpm: dpm,
        kda: matchStats.total_deaths > 0 ? (matchStats.total_kills + matchStats.total_assists) / matchStats.total_deaths : 0
      },
      rankings: card ? {
        damage_rank: damageRank || totalPlayers,
        kills_rank: killsRank || totalPlayers,
        kda_rank: kdaRank || totalPlayers,
        dpm_rank: dpmRank || totalPlayers,
        total_players: totalPlayers
      } : null
    });
  } catch (error: any) {
    console.error('Profile error:', error);
    res.status(500).json({ error: '프로필 조회 실패' });
  }
});

// 순위
router.get('/rankings', async (req, res) => {
  try {
    const { type = 'damage', limit = 20 } = req.query;

    let orderBy = 'total_damage DESC';
    if (type === 'kills') orderBy = 'total_kills DESC';
    else if (type === 'kda') orderBy = 'kda DESC';
    else if (type === 'dpm') orderBy = 'dpm DESC';

    const rankings = await pool.query(
      `SELECT pp.id, pp.name, pp.position, pp.face_image, t.name as team_name,
              COUNT(*) as games, SUM(ms.kills) as total_kills, SUM(ms.deaths) as total_deaths,
              SUM(ms.assists) as total_assists, SUM(ms.damage_dealt) as total_damage,
              AVG(ms.damage_dealt) / 25 as dpm,
              CASE WHEN SUM(ms.deaths) > 0 THEN (SUM(ms.kills) + SUM(ms.assists)) / SUM(ms.deaths)
              ELSE SUM(ms.kills) + SUM(ms.assists) END as kda
       FROM match_stats ms
       JOIN player_cards pc ON ms.player_id = pc.id
       JOIN pro_players pp ON pc.pro_player_id = pp.id
       JOIN teams t ON pc.team_id = t.id
       GROUP BY pc.id HAVING games >= 1
       ORDER BY ${orderBy} LIMIT ?`,
      [Number(limit)]
    );

    res.json(rankings);
  } catch (error: any) {
    console.error('Rankings error:', error);
    res.status(500).json({ error: '순위 조회 실패' });
  }
});

// 이적시장 목록 조회 (필터링 포함)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { position, minOvr, maxOvr, minPrice, maxPrice, league, sort } = req.query;

    let query = `
      SELECT
        tm.id as listing_id,
        tm.asking_price,
        tm.listed_at,
        tm.seller_team_id,
        t.name as seller_team_name,
        pc.id as card_id,
        pc.ovr,
        pc.mental,
        pc.teamfight,
        pc.focus,
        pc.laning,
        pc.card_type,
        pp.name as player_name,
        pp.team as pro_team,
        pp.position,
        pp.league,
        pp.nationality
      FROM transfer_market tm
      INNER JOIN player_cards pc ON tm.card_id = pc.id
      INNER JOIN pro_players pp ON pc.pro_player_id = pp.id
      INNER JOIN teams t ON tm.seller_team_id = t.id
      WHERE tm.status = 'LISTED'
    `;

    const params: any[] = [];

    // 필터링
    if (position && position !== 'all') {
      query += ' AND pp.position = ?';
      params.push(position);
    }

    if (minOvr) {
      query += ' AND pc.ovr >= ?';
      params.push(Number(minOvr));
    }

    if (maxOvr) {
      query += ' AND pc.ovr <= ?';
      params.push(Number(maxOvr));
    }

    if (minPrice) {
      query += ' AND tm.asking_price >= ?';
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      query += ' AND tm.asking_price <= ?';
      params.push(Number(maxPrice));
    }

    if (league && league !== 'all') {
      query += ' AND pp.league = ?';
      params.push(league);
    }

    // 내 매물 제외
    query += ' AND tm.seller_team_id != ?';
    params.push(req.teamId);

    // 정렬
    switch (sort) {
      case 'price_asc':
        query += ' ORDER BY tm.asking_price ASC';
        break;
      case 'price_desc':
        query += ' ORDER BY tm.asking_price DESC';
        break;
      case 'ovr_desc':
        query += ' ORDER BY pc.ovr DESC';
        break;
      case 'ovr_asc':
        query += ' ORDER BY pc.ovr ASC';
        break;
      case 'newest':
      default:
        query += ' ORDER BY tm.listed_at DESC';
        break;
    }

    query += ' LIMIT 100';

    const listings = await pool.query(query, params);
    res.json(listings);
  } catch (error: any) {
    console.error('Get transfer market error:', error);
    res.status(500).json({ error: '이적시장 조회 실패' });
  }
});

// 내 매물 목록
router.get('/my-listings', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const listings = await pool.query(`
      SELECT
        tm.id as listing_id,
        tm.asking_price,
        tm.listed_at,
        tm.status,
        pc.id as card_id,
        pc.ovr,
        pp.name as player_name,
        pp.team as pro_team,
        pp.position,
        pp.league
      FROM transfer_market tm
      INNER JOIN player_cards pc ON tm.card_id = pc.id
      INNER JOIN pro_players pp ON pc.pro_player_id = pp.id
      WHERE tm.seller_team_id = ?
      ORDER BY tm.listed_at DESC
    `, [req.teamId]);

    res.json(listings);
  } catch (error: any) {
    console.error('Get my listings error:', error);
    res.status(500).json({ error: '내 매물 조회 실패' });
  }
});

// 카드 등록 (판매)
router.post('/list', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { cardId, askingPrice } = req.body;

    if (!cardId || !askingPrice) {
      return res.status(400).json({ error: '카드 ID와 가격을 입력해주세요' });
    }

    if (askingPrice < 1000) {
      return res.status(400).json({ error: '최소 가격은 1,000원입니다' });
    }

    // 카드 소유권 확인
    const cards = await pool.query(`
      SELECT pc.*, pc.is_starter
      FROM player_cards pc
      WHERE pc.id = ? AND pc.team_id = ?
    `, [cardId, req.teamId]);

    if (cards.length === 0) {
      return res.status(404).json({ error: '카드를 찾을 수 없습니다' });
    }

    const card = cards[0];

    // AI 가상 선수는 등록 불가
    if (!card.pro_player_id) {
      return res.status(400).json({ error: 'AI 선수는 판매할 수 없습니다' });
    }

    // 스타터는 등록 불가
    if (card.is_starter) {
      return res.status(400).json({ error: '스타터 카드는 판매할 수 없습니다' });
    }

    // 이미 등록된 카드인지 확인
    const existing = await pool.query(
      'SELECT id FROM transfer_market WHERE card_id = ? AND status = ?',
      [cardId, 'LISTED']
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: '이미 등록된 카드입니다' });
    }

    // 이적시장에 등록
    await pool.query(`
      INSERT INTO transfer_market (card_id, seller_team_id, asking_price)
      VALUES (?, ?, ?)
    `, [cardId, req.teamId, askingPrice]);

    res.json({ success: true, message: '이적시장에 등록되었습니다' });
  } catch (error: any) {
    console.error('List card error:', error);
    res.status(500).json({ error: '등록 실패' });
  }
});

// 매물 취소
router.delete('/cancel/:listingId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { listingId } = req.params;

    // 소유권 확인
    const listings = await pool.query(
      'SELECT * FROM transfer_market WHERE id = ? AND seller_team_id = ? AND status = ?',
      [listingId, req.teamId, 'LISTED']
    );

    if (listings.length === 0) {
      return res.status(404).json({ error: '매물을 찾을 수 없습니다' });
    }

    await pool.query(
      'UPDATE transfer_market SET status = ? WHERE id = ?',
      ['CANCELLED', listingId]
    );

    res.json({ success: true, message: '매물이 취소되었습니다' });
  } catch (error: any) {
    console.error('Cancel listing error:', error);
    res.status(500).json({ error: '취소 실패' });
  }
});

// 카드 구매
router.post('/buy/:listingId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { listingId } = req.params;

    // 매물 정보 가져오기
    const listings = await pool.query(`
      SELECT tm.*, pc.pro_player_id, pp.name as player_name
      FROM transfer_market tm
      INNER JOIN player_cards pc ON tm.card_id = pc.id
      INNER JOIN pro_players pp ON pc.pro_player_id = pp.id
      WHERE tm.id = ? AND tm.status = ?
    `, [listingId, 'LISTED']);

    if (listings.length === 0) {
      return res.status(404).json({ error: '매물을 찾을 수 없습니다' });
    }

    const listing = listings[0];

    // 자기 매물 구매 방지
    if (listing.seller_team_id === req.teamId) {
      return res.status(400).json({ error: '자신의 매물은 구매할 수 없습니다' });
    }

    // 구매자 골드 확인
    const buyers = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (buyers.length === 0 || buyers[0].gold < listing.asking_price) {
      return res.status(400).json({ error: '골드가 부족합니다' });
    }

    // 트랜잭션 처리
    // 1. 구매자 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [listing.asking_price, req.teamId]);

    // 2. 판매자 골드 증가 (수수료 5%)
    const sellerReceives = Math.floor(listing.asking_price * 0.95);
    await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [sellerReceives, listing.seller_team_id]);

    // 3. 카드 소유권 이전
    await pool.query('UPDATE player_cards SET team_id = ?, is_starter = false WHERE id = ?', [req.teamId, listing.card_id]);

    // 4. 매물 상태 업데이트
    await pool.query(`
      UPDATE transfer_market
      SET status = ?, sold_at = NOW(), buyer_team_id = ?
      WHERE id = ?
    `, ['SOLD', req.teamId, listingId]);

    // 오피셜 뉴스 생성 (이적시장 영입)
    try {
      await NewsService.createTransferOfficial(
        listing.pro_player_id,
        listing.seller_team_id,
        req.teamId!,
        null
      );
    } catch (newsError) {
      console.error('Failed to create transfer news:', newsError);
    }

    res.json({
      success: true,
      message: `${listing.player_name} 카드를 구매했습니다!`,
      price: listing.asking_price
    });
  } catch (error: any) {
    console.error('Buy card error:', error);
    res.status(500).json({ error: '구매 실패' });
  }
});

// 거래 내역
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const history = await pool.query(`
      SELECT
        tm.id,
        tm.asking_price,
        tm.sold_at,
        tm.status,
        pp.name as player_name,
        pp.position,
        seller.name as seller_name,
        buyer.name as buyer_name,
        CASE
          WHEN tm.seller_team_id = ? THEN 'SOLD'
          WHEN tm.buyer_team_id = ? THEN 'BOUGHT'
        END as transaction_type
      FROM transfer_market tm
      INNER JOIN player_cards pc ON tm.card_id = pc.id
      INNER JOIN pro_players pp ON pc.pro_player_id = pp.id
      INNER JOIN teams seller ON tm.seller_team_id = seller.id
      LEFT JOIN teams buyer ON tm.buyer_team_id = buyer.id
      WHERE (tm.seller_team_id = ? OR tm.buyer_team_id = ?)
        AND tm.status IN ('SOLD', 'CANCELLED')
      ORDER BY tm.sold_at DESC
      LIMIT 50
    `, [req.teamId, req.teamId, req.teamId, req.teamId]);

    res.json(history);
  } catch (error: any) {
    console.error('Get history error:', error);
    res.status(500).json({ error: '거래 내역 조회 실패' });
  }
});

// 다른 팀 선수 목록 조회
router.get('/teams/:teamId/players', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.teamId);

    if (teamId === req.teamId) {
      return res.status(400).json({ error: '자신의 팀은 조회할 수 없습니다' });
    }

    const players = await pool.query(`
      SELECT
        pc.id as card_id,
        pc.ovr,
        pc.mental,
        pc.teamfight,
        pc.focus,
        pc.laning,
        pc.is_starter,
        COALESCE(pp.name, pc.ai_player_name) as name,
        COALESCE(pp.position, pc.ai_position) as position,
        COALESCE(pp.team, 'AI') as pro_team,
        COALESCE(pp.league, 'AI') as league,
        t.name as team_name
      FROM player_cards pc
      LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
      JOIN teams t ON pc.team_id = t.id
      WHERE pc.team_id = ? AND pc.is_contracted = true
      ORDER BY pc.ovr DESC
    `, [teamId]);

    res.json(players);
  } catch (error: any) {
    console.error('Get team players error:', error);
    res.status(500).json({ error: '선수 목록 조회 실패' });
  }
});

// 이적 요청 보내기
router.post('/request', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { cardId, offerPrice, message } = req.body;

    if (!cardId || !offerPrice) {
      return res.status(400).json({ error: '카드 ID와 제안 금액이 필요합니다' });
    }

    // 카드 정보 조회
    const cards = await pool.query(`
      SELECT pc.*, COALESCE(pp.name, pc.ai_player_name) as player_name, t.name as team_name
      FROM player_cards pc
      LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
      JOIN teams t ON pc.team_id = t.id
      WHERE pc.id = ? AND pc.is_contracted = true
    `, [cardId]);

    if (cards.length === 0) {
      return res.status(404).json({ error: '선수를 찾을 수 없습니다' });
    }

    const card = cards[0];

    // 자기 팀 선수 요청 불가
    if (card.team_id === req.teamId) {
      return res.status(400).json({ error: '자신의 팀 선수에게는 요청할 수 없습니다' });
    }

    // 이미 이적시장에 등록된 선수인지 확인
    const listed = await pool.query(
      'SELECT id FROM transfer_market WHERE card_id = ? AND status = ?',
      [cardId, 'LISTED']
    );
    if (listed.length > 0) {
      return res.status(400).json({ error: '이미 이적시장에 등록된 선수입니다. 시장에서 구매하세요.' });
    }

    // 이미 요청 중인지 확인
    const existing = await pool.query(
      `SELECT id FROM transfer_requests
       WHERE card_id = ? AND buyer_team_id = ? AND status IN ('PENDING', 'COUNTER')`,
      [cardId, req.teamId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '이미 요청 중인 선수입니다' });
    }

    // 48시간 후 만료
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    await pool.query(`
      INSERT INTO transfer_requests (card_id, seller_team_id, buyer_team_id, offer_price, message, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [cardId, card.team_id, req.teamId, offerPrice, message || null, expiresAt]);

    res.json({
      success: true,
      message: `${card.team_name}의 ${card.player_name} 선수에게 이적 요청을 보냈습니다`
    });
  } catch (error: any) {
    console.error('Send request error:', error);
    res.status(500).json({ error: '이적 요청 실패' });
  }
});

// 받은 이적 요청 목록
router.get('/requests/incoming', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const requests = await pool.query(`
      SELECT
        tr.*,
        COALESCE(pp.name, pc.ai_player_name) as player_name,
        COALESCE(pp.position, pc.ai_position) as position,
        pc.ovr,
        bt.name as buyer_team_name
      FROM transfer_requests tr
      JOIN player_cards pc ON tr.card_id = pc.id
      LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
      JOIN teams bt ON tr.buyer_team_id = bt.id
      WHERE tr.seller_team_id = ? AND tr.status IN ('PENDING', 'COUNTER')
      ORDER BY tr.created_at DESC
    `, [req.teamId]);

    res.json(requests);
  } catch (error: any) {
    console.error('Get incoming requests error:', error);
    res.status(500).json({ error: '받은 요청 조회 실패' });
  }
});

// 보낸 이적 요청 목록
router.get('/requests/outgoing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const requests = await pool.query(`
      SELECT
        tr.*,
        COALESCE(pp.name, pc.ai_player_name) as player_name,
        COALESCE(pp.position, pc.ai_position) as position,
        pc.ovr,
        st.name as seller_team_name
      FROM transfer_requests tr
      JOIN player_cards pc ON tr.card_id = pc.id
      LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
      JOIN teams st ON tr.seller_team_id = st.id
      WHERE tr.buyer_team_id = ? AND tr.status IN ('PENDING', 'COUNTER')
      ORDER BY tr.created_at DESC
    `, [req.teamId]);

    res.json(requests);
  } catch (error: any) {
    console.error('Get outgoing requests error:', error);
    res.status(500).json({ error: '보낸 요청 조회 실패' });
  }
});

// 이적 요청 수락
router.post('/requests/:id/accept', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const requestId = parseInt(req.params.id);

    const requests = await pool.query(`
      SELECT tr.*, COALESCE(pp.name, pc.ai_player_name) as player_name, pc.id as card_id, pc.pro_player_id
      FROM transfer_requests tr
      JOIN player_cards pc ON tr.card_id = pc.id
      LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
      WHERE tr.id = ? AND tr.seller_team_id = ? AND tr.status IN ('PENDING', 'COUNTER')
    `, [requestId, req.teamId]);

    if (requests.length === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다' });
    }

    const request = requests[0];
    const finalPrice = request.status === 'COUNTER' ? request.counter_price : request.offer_price;

    // 구매자 골드 확인
    const buyers = await pool.query('SELECT gold FROM teams WHERE id = ?', [request.buyer_team_id]);
    if (buyers.length === 0 || buyers[0].gold < finalPrice) {
      return res.status(400).json({ error: '구매자의 골드가 부족합니다' });
    }

    // 트랜잭션 처리
    // 1. 구매자 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [finalPrice, request.buyer_team_id]);

    // 2. 판매자 골드 증가 (수수료 5%)
    const sellerReceives = Math.floor(finalPrice * 0.95);
    await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [sellerReceives, request.seller_team_id]);

    // 3. 카드 소유권 이전
    await pool.query('UPDATE player_cards SET team_id = ?, is_starter = false WHERE id = ?', [request.buyer_team_id, request.card_id]);

    // 4. 요청 상태 업데이트
    await pool.query(`
      UPDATE transfer_requests
      SET status = 'ACCEPTED', responded_at = NOW()
      WHERE id = ?
    `, [requestId]);

    // 5. 오피셜 뉴스 생성
    try {
      if (request.pro_player_id) {
        await NewsService.createTransferOfficial(
          request.pro_player_id,
          request.seller_team_id,
          request.buyer_team_id,
          null
        );
      }
    } catch (newsError) {
      console.error('Failed to create transfer news:', newsError);
    }

    res.json({
      success: true,
      message: `${request.player_name} 선수 이적 완료! ${sellerReceives.toLocaleString()}원 획득`,
      received: sellerReceives
    });
  } catch (error: any) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: '요청 수락 실패' });
  }
});

// 이적 요청 거절
router.post('/requests/:id/reject', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { message } = req.body;

    // 요청 정보와 선수 카드 정보 가져오기
    const requests = await pool.query(`
      SELECT tr.*, pc.ovr, pc.personality, pc.id as card_id,
             COALESCE(pp.name, pc.ai_player_name) as player_name
      FROM transfer_requests tr
      JOIN player_cards pc ON tr.card_id = pc.id
      LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
      WHERE tr.id = ? AND tr.seller_team_id = ? AND tr.status IN ('PENDING', 'COUNTER')
    `, [requestId, req.teamId]);

    if (requests.length === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다' });
    }

    const request = requests[0];
    const offerPrice = request.status === 'COUNTER' ? request.counter_price : request.offer_price;
    const marketValue = request.ovr * 100000; // 시장 가치 = 오버롤 * 100000
    const offerRatio = offerPrice / marketValue;

    // 요청 거절 처리
    await pool.query(`
      UPDATE transfer_requests
      SET status = 'REJECTED', response_message = ?, responded_at = NOW()
      WHERE id = ?
    `, [message || null, requestId]);

    // 적정 제안(80% 이상)을 거절한 경우에만 선수에게 영향
    let playerDialogue = null;
    let moraleReduced = false;

    if (offerRatio >= 0.8 && request.personality) {
      // 선수 멘탈 감소 (3-8 정도)
      const moralePenalty = Math.floor(3 + Math.random() * 6);
      await pool.query(
        'UPDATE player_cards SET mental = GREATEST(1, mental - ?) WHERE id = ?',
        [moralePenalty, request.card_id]
      );
      moraleReduced = true;

      // AI 불만 대사 생성
      try {
        playerDialogue = await generateTransferBlockedDialogue(
          request.player_name,
          request.personality as PersonalityType,
          offerPrice,
          marketValue
        );
      } catch (dialogueError) {
        console.error('Failed to generate dialogue:', dialogueError);
        playerDialogue = '왜 내 이적을 막는 거죠?';
      }
    }

    res.json({
      success: true,
      message: '이적 요청을 거절했습니다',
      playerReaction: moraleReduced ? {
        playerName: request.player_name,
        dialogue: playerDialogue,
        moraleReduced: true,
        reason: `적정 제안 (시장가치의 ${Math.round(offerRatio * 100)}%) 거절`
      } : null
    });
  } catch (error: any) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: '요청 거절 실패' });
  }
});

// 카운터 오퍼
router.post('/requests/:id/counter', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { counterPrice, message } = req.body;

    if (!counterPrice) {
      return res.status(400).json({ error: '카운터 가격이 필요합니다' });
    }

    const result = await pool.query(`
      UPDATE transfer_requests
      SET status = 'COUNTER', counter_price = ?, response_message = ?, responded_at = NOW()
      WHERE id = ? AND seller_team_id = ? AND status = 'PENDING'
    `, [counterPrice, message || null, requestId, req.teamId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다' });
    }

    res.json({ success: true, message: `${counterPrice.toLocaleString()}원으로 역제안했습니다` });
  } catch (error: any) {
    console.error('Counter offer error:', error);
    res.status(500).json({ error: '역제안 실패' });
  }
});

// 카운터 오퍼 수락 (구매자가)
router.post('/requests/:id/accept-counter', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const requestId = parseInt(req.params.id);

    const requests = await pool.query(`
      SELECT tr.*, COALESCE(pp.name, pc.ai_player_name) as player_name, pc.id as card_id, pc.pro_player_id
      FROM transfer_requests tr
      JOIN player_cards pc ON tr.card_id = pc.id
      LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
      WHERE tr.id = ? AND tr.buyer_team_id = ? AND tr.status = 'COUNTER'
    `, [requestId, req.teamId]);

    if (requests.length === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다' });
    }

    const request = requests[0];
    const finalPrice = request.counter_price;

    // 내 골드 확인
    const buyers = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (buyers[0].gold < finalPrice) {
      return res.status(400).json({ error: '골드가 부족합니다' });
    }

    // 트랜잭션 처리
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [finalPrice, req.teamId]);
    const sellerReceives = Math.floor(finalPrice * 0.95);
    await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [sellerReceives, request.seller_team_id]);
    await pool.query('UPDATE player_cards SET team_id = ?, is_starter = false WHERE id = ?', [req.teamId, request.card_id]);
    await pool.query('UPDATE transfer_requests SET status = ?, responded_at = NOW() WHERE id = ?', ['ACCEPTED', requestId]);

    // 오피셜 뉴스 생성
    try {
      if (request.pro_player_id) {
        await NewsService.createTransferOfficial(
          request.pro_player_id,
          request.seller_team_id,
          req.teamId!,
          null
        );
      }
    } catch (newsError) {
      console.error('Failed to create transfer news:', newsError);
    }

    res.json({
      success: true,
      message: `${request.player_name} 선수 영입 완료!`,
      cost: finalPrice
    });
  } catch (error: any) {
    console.error('Accept counter error:', error);
    res.status(500).json({ error: '역제안 수락 실패' });
  }
});

// 이적 요청 취소 (구매자가)
router.delete('/requests/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const requestId = parseInt(req.params.id);

    const result = await pool.query(`
      UPDATE transfer_requests
      SET status = 'CANCELLED'
      WHERE id = ? AND buyer_team_id = ? AND status IN ('PENDING', 'COUNTER')
    `, [requestId, req.teamId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다' });
    }

    res.json({ success: true, message: '이적 요청을 취소했습니다' });
  } catch (error: any) {
    console.error('Cancel request error:', error);
    res.status(500).json({ error: '요청 취소 실패' });
  }
});

export default router;
