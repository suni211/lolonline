import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 내 전술 목록 조회
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tactics = await pool.query(
      `SELECT * FROM team_tactics WHERE team_id = ? ORDER BY is_active DESC, created_at DESC`,
      [req.teamId]
    );
    res.json(tactics);
  } catch (error) {
    console.error('Get tactics error:', error);
    res.status(500).json({ error: '전술 목록 조회 실패' });
  }
});

// 전술 생성
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, description, early_game, mid_game, late_game, teamfight_style } = req.body;

    if (!name) {
      return res.status(400).json({ error: '전술 이름이 필요합니다' });
    }

    const result = await pool.query(
      `INSERT INTO team_tactics (team_id, name, description, early_game, mid_game, late_game, teamfight_style)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.teamId, name, description || '', early_game || 'balanced', mid_game || 'balanced', late_game || 'balanced', teamfight_style || 'engage']
    );

    // 포지션별 기본 전술 생성
    const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    for (const position of positions) {
      await pool.query(
        `INSERT INTO position_tactics (tactic_id, position, playstyle, priority)
         VALUES (?, ?, 'balanced', 'utility')`,
        [result.insertId, position]
      );
    }

    res.json({ id: result.insertId, message: '전술이 생성되었습니다' });
  } catch (error) {
    console.error('Create tactic error:', error);
    res.status(500).json({ error: '전술 생성 실패' });
  }
});

// 전술 상세 조회
router.get('/:tacticId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tacticId = parseInt(req.params.tacticId);

    const tactics = await pool.query(
      `SELECT * FROM team_tactics WHERE id = ? AND team_id = ?`,
      [tacticId, req.teamId]
    );

    if (tactics.length === 0) {
      return res.status(404).json({ error: '전술을 찾을 수 없습니다' });
    }

    res.json(tactics[0]);
  } catch (error) {
    console.error('Get tactic error:', error);
    res.status(500).json({ error: '전술 조회 실패' });
  }
});

// 포지션별 전술 조회
router.get('/:tacticId/positions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tacticId = parseInt(req.params.tacticId);

    // 전술 소유권 확인
    const tactics = await pool.query(
      `SELECT id FROM team_tactics WHERE id = ? AND team_id = ?`,
      [tacticId, req.teamId]
    );

    if (tactics.length === 0) {
      return res.status(404).json({ error: '전술을 찾을 수 없습니다' });
    }

    const positions = await pool.query(
      `SELECT position, playstyle, priority FROM position_tactics WHERE tactic_id = ?`,
      [tacticId]
    );

    res.json(positions);
  } catch (error) {
    console.error('Get position tactics error:', error);
    res.status(500).json({ error: '포지션 전술 조회 실패' });
  }
});

// 포지션별 전술 업데이트
router.put('/:tacticId/positions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tacticId = parseInt(req.params.tacticId);
    const { position, playstyle, priority } = req.body;

    // 전술 소유권 확인
    const tactics = await pool.query(
      `SELECT id FROM team_tactics WHERE id = ? AND team_id = ?`,
      [tacticId, req.teamId]
    );

    if (tactics.length === 0) {
      return res.status(404).json({ error: '전술을 찾을 수 없습니다' });
    }

    const updates = [];
    const params = [];

    if (playstyle) {
      updates.push('playstyle = ?');
      params.push(playstyle);
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }

    if (updates.length > 0) {
      await pool.query(
        `UPDATE position_tactics SET ${updates.join(', ')} WHERE tactic_id = ? AND position = ?`,
        [...params, tacticId, position]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update position tactic error:', error);
    res.status(500).json({ error: '포지션 전술 업데이트 실패' });
  }
});

// 전술 활성화
router.post('/:tacticId/activate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tacticId = parseInt(req.params.tacticId);

    // 전술 소유권 확인
    const tactics = await pool.query(
      `SELECT id FROM team_tactics WHERE id = ? AND team_id = ?`,
      [tacticId, req.teamId]
    );

    if (tactics.length === 0) {
      return res.status(404).json({ error: '전술을 찾을 수 없습니다' });
    }

    // 기존 활성 전술 비활성화
    await pool.query(
      `UPDATE team_tactics SET is_active = FALSE WHERE team_id = ?`,
      [req.teamId]
    );

    // 선택한 전술 활성화
    await pool.query(
      `UPDATE team_tactics SET is_active = TRUE WHERE id = ?`,
      [tacticId]
    );

    res.json({ success: true, message: '전술이 활성화되었습니다' });
  } catch (error) {
    console.error('Activate tactic error:', error);
    res.status(500).json({ error: '전술 활성화 실패' });
  }
});

// 전술 삭제
router.delete('/:tacticId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tacticId = parseInt(req.params.tacticId);

    // 전술 소유권 확인
    const tactics = await pool.query(
      `SELECT id FROM team_tactics WHERE id = ? AND team_id = ?`,
      [tacticId, req.teamId]
    );

    if (tactics.length === 0) {
      return res.status(404).json({ error: '전술을 찾을 수 없습니다' });
    }

    // position_tactics는 CASCADE로 자동 삭제됨
    await pool.query(`DELETE FROM team_tactics WHERE id = ?`, [tacticId]);

    res.json({ success: true, message: '전술이 삭제되었습니다' });
  } catch (error) {
    console.error('Delete tactic error:', error);
    res.status(500).json({ error: '전술 삭제 실패' });
  }
});

export default router;
