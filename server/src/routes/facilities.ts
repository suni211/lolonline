import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import cron from 'node-cron';

const router = express.Router();

// 내 시설 목록
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const facilities = await pool.query(
      'SELECT * FROM team_facilities WHERE team_id = ? ORDER BY facility_type',
      [req.teamId]
    );

    res.json(facilities);
  } catch (error: any) {
    console.error('Get facilities error:', error);
    res.status(500).json({ error: 'Failed to get facilities' });
  }
});

// 시설 업그레이드
router.post('/:facilityType/upgrade', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const facilityType = req.params.facilityType;
    const validTypes = ['TRAINING', 'MEDICAL', 'SCOUTING', 'STADIUM', 'MERCHANDISE', 'RESTAURANT', 'ACCOMMODATION', 'MEDIA', 'GAMING_HOUSE', 'BROADCAST_STUDIO', 'FAN_ZONE', 'ANALYTICS_CENTER'];

    if (!validTypes.includes(facilityType)) {
      return res.status(400).json({ error: 'Invalid facility type' });
    }

    const facilities = await pool.query(
      'SELECT * FROM team_facilities WHERE team_id = ? AND facility_type = ?',
      [req.teamId, facilityType]
    );

    let currentLevel = 0;
    if (facilities.length > 0) {
      currentLevel = facilities[0].level;
    }

    if (currentLevel >= 10) {
      return res.status(400).json({ error: 'Facility is already at maximum level' });
    }

    // 업그레이드 비용 계산 (기본 500만 * 2^레벨, 기하급수적 증가)
    const upgradeCost = 5000000 * Math.pow(2, currentLevel);

    // 골드 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0 || teams[0].gold < upgradeCost) {
      return res.status(400).json({ error: 'Insufficient gold' });
    }

    // 골드 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [upgradeCost, req.teamId]);

    // 시설 업그레이드 또는 생성
    if (facilities.length > 0) {
      const newLevel = currentLevel + 1;
      const revenuePerHour = calculateRevenuePerHour(facilityType, newLevel);
      const maintenanceCost = calculateMaintenanceCost(facilityType, newLevel);

      await pool.query(
        `UPDATE team_facilities 
         SET level = ?, revenue_per_hour = ?, maintenance_cost = ? 
         WHERE team_id = ? AND facility_type = ?`,
        [newLevel, revenuePerHour, maintenanceCost, req.teamId, facilityType]
      );
    } else {
      const revenuePerHour = calculateRevenuePerHour(facilityType, 1);
      const maintenanceCost = calculateMaintenanceCost(facilityType, 1);

      await pool.query(
        `INSERT INTO team_facilities (team_id, facility_type, level, revenue_per_hour, maintenance_cost) 
         VALUES (?, ?, 1, ?, ?)`,
        [req.teamId, facilityType, revenuePerHour, maintenanceCost]
      );
    }

    res.json({ message: 'Facility upgraded successfully' });
  } catch (error: any) {
    console.error('Upgrade facility error:', error);
    res.status(500).json({ error: 'Failed to upgrade facility' });
  }
});

// 수익 계산 함수
function calculateRevenuePerHour(facilityType: string, level: number): number {
  const baseRevenue: Record<string, number> = {
    'STADIUM': 5000,
    'MERCHANDISE': 3000,
    'RESTAURANT': 2000,
    'ACCOMMODATION': 1500,
    'MEDIA': 1000,
    'GAMING_HOUSE': 0,
    'BROADCAST_STUDIO': 4000,
    'FAN_ZONE': 2500,
    'ANALYTICS_CENTER': 0,
    'TRAINING': 0,
    'MEDICAL': 0,
    'SCOUTING': 0
  };

  return (baseRevenue[facilityType] || 0) * level;
}

function calculateMaintenanceCost(facilityType: string, level: number): number {
  const baseCost: Record<string, number> = {
    'STADIUM': 10000,
    'MERCHANDISE': 5000,
    'RESTAURANT': 4000,
    'ACCOMMODATION': 3000,
    'MEDIA': 2000,
    'GAMING_HOUSE': 5000,
    'BROADCAST_STUDIO': 7500,
    'FAN_ZONE': 6000,
    'ANALYTICS_CENTER': 4000,
    'TRAINING': 2500,
    'MEDICAL': 1500,
    'SCOUTING': 1000
  };

  return (baseCost[facilityType] || 0) * level;
}

// 시설 수익 자동 수집 (매 시간마다)
export function initializeFacilityRevenue() {
  cron.schedule('0 * * * *', async () => {
    await collectFacilityRevenue();
  });

  console.log('Facility revenue system initialized');
}

async function collectFacilityRevenue() {
  try {
    const facilities = await pool.query(
      'SELECT * FROM team_facilities WHERE revenue_per_hour > 0'
    );

    for (const facility of facilities) {
      const revenue = facility.revenue_per_hour;
      const maintenance = facility.maintenance_cost || 0;
      const netRevenue = revenue - maintenance;

      if (netRevenue > 0) {
        await pool.query(
          'UPDATE teams SET gold = gold + ? WHERE id = ?',
          [netRevenue, facility.team_id]
        );
      } else if (netRevenue < 0) {
        // 유지비가 수익보다 많으면 차감
        await pool.query(
          'UPDATE teams SET gold = GREATEST(0, gold - ?) WHERE id = ?',
          [Math.abs(netRevenue), facility.team_id]
        );
      }
    }
  } catch (error) {
    console.error('Error collecting facility revenue:', error);
  }
}

export default router;

