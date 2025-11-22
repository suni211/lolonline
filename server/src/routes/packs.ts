import { Router } from 'express';
import pool from '../database/db.js';
import { ProPlayerService } from '../services/proPlayerService.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 선수팩 목록 조회
router.get('/', async (req, res) => {
  try {
    const packs = await pool.query(
      'SELECT * FROM player_packs WHERE is_active = true'
    );
    res.json(packs);
  } catch (error) {
    console.error('Get packs error:', error);
    res.status(500).json({ error: '선수팩 목록 조회 실패' });
  }
});

// 선수팩 개봉
router.post('/:packId/open', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { packId } = req.params;
    const teamId = req.teamId;

    if (!teamId) {
      return res.status(401).json({ error: '팀 정보가 필요합니다' });
    }

    const result = await ProPlayerService.openPack(teamId, parseInt(packId));
    res.json(result);
  } catch (error: any) {
    console.error('Open pack error:', error);
    res.status(500).json({ error: error.message || '선수팩 개봉 실패' });
  }
});

// 내 선수 카드 목록 조회
router.get('/my-cards', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId;

    if (!teamId) {
      return res.status(401).json({ error: '팀 정보가 필요합니다' });
    }

    const cards = await ProPlayerService.getTeamCards(teamId);
    res.json(cards);
  } catch (error) {
    console.error('Get my cards error:', error);
    res.status(500).json({ error: '선수 카드 목록 조회 실패' });
  }
});

// 카드 계약
router.post('/cards/:cardId/contract', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { cardId } = req.params;
    const teamId = req.teamId;

    if (!teamId) {
      return res.status(401).json({ error: '팀 정보가 필요합니다' });
    }

    // 카드 소유권 확인
    const cards = await pool.query(
      'SELECT * FROM player_cards WHERE id = ? AND team_id = ?',
      [cardId, teamId]
    );

    if (cards.length === 0) {
      return res.status(404).json({ error: '카드를 찾을 수 없습니다' });
    }

    const card = cards[0];

    // 이미 계약된 카드인지 확인
    if (card.is_contracted) {
      return res.status(400).json({ error: '이미 계약된 카드입니다' });
    }

    // 계약 비용 (OVR에 따라 다름)
    const contractCost = Math.floor(card.ovr * 50000); // OVR * 5만원

    // 팀 골드 확인
    const team = await pool.query('SELECT gold FROM teams WHERE id = ?', [teamId]);
    if (team.length === 0 || team[0].gold < contractCost) {
      return res.status(400).json({ error: `골드가 부족합니다 (${contractCost.toLocaleString()}원 필요)` });
    }

    // 현재 시즌 확인
    const leagues = await pool.query(
      'SELECT season FROM leagues ORDER BY id DESC LIMIT 1'
    );
    const currentSeason = leagues.length > 0 ? leagues[0].season : 1;

    // 골드 차감 및 계약 처리
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [contractCost, teamId]);
    await pool.query(
      'UPDATE player_cards SET is_contracted = true, contract_season = ?, contract_cost = ? WHERE id = ?',
      [currentSeason, contractCost, cardId]
    );

    res.json({
      success: true,
      contractCost,
      season: currentSeason
    });
  } catch (error) {
    console.error('Contract card error:', error);
    res.status(500).json({ error: '카드 계약 실패' });
  }
});

// 스타터 설정
router.post('/cards/:cardId/starter', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { cardId } = req.params;
    const { isStarter } = req.body;
    const teamId = req.teamId;

    if (!teamId) {
      return res.status(401).json({ error: '팀 정보가 필요합니다' });
    }

    // 카드 소유권 확인
    const cards = await pool.query(
      'SELECT * FROM player_cards WHERE id = ? AND team_id = ?',
      [cardId, teamId]
    );

    if (cards.length === 0) {
      return res.status(404).json({ error: '카드를 찾을 수 없습니다' });
    }

    const card = cards[0];

    // 스타터로 설정할 경우 계약 확인
    if (isStarter && !card.is_contracted) {
      return res.status(400).json({ error: '계약되지 않은 카드는 스타터로 설정할 수 없습니다' });
    }

    // 스타터로 설정할 경우, 같은 포지션의 다른 스타터 해제
    if (isStarter) {
      // 카드의 포지션 확인
      const proPlayer = await pool.query(
        'SELECT position FROM pro_players WHERE id = ?',
        [card.pro_player_id]
      );

      if (proPlayer.length > 0) {
        // 같은 포지션의 다른 스타터 해제
        await pool.query(
          `UPDATE player_cards pc
           JOIN pro_players pp ON pc.pro_player_id = pp.id
           SET pc.is_starter = false
           WHERE pc.team_id = ? AND pp.position = ? AND pc.id != ?`,
          [teamId, proPlayer[0].position, cardId]
        );
      }
    }

    // 스타터 설정
    await pool.query(
      'UPDATE player_cards SET is_starter = ? WHERE id = ?',
      [isStarter, cardId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Set starter error:', error);
    res.status(500).json({ error: '스타터 설정 실패' });
  }
});

// 케미스트리 조회
router.get('/chemistry', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId;

    if (!teamId) {
      return res.status(401).json({ error: '팀 정보가 필요합니다' });
    }

    const cards = await pool.query(
      `SELECT pc.*, pp.name, pp.team as pro_team, pp.position, pp.league, pp.nationality
       FROM player_cards pc
       JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.team_id = ? AND pc.is_starter = true`,
      [teamId]
    );

    const chemistry = ProPlayerService.calculateChemistry(cards);

    res.json({
      starters: cards,
      chemistry_bonus: chemistry
    });
  } catch (error) {
    console.error('Get chemistry error:', error);
    res.status(500).json({ error: '케미스트리 조회 실패' });
  }
});

// 프로 선수 목록 조회 (도감)
router.get('/pro-players', async (req, res) => {
  try {
    const { league, team, position } = req.query;

    let query = 'SELECT * FROM pro_players WHERE is_active = true';
    const params: any[] = [];

    if (league) {
      query += ' AND league = ?';
      params.push(league);
    }
    if (team) {
      query += ' AND team = ?';
      params.push(team);
    }
    if (position) {
      query += ' AND position = ?';
      params.push(position);
    }

    query += ' ORDER BY base_ovr DESC, name ASC';

    const players = await pool.query(query, params);
    res.json(players);
  } catch (error) {
    console.error('Get pro players error:', error);
    res.status(500).json({ error: '프로 선수 목록 조회 실패' });
  }
});

// 팀컬러 목록 조회
router.get('/team-colors', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId;

    if (!teamId) {
      return res.status(401).json({ error: '팀 정보가 필요합니다' });
    }

    const colors = await pool.query(
      'SELECT * FROM team_colors WHERE team_id = ? AND is_active = true ORDER BY created_at DESC',
      [teamId]
    );

    res.json(colors);
  } catch (error) {
    console.error('Get team colors error:', error);
    res.status(500).json({ error: '팀컬러 목록 조회 실패' });
  }
});

// 팀컬러 생성
router.post('/team-colors', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId;
    const { name, colorCode } = req.body;

    if (!teamId) {
      return res.status(401).json({ error: '팀 정보가 필요합니다' });
    }

    if (!name || !colorCode) {
      return res.status(400).json({ error: '이름과 색상 코드가 필요합니다' });
    }

    // 팀컬러 생성 비용 (5백만 골드)
    const cost = 5000000;

    const team = await pool.query('SELECT gold FROM teams WHERE id = ?', [teamId]);
    if (team.length === 0 || team[0].gold < cost) {
      return res.status(400).json({ error: '골드가 부족합니다 (5,000,000원 필요)' });
    }

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [cost, teamId]);

    // 팀컬러 생성
    const result = await pool.query(
      'INSERT INTO team_colors (team_id, name, color_code) VALUES (?, ?, ?)',
      [teamId, name, colorCode]
    );

    res.json({
      success: true,
      teamColor: {
        id: result.insertId,
        name,
        color_code: colorCode,
        stat_bonus: 5
      }
    });
  } catch (error) {
    console.error('Create team color error:', error);
    res.status(500).json({ error: '팀컬러 생성 실패' });
  }
});

// 카드에 팀컬러 적용
router.post('/cards/:cardId/team-color', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { cardId } = req.params;
    const { teamColorId } = req.body;
    const teamId = req.teamId;

    if (!teamId) {
      return res.status(401).json({ error: '팀 정보가 필요합니다' });
    }

    // 카드 소유권 확인
    const cards = await pool.query(
      'SELECT * FROM player_cards WHERE id = ? AND team_id = ?',
      [cardId, teamId]
    );

    if (cards.length === 0) {
      return res.status(404).json({ error: '카드를 찾을 수 없습니다' });
    }

    if (teamColorId) {
      // 팀컬러 확인
      const colors = await pool.query(
        'SELECT * FROM team_colors WHERE id = ? AND team_id = ?',
        [teamColorId, teamId]
      );

      if (colors.length === 0) {
        return res.status(404).json({ error: '팀컬러를 찾을 수 없습니다' });
      }

      // 팀컬러 적용
      await pool.query(
        'UPDATE player_cards SET team_color_id = ?, team_color_name = ? WHERE id = ?',
        [teamColorId, colors[0].name, cardId]
      );
    } else {
      // 팀컬러 해제
      await pool.query(
        'UPDATE player_cards SET team_color_id = NULL, team_color_name = NULL WHERE id = ?',
        [cardId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Apply team color error:', error);
    res.status(500).json({ error: '팀컬러 적용 실패' });
  }
});

// 팀컬러 보너스 계산 (스타터 카드)
router.get('/team-color-bonus', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = req.teamId;

    if (!teamId) {
      return res.status(401).json({ error: '팀 정보가 필요합니다' });
    }

    // 스타터 카드들의 팀컬러 확인
    const starters = await pool.query(
      `SELECT pc.*, tc.stat_bonus
       FROM player_cards pc
       LEFT JOIN team_colors tc ON pc.team_color_id = tc.id
       WHERE pc.team_id = ? AND pc.is_starter = true`,
      [teamId]
    );

    // 같은 팀컬러를 가진 카드 수 계산
    const colorCounts: { [key: number]: number } = {};
    let totalBonus = 0;

    starters.forEach((card: any) => {
      if (card.team_color_id) {
        colorCounts[card.team_color_id] = (colorCounts[card.team_color_id] || 0) + 1;
      }
    });

    // 같은 팀컬러 3명 이상: 추가 보너스
    const bonusDetails: string[] = [];
    Object.entries(colorCounts).forEach(([colorId, count]) => {
      const starter = starters.find((s: any) => s.team_color_id === parseInt(colorId));
      if (count >= 3 && starter) {
        const bonus = starter.stat_bonus || 5;
        totalBonus += bonus;
        bonusDetails.push(`${starter.team_color_name} (${count}명): +${bonus}`);
      }
    });

    res.json({
      starters,
      teamColorBonus: {
        totalBonus,
        details: bonusDetails.join(', ') || '팀컬러 보너스 없음'
      }
    });
  } catch (error) {
    console.error('Get team color bonus error:', error);
    res.status(500).json({ error: '팀컬러 보너스 조회 실패' });
  }
});

export default router;
