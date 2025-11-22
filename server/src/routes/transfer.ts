import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

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
