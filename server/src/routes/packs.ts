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

// 프로팀 컬러 목록 조회 (T1, GEN 등)
router.get('/team-colors', async (req, res) => {
  try {
    // pro_players 테이블에서 고유한 팀 목록 가져오기
    const teams = await pool.query(
      `SELECT DISTINCT team as team_name, league FROM pro_players WHERE is_active = true ORDER BY league, team`
    );

    // 팀별 색상 매핑
    const teamColors: { [key: string]: string } = {
      'T1': '#E2012D',
      'Gen.G': '#AA8A00',
      'DRX': '#5A8DFF',
      'KT Rolster': '#FF0000',
      'Dplus KIA': '#00A651',
      'Hanwha Life': '#FF6B00',
      'Kwangdong Freecs': '#00D1C1',
      'Nongshim RedForce': '#D31145',
      'OK BRION': '#6B5CE7',
      'FearX': '#FFD700',
      'G2 Esports': '#1D1D1B',
      'Fnatic': '#FF5900',
      'MAD Lions': '#0A2240',
      'Team Vitality': '#FFEE00',
      'Rogue': '#1E3A5F',
      'SK Gaming': '#0089CF',
      'Team BDS': '#1A1A1A',
      'Excel Esports': '#47D1E8',
      'Astralis': '#FF0000',
      'Team Heretics': '#FF2D55',
      'JD Gaming': '#C8102E',
      'Top Esports': '#FF0000',
      'Bilibili Gaming': '#00A1D6',
      'Weibo Gaming': '#FF8200',
      'LNG Esports': '#00A3E0',
      'EDward Gaming': '#000000',
      'Royal Never Give Up': '#B4975A',
      'FunPlus Phoenix': '#FF0000',
      'Rare Atom': '#FF6B6B',
      'Anyone\'s Legend': '#7B68EE',
      'Cloud9': '#00AEEF',
      'Team Liquid': '#0D3B66',
      '100 Thieves': '#FF0000',
      'FlyQuest': '#21825B',
      'NRG': '#38B6FF',
      'Evil Geniuses': '#0A0A0A',
      'Dignitas': '#FFCC00',
      'Golden Guardians': '#F0B90B',
      'TSM': '#FFFFFF',
      'Immortals': '#00D4AA'
    };

    const result = teams.map((t: any) => ({
      team_name: t.team_name,
      league: t.league,
      color_code: teamColors[t.team_name] || '#888888'
    }));

    res.json(result);
  } catch (error) {
    console.error('Get team colors error:', error);
    res.status(500).json({ error: '팀컬러 목록 조회 실패' });
  }
});

// 카드에 팀컬러 적용 (프로팀 이름으로)
router.post('/cards/:cardId/team-color', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { cardId } = req.params;
    const { teamColorName } = req.body; // 프로팀 이름 (T1, Gen.G 등)
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

    if (teamColorName) {
      // 팀컬러 적용 (프로팀 이름 저장)
      await pool.query(
        'UPDATE player_cards SET team_color_name = ? WHERE id = ?',
        [teamColorName, cardId]
      );
    } else {
      // 팀컬러 해제
      await pool.query(
        'UPDATE player_cards SET team_color_name = NULL WHERE id = ?',
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
      `SELECT pc.*, pp.name, pp.team as pro_team, pp.position
       FROM player_cards pc
       JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.team_id = ? AND pc.is_starter = true`,
      [teamId]
    );

    // 같은 팀컬러(프로팀)를 가진 카드 수 계산
    const colorCounts: { [key: string]: number } = {};
    let totalBonus = 0;

    starters.forEach((card: any) => {
      if (card.team_color_name) {
        colorCounts[card.team_color_name] = (colorCounts[card.team_color_name] || 0) + 1;
      }
    });

    // 같은 팀컬러 3명 이상: +5 보너스
    const bonusDetails: string[] = [];
    Object.entries(colorCounts).forEach(([colorName, count]) => {
      if (count >= 3) {
        totalBonus += 5;
        bonusDetails.push(`${colorName} (${count}명): +5`);
      }
    });

    res.json({
      starters,
      teamColorBonus: {
        totalBonus,
        details: bonusDetails.join(', ') || '팀컬러 보너스 없음 (같은 팀 3명 이상 필요)'
      }
    });
  } catch (error) {
    console.error('Get team color bonus error:', error);
    res.status(500).json({ error: '팀컬러 보너스 조회 실패' });
  }
});

export default router;
