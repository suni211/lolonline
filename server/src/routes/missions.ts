import express from 'express';
import pool from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 미션 목록
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { mission_type } = req.query;

    let query = `
      SELECT m.*, 
             mp.progress, mp.completed, mp.completed_at
      FROM missions m
      LEFT JOIN mission_progress mp ON m.id = mp.mission_id AND mp.team_id = ?
      WHERE 1=1
    `;

    const params: any[] = [req.teamId];

    if (mission_type) {
      query += ' AND m.mission_type = ?';
      params.push(mission_type);
    }

    query += ' ORDER BY m.mission_type, m.id';

    const missions = await pool.query(query, params);

    res.json(missions);
  } catch (error: any) {
    console.error('Get missions error:', error);
    res.status(500).json({ error: 'Failed to get missions' });
  }
});

// 미션 보상 수령
router.post('/:missionId/claim', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const missionId = parseInt(req.params.missionId);

    const missions = await pool.query('SELECT * FROM missions WHERE id = ?', [missionId]);
    if (missions.length === 0) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const mission = missions[0];

    // 미션 진행 확인
    const progress = await pool.query(
      'SELECT * FROM mission_progress WHERE mission_id = ? AND team_id = ?',
      [missionId, req.teamId]
    );

    if (progress.length === 0 || !progress[0].completed) {
      return res.status(400).json({ error: 'Mission not completed' });
    }

    if (progress[0].completed_at) {
      return res.status(400).json({ error: 'Reward already claimed' });
    }

    // 보상 지급
    if (mission.reward_gold > 0) {
      await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [mission.reward_gold, req.teamId]);
    }

    if (mission.reward_diamond > 0) {
      await pool.query('UPDATE teams SET diamond = diamond + ? WHERE id = ?', [mission.reward_diamond, req.teamId]);
    }

    // 완료 시간 업데이트
    await pool.query(
      'UPDATE mission_progress SET completed_at = NOW() WHERE mission_id = ? AND team_id = ?',
      [missionId, req.teamId]
    );

    res.json({ message: 'Reward claimed successfully' });
  } catch (error: any) {
    console.error('Claim mission error:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
});

// 출석 보상
router.get('/attendance', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 오늘 출석 확인
    const attendance = await pool.query(
      'SELECT * FROM attendance_logs WHERE team_id = ? AND attendance_date = ?',
      [req.teamId, today]
    );

    if (attendance.length > 0) {
      return res.json({ already_claimed: true, day: attendance[0].consecutive_days });
    }

    // 연속 출석 일수 계산
    const lastAttendance = await pool.query(
      'SELECT * FROM attendance_logs WHERE team_id = ? ORDER BY attendance_date DESC LIMIT 1',
      [req.teamId]
    );

    let consecutiveDays = 1;
    if (lastAttendance.length > 0) {
      const lastDate = new Date(lastAttendance[0].attendance_date);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        consecutiveDays = lastAttendance[0].consecutive_days + 1;
      }
    }

    // 출석 기록
    await pool.query(
      'INSERT INTO attendance_logs (team_id, attendance_date, consecutive_days) VALUES (?, ?, ?)',
      [req.teamId, today, consecutiveDays]
    );

    // 보상 계산 (연속 일수에 따라 증가)
    const rewardGold = consecutiveDays * 1000;
    const rewardDiamond = Math.floor(consecutiveDays / 7); // 7일마다 다이아몬드

    // 보상 지급
    await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [rewardGold, req.teamId]);
    if (rewardDiamond > 0) {
      await pool.query('UPDATE teams SET diamond = diamond + ? WHERE id = ?', [rewardDiamond, req.teamId]);
    }

    // 출석 보상 기록
    await pool.query(
      `INSERT INTO attendance_rewards (team_id, day, reward_gold, reward_diamond)
       VALUES (?, ?, ?, ?)`,
      [req.teamId, consecutiveDays, rewardGold, rewardDiamond]
    );

    res.json({
      day: consecutiveDays,
      reward_gold: rewardGold,
      reward_diamond: rewardDiamond,
      message: 'Attendance reward claimed'
    });
  } catch (error: any) {
    console.error('Attendance error:', error);
    res.status(500).json({ error: 'Failed to claim attendance reward' });
  }
});

export default router;

