import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  chatWithPlayer,
  generatePlayerEvent,
  generateTeamMeeting,
  generateContractNegotiationDialogue,
  generateScoutDialogue,
  generateTrainingComment,
  generatePostMatchInterview,
  personalityTraits,
  PersonalityType
} from '../services/geminiService.js';

const router = express.Router();

// 선수와 대화하기
router.post('/chat/:playerId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: '메시지를 입력해주세요' });
    }

    // 선수 정보 조회
    const players = await pool.query(
      `SELECT pc.*, pp.name, pp.position, pp.nationality,
              t.name as team_name
       FROM player_cards pc
       INNER JOIN pro_players pp ON pc.pro_player_id = pp.id
       INNER JOIN teams t ON pc.team_id = t.id
       WHERE pc.id = ? AND pc.team_id = ?`,
      [playerId, req.teamId]
    );

    if (players.length === 0) {
      return res.status(404).json({ error: '선수를 찾을 수 없습니다' });
    }

    const player = players[0];
    const personality = (player.personality || 'CALM') as PersonalityType;

    // 최근 경기 결과로 성과 판단
    const recentMatches = await pool.query(
      `SELECT ms.kills, ms.deaths, ms.assists
       FROM match_stats ms
       INNER JOIN matches m ON ms.match_id = m.id
       WHERE ms.player_id = ? AND m.status = 'FINISHED'
       ORDER BY m.finished_at DESC
       LIMIT 5`,
      [playerId]
    );

    let performance = 'average';
    if (recentMatches.length > 0) {
      const avgKDA = recentMatches.reduce((acc: number, m: any) => {
        return acc + (m.kills + m.assists) / Math.max(1, m.deaths);
      }, 0) / recentMatches.length;

      if (avgKDA >= 3) performance = 'good';
      else if (avgKDA < 1.5) performance = 'bad';
    }

    // AI 응답 생성
    const response = await chatWithPlayer(
      player.name,
      player.position,
      personality,
      player.team_name,
      performance,
      message
    );

    // 대화 기록 저장
    await pool.query(
      `INSERT INTO player_chat_history (player_id, team_id, user_message, ai_response)
       VALUES (?, ?, ?, ?)`,
      [playerId, req.teamId, message, response]
    );

    res.json({
      response,
      personality: personalityTraits[personality].name,
      player_name: player.name
    });
  } catch (error: any) {
    console.error('Chat with player error:', error);
    res.status(500).json({ error: '대화 생성에 실패했습니다' });
  }
});

// 대화 기록 조회
router.get('/chat/:playerId/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);

    const history = await pool.query(
      `SELECT * FROM player_chat_history
       WHERE player_id = ? AND team_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [playerId, req.teamId]
    );

    res.json(history);
  } catch (error: any) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: '대화 기록 조회에 실패했습니다' });
  }
});

// 팀 회의 개최
router.post('/team-meeting', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: '회의 주제를 입력해주세요' });
    }

    // 팀 선수 목록 조회
    const players = await pool.query(
      `SELECT pc.*, pp.name, pp.position
       FROM player_cards pc
       INNER JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.team_id = ? AND pc.is_starter = true`,
      [req.teamId]
    );

    if (players.length === 0) {
      return res.status(400).json({ error: '주전 선수가 없습니다' });
    }

    // 팀 이름 조회
    const teams = await pool.query('SELECT name FROM teams WHERE id = ?', [req.teamId]);
    const teamName = teams[0]?.name || '팀';

    // 회의 결과 생성
    const playerData = players.map((p: any) => ({
      name: p.name,
      personality: (p.personality || 'CALM') as PersonalityType
    }));

    const result = await generateTeamMeeting(teamName, playerData, topic);

    // 회의 결과 저장
    await pool.query(
      `INSERT INTO team_meeting_history (team_id, topic, result)
       VALUES (?, ?, ?)`,
      [req.teamId, topic, result]
    );

    res.json({
      topic,
      result,
      participants: players.map((p: any) => ({
        name: p.name,
        position: p.position,
        personality: personalityTraits[(p.personality || 'CALM') as PersonalityType].name
      }))
    });
  } catch (error: any) {
    console.error('Team meeting error:', error);
    res.status(500).json({ error: '팀 회의 생성에 실패했습니다' });
  }
});

// 선수 이벤트 확인/생성
router.post('/check-events', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // 팀 정보 조회
    const teams = await pool.query(
      `SELECT * FROM teams WHERE id = ?`,
      [req.teamId]
    );

    if (teams.length === 0) {
      return res.status(404).json({ error: '팀을 찾을 수 없습니다' });
    }

    const teamMorale = teams[0].morale || 50;

    // 주전 선수들 조회
    const players = await pool.query(
      `SELECT pc.*, pp.name
       FROM player_cards pc
       INNER JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.team_id = ? AND pc.is_starter = true`,
      [req.teamId]
    );

    // 최근 경기 결과 조회
    const recentMatches = await pool.query(
      `SELECT
         CASE WHEN
           (m.home_team_id = ? AND m.home_score > m.away_score) OR
           (m.away_team_id = ? AND m.away_score > m.home_score)
         THEN 'WIN' ELSE 'LOSS' END as result
       FROM matches m
       WHERE (m.home_team_id = ? OR m.away_team_id = ?)
         AND m.status = 'FINISHED'
       ORDER BY m.finished_at DESC
       LIMIT 5`,
      [req.teamId, req.teamId, req.teamId, req.teamId]
    );

    const recentResults = recentMatches.map((m: any) => m.result);

    // 각 선수에 대해 이벤트 생성 시도
    const events: any[] = [];

    for (const player of players) {
      const personality = (player.personality || 'CALM') as PersonalityType;
      const event = await generatePlayerEvent(
        player.name,
        personality,
        teamMorale,
        recentResults
      );

      if (event) {
        events.push({
          player_id: player.id,
          player_name: player.name,
          ...event
        });

        // 이벤트 효과 적용
        if (event.effect) {
          const statColumn = event.effect.stat;
          if (['mental', 'focus', 'teamfight', 'laning'].includes(statColumn)) {
            await pool.query(
              `UPDATE player_cards SET ${statColumn} = GREATEST(1, LEAST(99, ${statColumn} + ?)) WHERE id = ?`,
              [event.effect.value, player.id]
            );
          }
        }

        // 이벤트 기록 저장
        await pool.query(
          `INSERT INTO player_events (player_id, team_id, event_type, title, description, effect_stat, effect_value)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [player.id, req.teamId, event.type, event.title, event.description,
           event.effect?.stat || null, event.effect?.value || 0]
        );
      }
    }

    res.json({
      events,
      team_morale: teamMorale,
      recent_results: recentResults
    });
  } catch (error: any) {
    console.error('Check events error:', error);
    res.status(500).json({ error: '이벤트 확인에 실패했습니다' });
  }
});

// 경기 후 인터뷰 생성
router.post('/post-match-interview/:matchId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const matchId = parseInt(req.params.matchId);

    // 경기 정보 조회
    const matches = await pool.query(
      `SELECT * FROM matches WHERE id = ?`,
      [matchId]
    );

    if (matches.length === 0) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다' });
    }

    const match = matches[0];
    const isHome = match.home_team_id === req.teamId;
    const isWin = isHome
      ? match.home_score > match.away_score
      : match.away_score > match.home_score;

    // 경기 스탯 조회 (MVP 선정)
    const stats = await pool.query(
      `SELECT ms.*, pc.personality, pp.name
       FROM match_stats ms
       INNER JOIN player_cards pc ON ms.player_id = pc.id
       INNER JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE ms.match_id = ? AND ms.team_id = ?
       ORDER BY (ms.kills + ms.assists - ms.deaths) DESC
       LIMIT 1`,
      [matchId, req.teamId]
    );

    if (stats.length === 0) {
      return res.status(400).json({ error: '경기 스탯이 없습니다' });
    }

    const mvpPlayer = stats[0];
    const personality = (mvpPlayer.personality || 'CALM') as PersonalityType;

    const interview = await generatePostMatchInterview(
      mvpPlayer.name,
      personality,
      isWin,
      true, // MVP
      mvpPlayer.kills,
      mvpPlayer.deaths,
      mvpPlayer.assists
    );

    res.json({
      player_name: mvpPlayer.name,
      personality: personalityTraits[personality].name,
      is_win: isWin,
      is_mvp: true,
      kda: `${mvpPlayer.kills}/${mvpPlayer.deaths}/${mvpPlayer.assists}`,
      interview
    });
  } catch (error: any) {
    console.error('Post match interview error:', error);
    res.status(500).json({ error: '인터뷰 생성에 실패했습니다' });
  }
});

export default router;
