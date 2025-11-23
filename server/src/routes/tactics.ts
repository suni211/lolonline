import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 포지션별 기본 플레이스타일
const DEFAULT_PLAYSTYLES: Record<string, string> = {
  TOP: 'TEAMFIGHT',
  JUNGLE: 'GANK',
  MID: 'LANE_DOMINANCE',
  ADC: 'SAFE',
  SUPPORT: 'PEEL'
};

// 포지션별 사용 가능한 플레이스타일
const POSITION_PLAYSTYLES: Record<string, string[]> = {
  TOP: ['SPLITPUSH', 'TEAMFIGHT', 'TANK'],
  JUNGLE: ['GANK', 'FARM', 'INVADE'],
  MID: ['ROAM', 'LANE_DOMINANCE', 'FARM'],
  ADC: ['AGGRESSIVE', 'SAFE', 'UTILITY'],
  SUPPORT: ['ENGAGE', 'PEEL', 'ROAM']
};

// 플레이스타일 한글명
const PLAYSTYLE_NAMES: Record<string, string> = {
  SPLITPUSH: '스플릿',
  TEAMFIGHT: '한타',
  TANK: '탱킹',
  GANK: '갱킹',
  FARM: '파밍',
  INVADE: '인베이드',
  ROAM: '로밍',
  LANE_DOMINANCE: '라인주도',
  AGGRESSIVE: '공격적',
  SAFE: '안전',
  UTILITY: '유틸',
  ENGAGE: '이니시',
  PEEL: '필'
};

// 팀 전술 조회
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({ error: '팀이 필요합니다' });
    }

    // 팀 전술 조회 (없으면 기본값 생성)
    let tactics = await pool.query(
      'SELECT * FROM team_tactics WHERE team_id = ?',
      [req.teamId]
    );

    if (tactics.length === 0) {
      // 기본 전술 생성
      await pool.query(
        `INSERT INTO team_tactics (team_id) VALUES (?)`,
        [req.teamId]
      );
      tactics = await pool.query(
        'SELECT * FROM team_tactics WHERE team_id = ?',
        [req.teamId]
      );
    }

    // 포지션별 전술 조회
    let positionTactics = await pool.query(
      'SELECT * FROM position_tactics WHERE team_id = ?',
      [req.teamId]
    );

    // 없는 포지션은 기본값으로 생성
    const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    const existingPositions = positionTactics.map((pt: any) => pt.position);

    for (const pos of positions) {
      if (!existingPositions.includes(pos)) {
        await pool.query(
          `INSERT INTO position_tactics (team_id, position, playstyle) VALUES (?, ?, ?)`,
          [req.teamId, pos, DEFAULT_PLAYSTYLES[pos]]
        );
      }
    }

    // 다시 조회
    positionTactics = await pool.query(
      'SELECT * FROM position_tactics WHERE team_id = ? ORDER BY FIELD(position, "TOP", "JUNGLE", "MID", "ADC", "SUPPORT")',
      [req.teamId]
    );

    res.json({
      teamTactics: tactics[0],
      positionTactics,
      playstyleOptions: POSITION_PLAYSTYLES,
      playstyleNames: PLAYSTYLE_NAMES
    });
  } catch (error: any) {
    console.error('Get tactics error:', error);
    res.status(500).json({ error: '전술 조회 실패' });
  }
});

// 팀 전술 업데이트
router.put('/team', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({ error: '팀이 필요합니다' });
    }

    const {
      teamfight_style,
      split_formation,
      aggression_level,
      priority_objective,
      early_game_strategy
    } = req.body;

    // 유효성 검사
    const validTeamfightStyles = ['FIGHT_FIRST', 'OBJECTIVE_FIRST'];
    const validFormations = ['1-3-1', '1-4-0', '0-5-0'];
    const validAggressions = ['VERY_AGGRESSIVE', 'AGGRESSIVE', 'NORMAL', 'DEFENSIVE', 'VERY_DEFENSIVE'];
    const validObjectives = ['DRAGON', 'BARON', 'TOWER', 'TEAMFIGHT'];
    const validStrategies = ['AGGRESSIVE', 'STANDARD', 'SCALING'];

    if (teamfight_style && !validTeamfightStyles.includes(teamfight_style)) {
      return res.status(400).json({ error: '유효하지 않은 한타 스타일입니다' });
    }
    if (split_formation && !validFormations.includes(split_formation)) {
      return res.status(400).json({ error: '유효하지 않은 스플릿 포메이션입니다' });
    }
    if (aggression_level && !validAggressions.includes(aggression_level)) {
      return res.status(400).json({ error: '유효하지 않은 공격성향입니다' });
    }
    if (priority_objective && !validObjectives.includes(priority_objective)) {
      return res.status(400).json({ error: '유효하지 않은 우선순위 오브젝트입니다' });
    }
    if (early_game_strategy && !validStrategies.includes(early_game_strategy)) {
      return res.status(400).json({ error: '유효하지 않은 초반 전략입니다' });
    }

    // UPSERT
    await pool.query(
      `INSERT INTO team_tactics (team_id, teamfight_style, split_formation, aggression_level, priority_objective, early_game_strategy)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         teamfight_style = COALESCE(?, teamfight_style),
         split_formation = COALESCE(?, split_formation),
         aggression_level = COALESCE(?, aggression_level),
         priority_objective = COALESCE(?, priority_objective),
         early_game_strategy = COALESCE(?, early_game_strategy)`,
      [
        req.teamId,
        teamfight_style || 'TACTICAL',
        split_formation || '0-5-0',
        aggression_level || 'NORMAL',
        priority_objective || 'DRAGON',
        early_game_strategy || 'STANDARD',
        teamfight_style,
        split_formation,
        aggression_level,
        priority_objective,
        early_game_strategy
      ]
    );

    const updated = await pool.query(
      'SELECT * FROM team_tactics WHERE team_id = ?',
      [req.teamId]
    );

    res.json({
      message: '팀 전술이 업데이트되었습니다',
      tactics: updated[0]
    });
  } catch (error: any) {
    console.error('Update team tactics error:', error);
    res.status(500).json({ error: '팀 전술 업데이트 실패' });
  }
});

// 포지션별 전술 업데이트
router.put('/position/:position', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({ error: '팀이 필요합니다' });
    }

    const { position } = req.params;
    const { playstyle, risk_level, priority_target } = req.body;

    const validPositions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    if (!validPositions.includes(position)) {
      return res.status(400).json({ error: '유효하지 않은 포지션입니다' });
    }

    // 플레이스타일 유효성 검사
    if (playstyle && !POSITION_PLAYSTYLES[position].includes(playstyle)) {
      return res.status(400).json({
        error: `${position}에서 사용할 수 없는 플레이스타일입니다`,
        validOptions: POSITION_PLAYSTYLES[position]
      });
    }

    const validRiskLevels = ['HIGH', 'MEDIUM', 'LOW'];
    const validTargets = ['CARRY', 'TANK', 'SUPPORT', 'NEAREST'];

    if (risk_level && !validRiskLevels.includes(risk_level)) {
      return res.status(400).json({ error: '유효하지 않은 리스크 레벨입니다' });
    }
    if (priority_target && !validTargets.includes(priority_target)) {
      return res.status(400).json({ error: '유효하지 않은 우선순위 타겟입니다' });
    }

    // UPSERT
    await pool.query(
      `INSERT INTO position_tactics (team_id, position, playstyle, risk_level, priority_target)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         playstyle = COALESCE(?, playstyle),
         risk_level = COALESCE(?, risk_level),
         priority_target = COALESCE(?, priority_target)`,
      [
        req.teamId,
        position,
        playstyle || DEFAULT_PLAYSTYLES[position],
        risk_level || 'MEDIUM',
        priority_target || 'NEAREST',
        playstyle,
        risk_level,
        priority_target
      ]
    );

    const updated = await pool.query(
      'SELECT * FROM position_tactics WHERE team_id = ? AND position = ?',
      [req.teamId, position]
    );

    res.json({
      message: `${position} 전술이 업데이트되었습니다`,
      tactics: updated[0]
    });
  } catch (error: any) {
    console.error('Update position tactics error:', error);
    res.status(500).json({ error: '포지션 전술 업데이트 실패' });
  }
});

// 경기 중 공격성향 변경 (실시간)
router.post('/match/:matchId/aggression', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({ error: '팀이 필요합니다' });
    }

    const matchId = parseInt(req.params.matchId);
    const { aggression_level, game_time } = req.body;

    // 경기 확인
    const matches = await pool.query(
      'SELECT * FROM matches WHERE id = ? AND status = "LIVE" AND (home_team_id = ? OR away_team_id = ?)',
      [matchId, req.teamId, req.teamId]
    );

    if (matches.length === 0) {
      return res.status(404).json({ error: '진행 중인 경기를 찾을 수 없습니다' });
    }

    const validAggressions = ['VERY_AGGRESSIVE', 'AGGRESSIVE', 'NORMAL', 'DEFENSIVE', 'VERY_DEFENSIVE'];
    if (!validAggressions.includes(aggression_level)) {
      return res.status(400).json({ error: '유효하지 않은 공격성향입니다' });
    }

    // 현재 공격성향 조회
    const current = await pool.query(
      'SELECT aggression_level FROM team_tactics WHERE team_id = ?',
      [req.teamId]
    );

    const oldValue = current.length > 0 ? current[0].aggression_level : 'NORMAL';

    // 팀 전술 업데이트
    await pool.query(
      `INSERT INTO team_tactics (team_id, aggression_level)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE aggression_level = ?`,
      [req.teamId, aggression_level, aggression_level]
    );

    // 변경 기록 저장
    await pool.query(
      `INSERT INTO match_tactic_changes (match_id, team_id, game_time, change_type, old_value, new_value)
       VALUES (?, ?, ?, 'AGGRESSION', ?, ?)`,
      [matchId, req.teamId, game_time || 0, oldValue, aggression_level]
    );

    res.json({
      message: '공격성향이 변경되었습니다',
      aggression_level
    });
  } catch (error: any) {
    console.error('Change aggression error:', error);
    res.status(500).json({ error: '공격성향 변경 실패' });
  }
});

// 경기 전술 변경 기록 조회
router.get('/match/:matchId/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const matchId = parseInt(req.params.matchId);

    const history = await pool.query(
      `SELECT mtc.*, t.name as team_name
       FROM match_tactic_changes mtc
       INNER JOIN teams t ON mtc.team_id = t.id
       WHERE mtc.match_id = ?
       ORDER BY mtc.game_time ASC`,
      [matchId]
    );

    res.json(history);
  } catch (error: any) {
    console.error('Get tactic history error:', error);
    res.status(500).json({ error: '전술 변경 기록 조회 실패' });
  }
});

export default router;
