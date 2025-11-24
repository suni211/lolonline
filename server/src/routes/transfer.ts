import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { generatePersonality, personalityTraits, PersonalityType } from '../services/geminiService.js';

const router = express.Router();

// FA 선수 목록 (이적시장에 없는 모든 선수)
router.get('/fa', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { position, minOvr, maxOvr, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT pp.id, pp.name, pp.position, pp.nationality, pp.team as original_team,
             pp.league, pp.face_image, COALESCE(pp.base_ovr, 50) as overall
      FROM pro_players pp
      WHERE NOT EXISTS (SELECT 1 FROM player_cards pc WHERE pc.pro_player_id = pp.id)
    `;
    const params: any[] = [];

    if (position && position !== 'all') {
      query += ' AND pp.position = ?';
      params.push(position);
    }
    if (minOvr) {
      query += ' AND COALESCE(pp.base_ovr, 50) >= ?';
      params.push(Number(minOvr));
    }
    if (maxOvr) {
      query += ' AND COALESCE(pp.base_ovr, 50) <= ?';
      params.push(Number(maxOvr));
    }
    if (search) {
      query += ' AND pp.name LIKE ?';
      params.push(`%${search}%`);
    }

    const countResult = await pool.query(
      query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM'),
      params
    );
    const total = countResult[0].total;

    query += ' ORDER BY COALESCE(pp.base_ovr, 50) DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const players = await pool.query(query, params);

    const playersWithPrice = players.map((p: any) => ({
      ...p,
      price: p.overall * 50000
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

// FA 선수 계약
router.post('/fa/sign/:playerId', authenticateToken, async (req: AuthRequest, res) => {
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

    const existingCards = await pool.query(
      'SELECT * FROM player_cards WHERE pro_player_id = ?',
      [playerId]
    );

    if (existingCards.length > 0) {
      return res.status(400).json({ error: '이미 계약된 선수입니다' });
    }

    const price = player.overall * 50000;

    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams[0].gold < price) {
      return res.status(400).json({ error: '골드 부족. 필요: ' + price.toLocaleString() });
    }

    const baseOvr = player.overall;
    const totalStats = baseOvr * 4;
    let remaining = totalStats;
    const baseStat = Math.floor(totalStats / 4);
    const variance = 10;

    const mental = Math.max(1, Math.min(200, baseStat + Math.floor(Math.random() * variance * 2) - variance));
    remaining -= mental;
    const teamfight = Math.max(1, Math.min(200, baseStat + Math.floor(Math.random() * variance * 2) - variance));
    remaining -= teamfight;
    const focus = Math.max(1, Math.min(200, baseStat + Math.floor(Math.random() * variance * 2) - variance));
    remaining -= focus;
    const laning = Math.max(1, Math.min(200, remaining));

    const personality = generatePersonality(mental);
    const ovr = Math.round((mental + teamfight + focus + laning) / 4);

    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [price, req.teamId]);

    const result = await pool.query(
      `INSERT INTO player_cards (pro_player_id, team_id, mental, teamfight, focus, laning, ovr, card_type, personality, is_starter, is_contracted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'NORMAL', ?, false, true)`,
      [playerId, req.teamId, mental, teamfight, focus, laning, ovr, personality]
    );

    res.json({
      success: true,
      message: player.name + ' 선수와 계약 완료!',
      player_card_id: result.insertId,
      cost: price
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

    const cards = await pool.query(
      `SELECT pc.*, t.name as team_name FROM player_cards pc JOIN teams t ON pc.team_id = t.id WHERE pc.pro_player_id = ?`,
      [playerId]
    );

    const card = cards.length > 0 ? cards[0] : null;

    const stats = await pool.query(
      `SELECT COUNT(*) as total_games, SUM(ms.kills) as total_kills, SUM(ms.deaths) as total_deaths,
              SUM(ms.assists) as total_assists, SUM(ms.damage_dealt) as total_damage, AVG(ms.damage_dealt) as avg_damage
       FROM match_stats ms WHERE ms.player_id = ?`,
      [card?.id || 0]
    );

    const matchStats = stats[0];
    const dpm = matchStats.avg_damage ? Math.round(matchStats.avg_damage / 25) : 0;

    let personalityInfo = null;
    if (card?.personality) {
      const traits = personalityTraits[card.personality as PersonalityType];
      personalityInfo = { type: card.personality, name: traits?.name, description: traits?.description };
    }

    res.json({
      id: player.id,
      name: player.name,
      position: player.position,
      nationality: player.nationality,
      original_team: player.team,
      league: player.league,
      face_image: player.face_image,
      overall: card?.ovr || player.overall,
      stats: card ? { mental: card.mental, teamfight: card.teamfight, focus: card.focus, laning: card.laning } : null,
      contract: card ? { team_id: card.team_id, team_name: card.team_name, level: card.level, is_starter: card.is_starter } : null,
      personality: personalityInfo,
      salary: (card?.ovr || player.overall) * 10000,
      price: player.overall * 50000,
      career_stats: {
        total_games: matchStats.total_games || 0,
        total_kills: matchStats.total_kills || 0,
        total_deaths: matchStats.total_deaths || 0,
        total_assists: matchStats.total_assists || 0,
        total_damage: matchStats.total_damage || 0,
        dpm: dpm,
        kda: matchStats.total_deaths > 0 ? ((matchStats.total_kills + matchStats.total_assists) / matchStats.total_deaths).toFixed(2) : '0'
      }
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

export default router;
