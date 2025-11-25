import pool from '../database/db.js';

export class MentalService {
  // 선수 멘탈 상태 조회
  static async getPlayerMental(playerCardId: number) {
    try {
      let mental = await pool.query(
        `SELECT * FROM player_mental_states WHERE player_card_id = ?`,
        [playerCardId]
      );

      // 멘탈 상태가 없으면 기본값으로 생성
      if (mental.length === 0) {
        await pool.query(
          `INSERT INTO player_mental_states (player_card_id, morale, stress, confidence, team_satisfaction)
           VALUES (?, 70, 30, 50, 70)`,
          [playerCardId]
        );
        mental = await pool.query(
          `SELECT * FROM player_mental_states WHERE player_card_id = ?`,
          [playerCardId]
        );
      }

      return mental[0];
    } catch (error) {
      console.error('Get player mental error:', error);
      throw error;
    }
  }

  // 팀 전체 멘탈 상태 조회
  static async getTeamMental(teamId: number) {
    try {
      const players = await pool.query(
        `SELECT pc.id as player_card_id, COALESCE(pp.name, pc.ai_player_name) as name, COALESCE(pp.position, pc.ai_position) as position,
                pms.morale, pms.stress, pms.confidence, pms.team_satisfaction
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         LEFT JOIN player_mental_states pms ON pc.id = pms.player_card_id
         WHERE pc.team_id = ?`,
        [teamId]
      );

      // 멘탈 상태가 없는 선수들에게 기본값 생성
      for (const player of players) {
        if (!player.morale) {
          await pool.query(
            `INSERT INTO player_mental_states (player_card_id, morale, stress, confidence, team_satisfaction)
             VALUES (?, 70, 30, 50, 70)
             ON DUPLICATE KEY UPDATE player_card_id = player_card_id`,
            [player.player_card_id]
          );
        }
      }

      // 다시 조회
      const updatedPlayers = await pool.query(
        `SELECT pc.id as player_card_id, COALESCE(pp.name, pc.ai_player_name) as name, COALESCE(pp.position, pc.ai_position) as position,
                pms.morale, pms.stress, pms.confidence, pms.team_satisfaction
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         LEFT JOIN player_mental_states pms ON pc.id = pms.player_card_id
         WHERE pc.team_id = ?`,
        [teamId]
      );

      // 평균 계산
      const avg = {
        morale: 0,
        stress: 0,
        confidence: 0,
        team_satisfaction: 0
      };

      for (const p of updatedPlayers) {
        avg.morale += p.morale || 70;
        avg.stress += p.stress || 30;
        avg.confidence += p.confidence || 50;
        avg.team_satisfaction += p.team_satisfaction || 70;
      }

      const count = updatedPlayers.length || 1;
      avg.morale = Math.round(avg.morale / count);
      avg.stress = Math.round(avg.stress / count);
      avg.confidence = Math.round(avg.confidence / count);
      avg.team_satisfaction = Math.round(avg.team_satisfaction / count);

      return {
        players: updatedPlayers,
        average: avg
      };
    } catch (error) {
      console.error('Get team mental error:', error);
      throw error;
    }
  }

  // 멘탈 상태 업데이트
  static async updateMental(playerCardId: number, changes: {
    morale?: number;
    stress?: number;
    confidence?: number;
    team_satisfaction?: number;
  }) {
    try {
      await this.getPlayerMental(playerCardId); // 존재 확인

      const updates: string[] = [];
      const values: number[] = [];

      if (changes.morale !== undefined) {
        updates.push('morale = GREATEST(0, LEAST(100, morale + ?))');
        values.push(changes.morale);
      }
      if (changes.stress !== undefined) {
        updates.push('stress = GREATEST(0, LEAST(100, stress + ?))');
        values.push(changes.stress);
      }
      if (changes.confidence !== undefined) {
        updates.push('confidence = GREATEST(0, LEAST(100, confidence + ?))');
        values.push(changes.confidence);
      }
      if (changes.team_satisfaction !== undefined) {
        updates.push('team_satisfaction = GREATEST(0, LEAST(100, team_satisfaction + ?))');
        values.push(changes.team_satisfaction);
      }

      if (updates.length > 0) {
        values.push(playerCardId);
        await pool.query(
          `UPDATE player_mental_states SET ${updates.join(', ')} WHERE player_card_id = ?`,
          values
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Update mental error:', error);
      throw error;
    }
  }

  // 선수 관계 조회
  static async getPlayerRelationships(playerCardId: number) {
    try {
      const relationships = await pool.query(
        `SELECT pr.*, COALESCE(pp.name, pc.ai_player_name) as partner_name
         FROM player_relationships pr
         JOIN player_cards pc ON (pr.player2_id = pc.id)
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pr.player1_id = ?
         UNION
         SELECT pr.*, COALESCE(pp.name, pc.ai_player_name) as partner_name
         FROM player_relationships pr
         JOIN player_cards pc ON (pr.player1_id = pc.id)
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pr.player2_id = ?`,
        [playerCardId, playerCardId]
      );

      return relationships;
    } catch (error) {
      console.error('Get player relationships error:', error);
      throw error;
    }
  }

  // 관계 업데이트/생성
  static async updateRelationship(
    player1Id: number,
    player2Id: number,
    teamId: number,
    valueChange: number
  ) {
    try {
      // ID 정렬 (항상 작은 ID가 player1)
      const [p1, p2] = player1Id < player2Id ? [player1Id, player2Id] : [player2Id, player1Id];

      // 기존 관계 확인
      let relationship = await pool.query(
        `SELECT * FROM player_relationships WHERE player1_id = ? AND player2_id = ?`,
        [p1, p2]
      );

      if (relationship.length === 0) {
        // 새 관계 생성
        await pool.query(
          `INSERT INTO player_relationships (player1_id, player2_id, team_id, relationship_type, relationship_value)
           VALUES (?, ?, ?, 'NEUTRAL', 50)`,
          [p1, p2, teamId]
        );
        relationship = await pool.query(
          `SELECT * FROM player_relationships WHERE player1_id = ? AND player2_id = ?`,
          [p1, p2]
        );
      }

      // 값 업데이트
      const newValue = Math.max(0, Math.min(100, relationship[0].relationship_value + valueChange));

      // 관계 타입 결정
      let relationshipType = 'NEUTRAL';
      if (newValue >= 80) relationshipType = 'FRIEND';
      else if (newValue >= 60) relationshipType = 'NEUTRAL';
      else if (newValue >= 30) relationshipType = 'RIVAL';
      else relationshipType = 'CONFLICT';

      await pool.query(
        `UPDATE player_relationships SET relationship_value = ?, relationship_type = ?
         WHERE player1_id = ? AND player2_id = ?`,
        [newValue, relationshipType, p1, p2]
      );

      return {
        success: true,
        newValue,
        relationshipType
      };
    } catch (error) {
      console.error('Update relationship error:', error);
      throw error;
    }
  }

  // 경기 후 멘탈 처리
  static async processMatchMental(teamId: number, won: boolean, mvpPlayerCardId?: number) {
    try {
      const players = await pool.query(
        `SELECT id FROM player_cards WHERE team_id = ? AND is_starter = true`,
        [teamId]
      );

      for (const player of players) {
        const isMvp = player.id === mvpPlayerCardId;

        if (won) {
          // 승리시
          await this.updateMental(player.id, {
            morale: 5 + (isMvp ? 5 : 0),
            stress: -3,
            confidence: 3 + (isMvp ? 3 : 0),
            team_satisfaction: 2
          });
        } else {
          // 패배시
          await this.updateMental(player.id, {
            morale: -3,
            stress: 5,
            confidence: -2,
            team_satisfaction: -1
          });
        }
      }

      // 승리시 선수 간 관계 개선
      if (won && players.length >= 2) {
        for (let i = 0; i < players.length; i++) {
          for (let j = i + 1; j < players.length; j++) {
            await this.updateRelationship(players[i].id, players[j].id, teamId, 1);
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Process match mental error:', error);
      throw error;
    }
  }

  // 멘탈 케어 (휴식)
  static async mentalCare(teamId: number, playerCardId: number, careType: 'REST' | 'COUNSELING' | 'VACATION') {
    try {
      const costs: Record<string, number> = {
        'REST': 0,
        'COUNSELING': 500000,
        'VACATION': 2000000
      };

      const effects: Record<string, any> = {
        'REST': { morale: 5, stress: -10 },
        'COUNSELING': { morale: 10, stress: -15, confidence: 5 },
        'VACATION': { morale: 20, stress: -30, confidence: 10, team_satisfaction: 10 }
      };

      const cost = costs[careType];
      const effect = effects[careType];

      if (cost > 0) {
        // 골드 확인
        const team = await pool.query('SELECT gold FROM teams WHERE id = ?', [teamId]);
        if (team.length === 0 || team[0].gold < cost) {
          throw new Error('골드가 부족합니다');
        }

        // 골드 차감
        await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [cost, teamId]);

        // 재정 기록
        await pool.query(
          `INSERT INTO financial_records (team_id, record_type, category, amount, description)
           VALUES (?, 'EXPENSE', 'OTHER', ?, ?)`,
          [teamId, cost, `멘탈 케어: ${careType}`]
        );
      }

      // 멘탈 업데이트
      await this.updateMental(playerCardId, effect);

      return {
        success: true,
        cost,
        effect,
        message: '멘탈 케어가 완료되었습니다'
      };
    } catch (error) {
      console.error('Mental care error:', error);
      throw error;
    }
  }

  // 팀 케미스트리 계산
  static async calculateTeamChemistry(teamId: number) {
    try {
      const players = await pool.query(
        `SELECT id FROM player_cards WHERE team_id = ? AND is_starter = true`,
        [teamId]
      );

      if (players.length < 2) {
        return { chemistry: 50, details: [] };
      }

      let totalValue = 0;
      let relationshipCount = 0;
      const details = [];

      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const [p1, p2] = [players[i].id, players[j].id].sort((a, b) => a - b);

          const rel = await pool.query(
            `SELECT relationship_value, relationship_type FROM player_relationships
             WHERE player1_id = ? AND player2_id = ?`,
            [p1, p2]
          );

          const value = rel.length > 0 ? rel[0].relationship_value : 50;
          totalValue += value;
          relationshipCount++;

          if (rel.length > 0) {
            details.push({
              player1: p1,
              player2: p2,
              value,
              type: rel[0].relationship_type
            });
          }
        }
      }

      const chemistry = relationshipCount > 0
        ? Math.round(totalValue / relationshipCount)
        : 50;

      return { chemistry, details };
    } catch (error) {
      console.error('Calculate team chemistry error:', error);
      throw error;
    }
  }
}

export default MentalService;
