import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 이적 시장 목록
router.get('/market', async (req, res) => {
  try {
    const { position, min_overall, max_overall, sort_by } = req.query;

    let query = `
      SELECT t.*, 
             p.name as player_name, p.position, p.level,
             (p.mental + p.teamfight + p.focus + p.laning) as overall,
             st.name as seller_team_name
      FROM trades t
      INNER JOIN players p ON t.player_id = p.id
      INNER JOIN teams st ON t.seller_team_id = st.id
      WHERE t.status = 'LISTED'
    `;

    const params: any[] = [];

    if (position) {
      query += ' AND p.position = ?';
      params.push(position);
    }

    if (min_overall) {
      query += ' AND (p.mental + p.teamfight + p.focus + p.laning) >= ?';
      params.push(parseInt(min_overall as string));
    }

    if (max_overall) {
      query += ' AND (p.mental + p.teamfight + p.focus + p.laning) <= ?';
      params.push(parseInt(max_overall as string));
    }

    if (sort_by === 'price') {
      query += ' ORDER BY COALESCE(t.price_gold, 0) + COALESCE(t.price_diamond, 0) * 1000 ASC';
    } else {
      query += ' ORDER BY overall DESC';
    }

    query += ' LIMIT 100';

    const trades = await pool.query(query, params);

    res.json(trades);
  } catch (error: any) {
    console.error('Get market error:', error);
    res.status(500).json({ error: 'Failed to get market' });
  }
});

// 내 거래 목록
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const trades = await pool.query(
      `SELECT t.*, 
              p.name as player_name, p.position,
              (p.mental + p.teamfight + p.focus + p.laning) as overall,
              bt.name as buyer_team_name
       FROM trades t
       INNER JOIN players p ON t.player_id = p.id
       LEFT JOIN teams bt ON t.buyer_team_id = bt.id
       WHERE t.seller_team_id = ? OR t.buyer_team_id = ?
       ORDER BY t.listed_at DESC`,
      [req.teamId, req.teamId]
    );

    res.json(trades);
  } catch (error: any) {
    console.error('Get my trades error:', error);
    res.status(500).json({ error: 'Failed to get trades' });
  }
});

// 선수 판매 등록
router.post('/sell', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { player_id, price_gold, price_diamond } = req.body;

    if (!player_id) {
      return res.status(400).json({ error: 'Player ID required' });
    }

    if (!price_gold && !price_diamond) {
      return res.status(400).json({ error: 'Price required' });
    }

    // 선수 소유 확인
    const ownership = await pool.query(
      'SELECT * FROM player_ownership WHERE player_id = ? AND team_id = ?',
      [player_id, req.teamId]
    );

    if (ownership.length === 0) {
      return res.status(404).json({ error: 'Player not found or not owned' });
    }

    // 이미 판매 중인지 확인
    const existingTrade = await pool.query(
      'SELECT * FROM trades WHERE player_id = ? AND status = "LISTED"',
      [player_id]
    );

    if (existingTrade.length > 0) {
      return res.status(400).json({ error: 'Player already listed' });
    }

    // 거래 등록
    await pool.query(
      `INSERT INTO trades (player_id, seller_team_id, trade_type, price_gold, price_diamond, status)
       VALUES (?, ?, 'MARKET', ?, ?, 'LISTED')`,
      [player_id, req.teamId, price_gold || null, price_diamond || null]
    );

    res.json({ message: 'Player listed for sale' });
  } catch (error: any) {
    console.error('Sell player error:', error);
    res.status(500).json({ error: 'Failed to list player' });
  }
});

// 선수 구매
router.post('/buy/:tradeId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tradeId = parseInt(req.params.tradeId);

    // 거래 정보
    const trades = await pool.query('SELECT * FROM trades WHERE id = ?', [tradeId]);
    if (trades.length === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const trade = trades[0];

    if (trade.status !== 'LISTED') {
      return res.status(400).json({ error: 'Trade not available' });
    }

    if (trade.seller_team_id === req.teamId) {
      return res.status(400).json({ error: 'Cannot buy your own player' });
    }

    // 최대 보유 수 확인
    const playerCount = await pool.query(
      'SELECT COUNT(*) as count FROM player_ownership WHERE team_id = ?',
      [req.teamId]
    );

    if (playerCount[0].count >= 10) {
      return res.status(400).json({ error: '최대 보유 선수 수에 도달했습니다 (10명)' });
    }

    // 재화 확인
    const teams = await pool.query('SELECT gold, diamond FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teams[0];

    if (trade.price_gold && team.gold < trade.price_gold) {
      return res.status(400).json({ error: 'Insufficient gold' });
    }

    if (trade.price_diamond && team.diamond < trade.price_diamond) {
      return res.status(400).json({ error: 'Insufficient diamond' });
    }

    // 재화 차감
    if (trade.price_gold) {
      await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [trade.price_gold, req.teamId]);
    }
    if (trade.price_diamond) {
      await pool.query('UPDATE teams SET diamond = diamond - ? WHERE id = ?', [trade.price_diamond, req.teamId]);
    }

    // 판매자에게 재화 지급
    if (trade.price_gold) {
      await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [trade.price_gold, trade.seller_team_id]);
    }
    if (trade.price_diamond) {
      await pool.query('UPDATE teams SET diamond = diamond + ? WHERE id = ?', [trade.price_diamond, trade.seller_team_id]);
    }

    // 선수 소유권 이전
    await pool.query(
      'UPDATE player_ownership SET team_id = ? WHERE player_id = ?',
      [req.teamId, trade.player_id]
    );

    // 거래 완료
    await pool.query(
      'UPDATE trades SET buyer_team_id = ?, status = "SOLD", sold_at = NOW() WHERE id = ?',
      [req.teamId, tradeId]
    );

    res.json({ message: 'Player purchased successfully' });
  } catch (error: any) {
    console.error('Buy player error:', error);
    res.status(500).json({ error: 'Failed to buy player' });
  }
});

// 거래 취소
router.post('/cancel/:tradeId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tradeId = parseInt(req.params.tradeId);

    const trades = await pool.query('SELECT * FROM trades WHERE id = ?', [tradeId]);
    if (trades.length === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const trade = trades[0];

    if (trade.seller_team_id !== req.teamId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (trade.status !== 'LISTED') {
      return res.status(400).json({ error: 'Trade cannot be cancelled' });
    }

    await pool.query('UPDATE trades SET status = "CANCELLED" WHERE id = ?', [tradeId]);

    res.json({ message: 'Trade cancelled' });
  } catch (error: any) {
    console.error('Cancel trade error:', error);
    res.status(500).json({ error: 'Failed to cancel trade' });
  }
});

// 재화 교환
router.post('/exchange', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { exchange_type, amount } = req.body;

    if (!exchange_type || !amount) {
      return res.status(400).json({ error: 'Exchange type and amount required' });
    }

    const teams = await pool.query('SELECT gold, diamond FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teams[0];
    const rate = 1000; // 1 다이아몬드 = 1000 골드

    if (exchange_type === 'GOLD_TO_DIAMOND') {
      if (team.gold < amount) {
        return res.status(400).json({ error: 'Insufficient gold' });
      }

      const diamondAmount = Math.floor(amount / rate);
      await pool.query('UPDATE teams SET gold = gold - ?, diamond = diamond + ? WHERE id = ?', 
        [amount, diamondAmount, req.teamId]);

      await pool.query(
        `INSERT INTO currency_exchanges (team_id, exchange_type, amount, rate, result_amount)
         VALUES (?, ?, ?, ?, ?)`,
        [req.teamId, exchange_type, amount, rate, diamondAmount]
      );

      res.json({ message: 'Exchanged successfully', diamond: diamondAmount });
    } else if (exchange_type === 'DIAMOND_TO_GOLD') {
      if (team.diamond < amount) {
        return res.status(400).json({ error: 'Insufficient diamond' });
      }

      const goldAmount = amount * rate;
      await pool.query('UPDATE teams SET diamond = diamond - ?, gold = gold + ? WHERE id = ?', 
        [amount, goldAmount, req.teamId]);

      await pool.query(
        `INSERT INTO currency_exchanges (team_id, exchange_type, amount, rate, result_amount)
         VALUES (?, ?, ?, ?, ?)`,
        [req.teamId, exchange_type, amount, rate, goldAmount]
      );

      res.json({ message: 'Exchanged successfully', gold: goldAmount });
    } else {
      return res.status(400).json({ error: 'Invalid exchange type' });
    }
  } catch (error: any) {
    console.error('Exchange error:', error);
    res.status(500).json({ error: 'Failed to exchange currency' });
  }
});

export default router;

