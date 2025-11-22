import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 내 선수 목록
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { position, sort_by, order } = req.query;

    let query = `
      SELECT p.*, po.is_starter, po.is_benched,
             (p.mental + p.teamfight + p.focus + p.laning) as overall
      FROM players p
      INNER JOIN player_ownership po ON p.id = po.player_id
      WHERE po.team_id = ?
    `;

    const params: any[] = [req.teamId];

    if (position) {
      query += ' AND p.position = ?';
      params.push(position);
    }

    if (sort_by) {
      const validSorts = ['overall', 'level', 'name', 'mental', 'teamfight', 'focus', 'laning'];
      if (validSorts.includes(sort_by as string)) {
        query += ` ORDER BY ${sort_by} ${order === 'desc' ? 'DESC' : 'ASC'}`;
      }
    } else {
      query += ' ORDER BY overall DESC';
    }

    const players = await pool.query(query, params);

    res.json(players);
  } catch (error: any) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Failed to get players' });
  }
});

// 선수 검색
router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, position, min_overall, max_overall } = req.query;

    let query = `
      SELECT p.*, 
             (p.mental + p.teamfight + p.focus + p.laning) as overall,
             (SELECT COUNT(*) FROM player_ownership po2 WHERE po2.player_id = p.id) as owned_count
      FROM players p
      WHERE NOT EXISTS (
        SELECT 1 FROM player_ownership po 
        WHERE po.player_id = p.id
      )
    `;

    const params: any[] = [];

    if (name) {
      query += ' AND p.name LIKE ?';
      params.push(`%${name}%`);
    }

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

    query += ' ORDER BY overall DESC LIMIT 100';

    const players = await pool.query(query, params);

    res.json(players);
  } catch (error: any) {
    console.error('Search players error:', error);
    res.status(500).json({ error: 'Failed to search players' });
  }
});

// 선수 스카우팅
router.post('/scout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { cost_type, cost_amount } = req.body; // cost_type: 'gold' or 'diamond'

    const cost = cost_type === 'diamond' ? 10 : 1000;

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

    // 랜덤 선수 생성
    const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    const position = positions[Math.floor(Math.random() * positions.length)];
    
    // 포지션별 스탯 특화
    const positionStats: Record<string, { mental: number; teamfight: number; focus: number; laning: number }> = {
      'TOP': { mental: 0.2, teamfight: 0.3, focus: 0.25, laning: 0.25 },
      'JUNGLE': { mental: 0.25, teamfight: 0.3, focus: 0.3, laning: 0.15 },
      'MID': { mental: 0.2, teamfight: 0.25, focus: 0.3, laning: 0.25 },
      'ADC': { mental: 0.15, teamfight: 0.35, focus: 0.25, laning: 0.25 },
      'SUPPORT': { mental: 0.3, teamfight: 0.25, focus: 0.25, laning: 0.2 }
    };

    // 오버롤 200-600 사이 랜덤
    const baseOverall = 200 + Math.floor(Math.random() * 400);
    const statWeights = positionStats[position];
    const mental = Math.floor(baseOverall * statWeights.mental) + Math.floor(Math.random() * 30);
    const teamfight = Math.floor(baseOverall * statWeights.teamfight) + Math.floor(Math.random() * 30);
    const focus = Math.floor(baseOverall * statWeights.focus) + Math.floor(Math.random() * 30);
    const laning = baseOverall - mental - teamfight - focus;

    // 국적 리스트 (주요 리그 국가만)
    const nationalities = ['KR', 'CN', 'EU', 'NA', 'VN', 'TW', 'JP', 'BR', 'TR', 'RU', 'PH', 'ID', 'TH', 'MY', 'SG', 'FR', 'DE', 'ES', 'DK', 'PL', 'SE', 'NO', 'FI', 'IT', 'GB', 'CA', 'AU', 'MX', 'AR', 'CL'];
    const nationality = nationalities[Math.floor(Math.random() * nationalities.length)];

    // 이미 소유된 선수 이름 확인 (어떤 팀이든 소유 중이면 제외)
    const ownedPlayers = await pool.query(
      `SELECT DISTINCT p.name 
       FROM players p 
       INNER JOIN player_ownership po ON p.id = po.player_id`
    );
    const ownedNames = new Set(ownedPlayers.map((p: any) => p.name));

    // 기본 선수 이름 리스트 (제공된 선수 + 추가 선수)
    const allBaseNames = [
      'Leadingsquash68', 'GaeNald', 'Vilrain', 'Onsoo', 't1romance', '03261592630',
      'SquidFriend1', 'DOKyuN', 'CGG', 'KIO', 'Pizza', 'Yebin', 'LHW', 'Hyeseong',
      'SoSo', 'MS1005', 'Laving', 'Mato', 'Frost', 'JeongMin', 'JUNHYUNG',
      // 추가 가상 선수들
      'Faker', 'Chovy', 'Deft', 'Keria', 'Zeus', 'Oner', 'Gumayusi', 'ShowMaker', 'Canyon',
      'BeryL', 'Nuguri', 'TheShy', 'Rookie', 'Uzi', 'Caps', 'Perkz', 'Doublelift', 'Bjergsen'
    ];
    
    // 소유되지 않은 이름만 필터링
    const availableNames = allBaseNames.filter(name => !ownedNames.has(name));
    
    // 소유되지 않은 이름이 없으면 랜덤 이름 생성
    let name: string;
    if (availableNames.length > 0) {
      const baseName = availableNames[Math.floor(Math.random() * availableNames.length)];
      // 숫자가 이미 포함된 이름이면 숫자 추가 안함
      name = /^\d/.test(baseName) || /\d$/.test(baseName) 
        ? baseName 
        : baseName + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    } else {
      // 모든 기본 이름이 소유되었으면 완전히 새로운 랜덤 이름 생성
      const randomNames = ['Player', 'Pro', 'Gamer', 'Star', 'Elite', 'Master', 'Champion', 'Legend'];
      const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];
      name = randomName + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    }

    const result = await pool.query(
      `INSERT INTO players (name, nationality, position, mental, teamfight, focus, laning, level, exp_to_next) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 100)`,
      [name, nationality, position, Math.min(mental, 300), Math.min(teamfight, 300), Math.min(focus, 300), Math.min(laning, 300)]
    );

    const playerId = result.insertId;

    // 선수 소유권 추가
    await pool.query(
      'INSERT INTO player_ownership (player_id, team_id, is_benched) VALUES (?, ?, true)',
      [playerId, req.teamId]
    );

    const newPlayer = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);

    res.json({ player: newPlayer[0], message: 'Player scouted successfully' });
  } catch (error: any) {
    console.error('Scout player error:', error);
    res.status(500).json({ error: 'Failed to scout player' });
  }
});

// 선수 영입 (검색 후)
router.post('/recruit/:playerId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);

    // 선수 확인
    const players = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // 이미 소유한 선수인지 확인
    const ownership = await pool.query(
      'SELECT * FROM player_ownership WHERE player_id = ? AND team_id = ?',
      [playerId, req.teamId]
    );

    if (ownership.length > 0) {
      return res.status(400).json({ error: 'You already own this player' });
    }

    // 최대 보유 수 확인 (23명)
    const playerCount = await pool.query(
      'SELECT COUNT(*) as count FROM player_ownership WHERE team_id = ?',
      [req.teamId]
    );

    if (playerCount[0].count >= 23) {
      return res.status(400).json({ error: 'Maximum player limit reached (23)' });
    }

    // 영입 비용 계산 (오버롤 * 100)
    const player = players[0];
    const overall = player.mental + player.teamfight + player.focus + player.laning;
    const cost = overall * 100;

    // 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0 || teams[0].gold < cost) {
      return res.status(400).json({ error: 'Insufficient gold' });
    }

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [cost, req.teamId]);

    // 선수 소유권 추가
    await pool.query(
      'INSERT INTO player_ownership (player_id, team_id, is_benched) VALUES (?, ?, true)',
      [playerId, req.teamId]
    );

    res.json({ message: 'Player recruited successfully' });
  } catch (error: any) {
    console.error('Recruit player error:', error);
    res.status(500).json({ error: 'Failed to recruit player' });
  }
});

// 선수 레벨업
router.post('/:playerId/levelup', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { stat_allocation } = req.body; // { mental: 5, teamfight: 3, focus: 2, laning: 0 }

    // 선수 소유 확인
    const ownership = await pool.query(
      'SELECT * FROM player_ownership WHERE player_id = ? AND team_id = ?',
      [playerId, req.teamId]
    );

    if (ownership.length === 0) {
      return res.status(404).json({ error: 'Player not found or not owned' });
    }

    const players = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = players[0];

    // 경험치 확인
    if (player.exp < player.exp_to_next) {
      return res.status(400).json({ error: 'Not enough experience' });
    }

    // 스탯 포인트 확인
    const totalPoints = (stat_allocation.mental || 0) + 
                       (stat_allocation.teamfight || 0) + 
                       (stat_allocation.focus || 0) + 
                       (stat_allocation.laning || 0);

    if (totalPoints > player.stat_points) {
      return res.status(400).json({ error: 'Not enough stat points' });
    }

    // 스탯 한계 확인
    const newMental = player.mental + (stat_allocation.mental || 0);
    const newTeamfight = player.teamfight + (stat_allocation.teamfight || 0);
    const newFocus = player.focus + (stat_allocation.focus || 0);
    const newLaning = player.laning + (stat_allocation.laning || 0);

    if (newMental > 300 || newTeamfight > 300 || newFocus > 300 || newLaning > 300) {
      return res.status(400).json({ error: 'Stat limit exceeded (max 300 per stat)' });
    }

    // 레벨업 처리
    const newLevel = player.level + 1;
    const remainingExp = player.exp - player.exp_to_next;
    const newExpToNext = Math.floor(player.exp_to_next * 1.5);
    const newStatPoints = player.stat_points - totalPoints + 5; // 레벨업 시 5 포인트 추가

    await pool.query(
      `UPDATE players 
       SET level = ?,
           exp = ?,
           exp_to_next = ?,
           stat_points = ?,
           mental = ?,
           teamfight = ?,
           focus = ?,
           laning = ?
       WHERE id = ?`,
      [
        newLevel, remainingExp, newExpToNext, newStatPoints,
        newMental, newTeamfight, newFocus, newLaning, playerId
      ]
    );

    const updatedPlayer = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);

    res.json({ player: updatedPlayer[0], message: 'Player leveled up successfully' });
  } catch (error: any) {
    console.error('Level up error:', error);
    res.status(500).json({ error: 'Failed to level up player' });
  }
});

// 선수 스탯 수동 분배
router.post('/:playerId/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { mental, teamfight, focus, laning } = req.body;

    // 선수 소유 확인
    const ownership = await pool.query(
      'SELECT * FROM player_ownership WHERE player_id = ? AND team_id = ?',
      [playerId, req.teamId]
    );

    if (ownership.length === 0) {
      return res.status(404).json({ error: 'Player not found or not owned' });
    }

    const players = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = players[0];

    // 사용할 스탯 포인트 계산
    const totalUsed = (mental || 0) + (teamfight || 0) + (focus || 0) + (laning || 0);
    const currentTotal = player.mental + player.teamfight + player.focus + player.laning;
    const newTotal = (mental || player.mental) + (teamfight || player.teamfight) + 
                    (focus || player.focus) + (laning || player.laning);
    const pointsUsed = newTotal - currentTotal;

    if (pointsUsed > player.stat_points) {
      return res.status(400).json({ error: 'Not enough stat points' });
    }

    // 스탯 한계 확인
    if ((mental && mental > 300) || (teamfight && teamfight > 300) || 
        (focus && focus > 300) || (laning && laning > 300)) {
      return res.status(400).json({ error: 'Stat limit exceeded (max 300 per stat)' });
    }

    // 스탯 업데이트
    await pool.query(
      `UPDATE players 
       SET mental = COALESCE(?, mental),
           teamfight = COALESCE(?, teamfight),
           focus = COALESCE(?, focus),
           laning = COALESCE(?, laning),
           stat_points = stat_points - ?
       WHERE id = ?`,
      [mental, teamfight, focus, laning, pointsUsed, playerId]
    );

    const updatedPlayer = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);

    res.json({ player: updatedPlayer[0], message: 'Stats updated successfully' });
  } catch (error: any) {
    console.error('Update stats error:', error);
    res.status(500).json({ error: 'Failed to update stats' });
  }
});

// 선수 유니폼 강화
router.post('/:playerId/uniform/upgrade', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);

    // 선수 소유 확인
    const ownership = await pool.query(
      'SELECT * FROM player_ownership WHERE player_id = ? AND team_id = ?',
      [playerId, req.teamId]
    );

    if (ownership.length === 0) {
      return res.status(404).json({ error: 'Player not found or not owned' });
    }

    const players = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = players[0];

    if (player.uniform_level >= 10) {
      return res.status(400).json({ error: 'Uniform already at maximum level' });
    }

    // 강화 비용 (레벨당 5000 골드)
    const cost = (player.uniform_level + 1) * 5000;

    // 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0 || teams[0].gold < cost) {
      return res.status(400).json({ error: 'Insufficient gold' });
    }

    // 강화 성공 확률 (레벨이 높을수록 낮아짐)
    const successRate = Math.max(10, 100 - (player.uniform_level * 10));
    const success = Math.random() * 100 < successRate;

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [cost, req.teamId]);

    if (success) {
      // 강화 성공
      const newLevel = player.uniform_level + 1;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1); // 1개월 유지

      await pool.query(
        `UPDATE players 
         SET uniform_level = ?,
             uniform_expires_at = ?,
             contract_fee = 0,
             player_condition = LEAST(player_condition + 10, 100)
         WHERE id = ?`,
        [newLevel, expiresAt, playerId]
      );

      res.json({ 
        success: true, 
        level: newLevel, 
        message: 'Uniform upgrade successful! Contract fee waived and condition improved.' 
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Uniform upgrade failed. Try again!' 
      });
    }
  } catch (error: any) {
    console.error('Uniform upgrade error:', error);
    res.status(500).json({ error: 'Failed to upgrade uniform' });
  }
});

// 선수 스타터/벤치 설정
router.put('/:playerId/lineup', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { is_starter, is_benched } = req.body;

    // 선수 소유 확인
    const ownership = await pool.query(
      'SELECT * FROM player_ownership WHERE player_id = ? AND team_id = ?',
      [playerId, req.teamId]
    );

    if (ownership.length === 0) {
      return res.status(404).json({ error: 'Player not found or not owned' });
    }

    // 스타터는 최대 5명
    if (is_starter) {
      const starterCount = await pool.query(
        'SELECT COUNT(*) as count FROM player_ownership WHERE team_id = ? AND is_starter = true',
        [req.teamId]
      );

      if (starterCount[0].count >= 5 && !ownership[0].is_starter) {
        return res.status(400).json({ error: 'Maximum 5 starters allowed' });
      }
    }

    await pool.query(
      'UPDATE player_ownership SET is_starter = ?, is_benched = ? WHERE player_id = ? AND team_id = ?',
      [is_starter || false, is_benched !== undefined ? is_benched : !is_starter, playerId, req.teamId]
    );

    res.json({ message: 'Lineup updated successfully' });
  } catch (error: any) {
    console.error('Update lineup error:', error);
    res.status(500).json({ error: 'Failed to update lineup' });
  }
});

export default router;

