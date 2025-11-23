import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  generateScoutDialogue,
  generatePersonality,
  PersonalityType
} from '../services/geminiService.js';

const router = express.Router();

// 스카우트 가능한 선수 목록 조회
router.get('/available', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { position, min_overall, max_overall } = req.query;

    // 누구에게도 소유되지 않은 프로 선수들 조회
    let query = `
      SELECT pp.*,
             (SELECT COUNT(*) FROM player_cards pc WHERE pc.pro_player_id = pp.id) as owned_count
      FROM pro_players pp
      WHERE NOT EXISTS (
        SELECT 1 FROM player_cards pc WHERE pc.pro_player_id = pp.id
      )
    `;

    const params: any[] = [];

    if (position) {
      query += ' AND pp.position = ?';
      params.push(position);
    }

    const overall_min = parseInt(min_overall as string) || 0;
    const overall_max = parseInt(max_overall as string) || 400;

    query += ' AND (pp.mental + pp.teamfight + pp.focus + pp.laning) >= ?';
    params.push(overall_min);

    query += ' AND (pp.mental + pp.teamfight + pp.focus + pp.laning) <= ?';
    params.push(overall_max);

    query += ' ORDER BY (pp.mental + pp.teamfight + pp.focus + pp.laning) DESC LIMIT 50';

    const players = await pool.query(query, params);

    // 오버롤 계산 추가
    const playersWithOverall = players.map((p: any) => ({
      ...p,
      overall: p.mental + p.teamfight + p.focus + p.laning
    }));

    res.json(playersWithOverall);
  } catch (error: any) {
    console.error('Get available players error:', error);
    res.status(500).json({ error: '스카우트 가능 선수 조회에 실패했습니다' });
  }
});

// 스카우트 시도
router.post('/:proPlayerId/scout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const proPlayerId = parseInt(req.params.proPlayerId);

    // 프로 선수 정보 조회
    const proPlayers = await pool.query(
      'SELECT * FROM pro_players WHERE id = ?',
      [proPlayerId]
    );

    if (proPlayers.length === 0) {
      return res.status(404).json({ error: '선수를 찾을 수 없습니다' });
    }

    const proPlayer = proPlayers[0];

    // 이미 누군가가 소유하고 있는지 확인
    const existingCards = await pool.query(
      'SELECT * FROM player_cards WHERE pro_player_id = ?',
      [proPlayerId]
    );

    if (existingCards.length > 0) {
      return res.status(400).json({ error: '이 선수는 이미 다른 팀에 소속되어 있습니다' });
    }

    // 팀의 스카우트 능력 확인 (코치가 있으면 보너스)
    const coaches = await pool.query(
      `SELECT c.scouting_ability FROM coaches c
       INNER JOIN coach_ownership co ON c.id = co.coach_id
       WHERE co.team_id = ?`,
      [req.teamId]
    );

    let scoutingBonus = 0;
    if (coaches.length > 0) {
      scoutingBonus = coaches.reduce((acc: number, c: any) => acc + (c.scouting_ability || 0), 0) / coaches.length;
    }

    // 스카우트 비용 계산 (오버롤 기반)
    const overall = proPlayer.mental + proPlayer.teamfight + proPlayer.focus + proPlayer.laning;
    const scoutCost = Math.floor(overall * 100); // 오버롤 * 100 골드

    // 팀 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0) {
      return res.status(404).json({ error: '팀을 찾을 수 없습니다' });
    }

    if (teams[0].gold < scoutCost) {
      return res.status(400).json({
        error: `스카우트 비용이 부족합니다. 필요: ${scoutCost.toLocaleString()} 골드`
      });
    }

    // 스카우트 성공 확률 계산
    // 기본 50% + 스카우팅 능력 보너스 (최대 40%) - 오버롤에 따른 난이도 (최대 30%)
    const baseChance = 50;
    const scoutBonus = scoutingBonus * 0.4; // 스카우팅 능력 100이면 +40%
    const difficultyPenalty = Math.min(30, (overall - 200) * 0.1); // 오버롤 200 이상부터 페널티

    const successChance = Math.min(90, Math.max(10, baseChance + scoutBonus - difficultyPenalty));
    const roll = Math.random() * 100;
    const isSuccess = roll < successChance;

    // 스카우트 비용 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [scoutCost, req.teamId]);

    // 성격 생성
    const personality = generatePersonality(proPlayer.mental);

    // AI 대사 생성
    let scoutResult: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    if (isSuccess) {
      scoutResult = 'SUCCESS';
    } else if (roll < successChance + 20) {
      scoutResult = 'PARTIAL';
    } else {
      scoutResult = 'FAILED';
    }

    const dialogue = await generateScoutDialogue(
      proPlayer.name,
      proPlayer.position,
      personality,
      overall,
      scoutResult
    );

    if (isSuccess) {
      // 선수 카드 생성
      const result = await pool.query(
        `INSERT INTO player_cards (
          pro_player_id, team_id, mental, teamfight, focus, laning,
          condition_value, form, personality, is_starter
        ) VALUES (?, ?, ?, ?, ?, ?, 100, 'NORMAL', ?, false)`,
        [
          proPlayerId,
          req.teamId,
          proPlayer.mental,
          proPlayer.teamfight,
          proPlayer.focus,
          proPlayer.laning,
          personality
        ]
      );

      // 스카우트 기록 저장
      await pool.query(
        `INSERT INTO scout_history (team_id, pro_player_id, result, cost, dialogue)
         VALUES (?, ?, 'SUCCESS', ?, ?)`,
        [req.teamId, proPlayerId, scoutCost, dialogue]
      );

      res.json({
        success: true,
        message: `${proPlayer.name} 선수 스카우트에 성공했습니다!`,
        player_card_id: result.insertId,
        player: {
          id: result.insertId,
          name: proPlayer.name,
          position: proPlayer.position,
          overall,
          personality
        },
        dialogue,
        cost: scoutCost
      });
    } else {
      // 스카우트 실패 기록
      await pool.query(
        `INSERT INTO scout_history (team_id, pro_player_id, result, cost, dialogue)
         VALUES (?, ?, 'FAILED', ?, ?)`,
        [req.teamId, proPlayerId, scoutCost, dialogue]
      );

      res.json({
        success: false,
        message: `${proPlayer.name} 선수가 스카우트 제안을 거절했습니다.`,
        dialogue,
        cost: scoutCost,
        success_chance: successChance.toFixed(1)
      });
    }
  } catch (error: any) {
    console.error('Scout player error:', error);
    res.status(500).json({ error: '스카우트에 실패했습니다' });
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

// FA 선수 목록 (다른 팀 소속이지만 계약 만료 임박한 선수)
router.get('/free-agents', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // FA 선수: player_cards가 없는 pro_players
    const freeAgents = await pool.query(
      `SELECT pp.*,
              (pp.mental + pp.teamfight + pp.focus + pp.laning) as overall
       FROM pro_players pp
       WHERE NOT EXISTS (
         SELECT 1 FROM player_cards pc WHERE pc.pro_player_id = pp.id
       )
       ORDER BY (pp.mental + pp.teamfight + pp.focus + pp.laning) DESC
       LIMIT 100`
    );

    res.json(freeAgents);
  } catch (error: any) {
    console.error('Get free agents error:', error);
    res.status(500).json({ error: 'FA 선수 조회에 실패했습니다' });
  }
});

export default router;
