import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// 연봉협상 제안 생성
router.post('/:playerId/propose', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { annual_salary, contract_years, signing_bonus } = req.body;

    if (!annual_salary || !contract_years) {
      return res.status(400).json({ error: '연봉과 계약 기간을 입력해주세요' });
    }

    if (contract_years < 1 || contract_years > 5) {
      return res.status(400).json({ error: '계약 기간은 1~5년 사이여야 합니다' });
    }

    // 선수 확인
    const players = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) {
      return res.status(404).json({ error: '선수를 찾을 수 없습니다' });
    }

    const player = players[0];

    // 이미 소유한 선수인지 확인
    const ownership = await pool.query(
      'SELECT * FROM player_ownership WHERE player_id = ? AND team_id = ?',
      [playerId, req.teamId]
    );

    if (ownership.length > 0) {
      return res.status(400).json({ error: '이미 소유한 선수입니다' });
    }

    // 최대 보유 수 확인 (23명)
    const playerCount = await pool.query(
      'SELECT COUNT(*) as count FROM player_ownership WHERE team_id = ?',
      [req.teamId]
    );

    if (playerCount[0].count >= 23) {
      return res.status(400).json({ error: '최대 보유 선수 수에 도달했습니다 (23명)' });
    }

    // 기존 협상 확인 (진행 중인 협상이 있으면 거부)
    const existingNegotiation = await pool.query(
      `SELECT * FROM contract_negotiations 
       WHERE player_id = ? AND team_id = ? 
       AND status IN ('PENDING', 'COUNTER_OFFER')`,
      [playerId, req.teamId]
    );

    if (existingNegotiation.length > 0) {
      return res.status(400).json({ error: '이미 진행 중인 협상이 있습니다' });
    }

    // 팀 재화 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    if (teams.length === 0) {
      return res.status(404).json({ error: '팀을 찾을 수 없습니다' });
    }

    const totalCost = annual_salary * contract_years + (signing_bonus || 0);
    if (teams[0].gold < totalCost) {
      return res.status(400).json({ error: '보유 골드가 부족합니다' });
    }

    // 협상 제안 생성
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24시간 후 만료

    const result = await pool.query(
      `INSERT INTO contract_negotiations 
       (player_id, team_id, annual_salary, contract_years, signing_bonus, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [playerId, req.teamId, annual_salary, contract_years, signing_bonus || 0, expiresAt]
    );

    // AI 응답 생성 (비동기로 처리)
    setTimeout(async () => {
      await generateAIResponse(playerId, req.teamId, result.insertId, annual_salary, contract_years, signing_bonus || 0, player);
    }, 1000);

    res.json({ 
      negotiation_id: result.insertId,
      message: '협상 제안이 전송되었습니다. AI가 곧 응답할 예정입니다.' 
    });
  } catch (error: any) {
    console.error('Propose contract error:', error);
    res.status(500).json({ error: '협상 제안 생성에 실패했습니다' });
  }
});

// AI 응답 생성 함수
async function generateAIResponse(
  playerId: number, 
  teamId: number, 
  negotiationId: number,
  proposedSalary: number,
  proposedYears: number,
  proposedBonus: number,
  player: any
) {
  try {
    // 선수 오버롤 계산
    const overall = player.mental + player.teamfight + player.focus + player.laning;
    
    // 기준 연봉 계산 (오버롤 * 1000)
    const baseSalary = overall * 1000;
    
    // 만족도에 따른 가중치 (50% = 1.0, 100% = 1.5, 0% = 0.5)
    const satisfactionMultiplier = 0.5 + (player.satisfaction / 100);
    
    // 최소 수락 연봉 계산
    const minAcceptableSalary = Math.floor(baseSalary * satisfactionMultiplier * 0.8);
    const idealSalary = Math.floor(baseSalary * satisfactionMultiplier * 1.2);
    
    // 제안 평가
    const salaryRatio = proposedSalary / baseSalary;
    const isGoodOffer = proposedSalary >= minAcceptableSalary;
    const isExcellentOffer = proposedSalary >= idealSalary;
    
    // 랜덤 요소 추가 (AI 성향)
    const aiPersonality = Math.random(); // 0~1 사이 랜덤 값
    
    let responseType: 'ACCEPT' | 'REJECT' | 'COUNTER';
    let counterSalary = 0;
    let counterYears = proposedYears;
    let counterBonus = proposedBonus;
    
    if (isExcellentOffer && aiPersonality > 0.2) {
      // 매우 좋은 제안이면 높은 확률로 수락
      responseType = 'ACCEPT';
    } else if (isGoodOffer && aiPersonality > 0.4) {
      // 좋은 제안이면 중간 확률로 수락
      responseType = 'ACCEPT';
    } else if (proposedSalary < minAcceptableSalary * 0.7) {
      // 너무 낮은 제안이면 거절
      responseType = 'REJECT';
    } else {
      // 카운터 오퍼
      responseType = 'COUNTER';
      
      // 카운터 연봉 계산 (최소 수락 연봉과 이상 연봉 사이)
      counterSalary = Math.floor(
        minAcceptableSalary + (idealSalary - minAcceptableSalary) * (0.7 + Math.random() * 0.3)
      );
      
      // 계약 기간 조정 (1~5년)
      if (proposedYears < 2) {
        counterYears = Math.min(proposedYears + 1, 5);
      } else if (proposedYears > 3) {
        counterYears = Math.max(proposedYears - 1, 1);
      }
      
      // 보너스 조정
      if (proposedBonus < baseSalary * 0.1) {
        counterBonus = Math.floor(baseSalary * (0.1 + Math.random() * 0.1));
      }
    }
    
    // AI 응답 저장
    if (responseType === 'ACCEPT') {
      await pool.query(
        `UPDATE contract_negotiations 
         SET status = 'ACCEPTED', 
             ai_response_type = 'ACCEPT',
             responded_at = NOW()
         WHERE id = ?`,
        [negotiationId]
      );
    } else if (responseType === 'REJECT') {
      await pool.query(
        `UPDATE contract_negotiations 
         SET status = 'REJECTED', 
             ai_response_type = 'REJECT',
             responded_at = NOW()
         WHERE id = ?`,
        [negotiationId]
      );
    } else {
      // COUNTER
      await pool.query(
        `UPDATE contract_negotiations 
         SET status = 'COUNTER_OFFER', 
             ai_response_type = 'COUNTER',
             ai_counter_salary = ?,
             ai_counter_years = ?,
             ai_counter_bonus = ?,
             responded_at = NOW()
         WHERE id = ?`,
        [counterSalary, counterYears, counterBonus, negotiationId]
      );
    }
  } catch (error: any) {
    console.error('Generate AI response error:', error);
  }
}

// 협상 상태 조회
router.get('/:playerId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const playerId = parseInt(req.params.playerId);
    
    const negotiations = await pool.query(
      `SELECT * FROM contract_negotiations 
       WHERE player_id = ? AND team_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [playerId, req.teamId]
    );
    
    if (negotiations.length === 0) {
      return res.status(404).json({ error: '협상을 찾을 수 없습니다' });
    }
    
    res.json(negotiations[0]);
  } catch (error: any) {
    console.error('Get negotiation error:', error);
    res.status(500).json({ error: '협상 조회에 실패했습니다' });
  }
});

// 카운터 오퍼 수락
router.post('/:negotiationId/accept-counter', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const negotiationId = parseInt(req.params.negotiationId);
    
    const negotiations = await pool.query(
      'SELECT * FROM contract_negotiations WHERE id = ? AND team_id = ?',
      [negotiationId, req.teamId]
    );
    
    if (negotiations.length === 0) {
      return res.status(404).json({ error: '협상을 찾을 수 없습니다' });
    }
    
    const negotiation = negotiations[0];
    
    if (negotiation.status !== 'COUNTER_OFFER') {
      return res.status(400).json({ error: '카운터 오퍼가 아닙니다' });
    }
    
    // 재화 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    const totalCost = negotiation.ai_counter_salary * negotiation.ai_counter_years + negotiation.ai_counter_bonus;
    
    if (teams[0].gold < totalCost) {
      return res.status(400).json({ error: '보유 골드가 부족합니다' });
    }
    
    // 재화 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [totalCost, req.teamId]);
    
    // 협상 상태 업데이트
    await pool.query(
      `UPDATE contract_negotiations SET status = 'ACCEPTED', responded_at = NOW() WHERE id = ?`,
      [negotiationId]
    );
    
    // 선수 소유권 추가
    await pool.query(
      `INSERT INTO player_ownership (player_id, team_id, is_benched) VALUES (?, ?, true)`,
      [negotiation.player_id, req.teamId]
    );
    
    // 선수 계약 정보 업데이트
    const contractExpiresAt = new Date();
    contractExpiresAt.setFullYear(contractExpiresAt.getFullYear() + negotiation.ai_counter_years);
    
    await pool.query(
      `UPDATE players 
       SET contract_fee = ?, 
           contract_expires_at = ? 
       WHERE id = ?`,
      [negotiation.ai_counter_salary, contractExpiresAt, negotiation.player_id]
    );
    
    res.json({ message: '계약이 성사되었습니다!' });
  } catch (error: any) {
    console.error('Accept counter offer error:', error);
    res.status(500).json({ error: '계약 수락에 실패했습니다' });
  }
});

// 제안 수락 (AI가 수락한 경우)
router.post('/:negotiationId/accept', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const negotiationId = parseInt(req.params.negotiationId);
    
    const negotiations = await pool.query(
      'SELECT * FROM contract_negotiations WHERE id = ? AND team_id = ?',
      [negotiationId, req.teamId]
    );
    
    if (negotiations.length === 0) {
      return res.status(404).json({ error: '협상을 찾을 수 없습니다' });
    }
    
    const negotiation = negotiations[0];
    
    if (negotiation.status !== 'ACCEPTED') {
      return res.status(400).json({ error: '수락 가능한 상태가 아닙니다' });
    }
    
    // 재화 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    const totalCost = negotiation.annual_salary * negotiation.contract_years + negotiation.signing_bonus;
    
    if (teams[0].gold < totalCost) {
      return res.status(400).json({ error: '보유 골드가 부족합니다' });
    }
    
    // 재화 차감
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [totalCost, req.teamId]);
    
    // 선수 소유권 추가
    await pool.query(
      `INSERT INTO player_ownership (player_id, team_id, is_benched) VALUES (?, ?, true)`,
      [negotiation.player_id, req.teamId]
    );
    
    // 선수 계약 정보 업데이트
    const contractExpiresAt = new Date();
    contractExpiresAt.setFullYear(contractExpiresAt.getFullYear() + negotiation.contract_years);
    
    await pool.query(
      `UPDATE players 
       SET contract_fee = ?, 
           contract_expires_at = ? 
       WHERE id = ?`,
      [negotiation.annual_salary, contractExpiresAt, negotiation.player_id]
    );
    
    res.json({ message: '계약이 성사되었습니다!' });
  } catch (error: any) {
    console.error('Accept negotiation error:', error);
    res.status(500).json({ error: '계약 수락에 실패했습니다' });
  }
});

// 협상 거절
router.post('/:negotiationId/reject', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const negotiationId = parseInt(req.params.negotiationId);
    
    await pool.query(
      `UPDATE contract_negotiations SET status = 'REJECTED', responded_at = NOW() WHERE id = ? AND team_id = ?`,
      [negotiationId, req.teamId]
    );
    
    res.json({ message: '협상을 거절했습니다' });
  } catch (error: any) {
    console.error('Reject negotiation error:', error);
    res.status(500).json({ error: '협상 거절에 실패했습니다' });
  }
});

// 새로운 제안 (카운터 오퍼에 대한 재제안)
router.post('/:negotiationId/counter', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const negotiationId = parseInt(req.params.negotiationId);
    const { annual_salary, contract_years, signing_bonus } = req.body;
    
    const negotiations = await pool.query(
      'SELECT * FROM contract_negotiations WHERE id = ? AND team_id = ?',
      [negotiationId, req.teamId]
    );
    
    if (negotiations.length === 0) {
      return res.status(404).json({ error: '협상을 찾을 수 없습니다' });
    }
    
    const negotiation = negotiations[0];
    
    if (negotiation.status !== 'COUNTER_OFFER') {
      return res.status(400).json({ error: '카운터 오퍼 상태가 아닙니다' });
    }
    
    // 재화 확인
    const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [req.teamId]);
    const totalCost = annual_salary * contract_years + (signing_bonus || 0);
    
    if (teams[0].gold < totalCost) {
      return res.status(400).json({ error: '보유 골드가 부족합니다' });
    }
    
    // 새로운 협상 생성
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const result = await pool.query(
      `INSERT INTO contract_negotiations 
       (player_id, team_id, annual_salary, contract_years, signing_bonus, expires_at, negotiation_round) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [negotiation.player_id, req.teamId, annual_salary, contract_years, signing_bonus || 0, expiresAt, negotiation.negotiation_round + 1]
    );
    
    // 이전 협상 종료
    await pool.query(
      `UPDATE contract_negotiations SET status = 'REJECTED' WHERE id = ?`,
      [negotiationId]
    );
    
    // AI 응답 생성
    const players = await pool.query('SELECT * FROM players WHERE id = ?', [negotiation.player_id]);
    setTimeout(async () => {
      await generateAIResponse(
        negotiation.player_id, 
        req.teamId, 
        result.insertId, 
        annual_salary, 
        contract_years, 
        signing_bonus || 0, 
        players[0]
      );
    }, 1000);
    
    res.json({ 
      negotiation_id: result.insertId,
      message: '재제안이 전송되었습니다. AI가 곧 응답할 예정입니다.' 
    });
  } catch (error: any) {
    console.error('Counter offer error:', error);
    res.status(500).json({ error: '재제안에 실패했습니다' });
  }
});

export default router;

