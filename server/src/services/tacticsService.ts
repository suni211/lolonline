import pool from '../database/db.js';

export class TacticsService {
  // 팀 전술 조회
  static async getTactics(teamId: number) {
    try {
      let tactics = await pool.query(
        `SELECT * FROM team_tactics WHERE team_id = ?`,
        [teamId]
      );

      // 전술이 없으면 기본값으로 생성
      if (tactics.length === 0) {
        await pool.query(
          `INSERT INTO team_tactics (team_id) VALUES (?)`,
          [teamId]
        );
        tactics = await pool.query(
          `SELECT * FROM team_tactics WHERE team_id = ?`,
          [teamId]
        );
      }

      return tactics[0];
    } catch (error) {
      console.error('Get tactics error:', error);
      throw error;
    }
  }

  // 전술 업데이트
  static async updateTactics(teamId: number, tacticsData: any) {
    try {
      const {
        aggression,
        teamfight_focus,
        objective_priority,
        vision_control,
        top_style,
        jungle_style,
        mid_style,
        adc_style,
        support_style,
        first_blood_priority,
        dragon_priority,
        baron_priority
      } = tacticsData;

      // 값 범위 검증 (1-100)
      const validateRange = (val: number) => Math.max(1, Math.min(100, val || 50));

      await pool.query(
        `UPDATE team_tactics SET
          aggression = ?,
          teamfight_focus = ?,
          objective_priority = ?,
          vision_control = ?,
          top_style = ?,
          jungle_style = ?,
          mid_style = ?,
          adc_style = ?,
          support_style = ?,
          first_blood_priority = ?,
          dragon_priority = ?,
          baron_priority = ?
         WHERE team_id = ?`,
        [
          validateRange(aggression),
          validateRange(teamfight_focus),
          validateRange(objective_priority),
          validateRange(vision_control),
          top_style || 'TANK',
          jungle_style || 'GANKER',
          mid_style || 'LANE',
          adc_style || 'LATE',
          support_style || 'ENGAGE',
          first_blood_priority || false,
          dragon_priority !== false,
          baron_priority !== false,
          teamId
        ]
      );

      return { success: true, message: '전술이 업데이트되었습니다' };
    } catch (error) {
      console.error('Update tactics error:', error);
      throw error;
    }
  }

  // 전술 효과 계산 (경기 시뮬레이션용)
  static async calculateTacticsEffect(teamId: number, opponentId: number) {
    try {
      const myTactics = await this.getTactics(teamId);
      const oppTactics = await this.getTactics(opponentId);

      let advantage = 0;

      // 공격성 vs 수비성 매치업
      // 공격적 팀이 수비적 팀 상대시 초반 유리
      if (myTactics.aggression > 70 && oppTactics.aggression < 30) {
        advantage += 5;
      } else if (myTactics.aggression < 30 && oppTactics.aggression > 70) {
        advantage -= 3; // 초반 불리하지만 후반 스케일
      }

      // 오브젝트 우선순위
      if (myTactics.objective_priority > oppTactics.objective_priority) {
        advantage += 2;
      }

      // 시야 장악
      if (myTactics.vision_control > oppTactics.vision_control) {
        advantage += 3;
      }

      // 라인별 스타일 상성
      // TOP: CARRY > TANK > SPLIT > CARRY
      const topMatchup = this.calculateStyleMatchup(
        myTactics.top_style, oppTactics.top_style,
        ['TANK', 'CARRY', 'SPLIT']
      );

      // JUNGLE: INVADER > FARMER > GANKER > INVADER
      const jungleMatchup = this.calculateStyleMatchup(
        myTactics.jungle_style, oppTactics.jungle_style,
        ['GANKER', 'INVADER', 'FARMER']
      );

      // MID: ASSASSIN > ROAM > LANE > ASSASSIN
      const midMatchup = this.calculateStyleMatchup(
        myTactics.mid_style, oppTactics.mid_style,
        ['ROAM', 'ASSASSIN', 'LANE']
      );

      advantage += topMatchup + jungleMatchup + midMatchup;

      // First Blood 우선순위 보너스
      if (myTactics.first_blood_priority && !oppTactics.first_blood_priority) {
        advantage += 2;
      }

      return {
        advantage,
        details: {
          aggressionDiff: myTactics.aggression - oppTactics.aggression,
          objectiveDiff: myTactics.objective_priority - oppTactics.objective_priority,
          visionDiff: myTactics.vision_control - oppTactics.vision_control,
          topMatchup,
          jungleMatchup,
          midMatchup
        }
      };
    } catch (error) {
      console.error('Calculate tactics effect error:', error);
      throw error;
    }
  }

  // 스타일 상성 계산
  private static calculateStyleMatchup(myStyle: string, oppStyle: string, cycle: string[]): number {
    const myIndex = cycle.indexOf(myStyle);
    const oppIndex = cycle.indexOf(oppStyle);

    if (myIndex === -1 || oppIndex === -1) return 0;

    // 가위바위보식 상성
    if ((myIndex + 1) % cycle.length === oppIndex) {
      return 2; // 유리
    } else if ((oppIndex + 1) % cycle.length === myIndex) {
      return -2; // 불리
    }
    return 0; // 동일 스타일
  }

  // 전술 프리셋
  static async applyPreset(teamId: number, presetName: string) {
    try {
      const presets: Record<string, any> = {
        'AGGRESSIVE': {
          aggression: 80,
          teamfight_focus: 70,
          objective_priority: 60,
          vision_control: 40,
          top_style: 'CARRY',
          jungle_style: 'INVADER',
          mid_style: 'ASSASSIN',
          adc_style: 'EARLY',
          support_style: 'ENGAGE',
          first_blood_priority: true,
          dragon_priority: true,
          baron_priority: true
        },
        'DEFENSIVE': {
          aggression: 20,
          teamfight_focus: 80,
          objective_priority: 70,
          vision_control: 80,
          top_style: 'TANK',
          jungle_style: 'FARMER',
          mid_style: 'LANE',
          adc_style: 'LATE',
          support_style: 'ENCHANTER',
          first_blood_priority: false,
          dragon_priority: true,
          baron_priority: true
        },
        'SPLITPUSH': {
          aggression: 50,
          teamfight_focus: 30,
          objective_priority: 80,
          vision_control: 70,
          top_style: 'SPLIT',
          jungle_style: 'FARMER',
          mid_style: 'ROAM',
          adc_style: 'UTILITY',
          support_style: 'ROAM',
          first_blood_priority: false,
          dragon_priority: false,
          baron_priority: true
        },
        'TEAMFIGHT': {
          aggression: 50,
          teamfight_focus: 90,
          objective_priority: 60,
          vision_control: 60,
          top_style: 'TANK',
          jungle_style: 'GANKER',
          mid_style: 'LANE',
          adc_style: 'LATE',
          support_style: 'ENGAGE',
          first_blood_priority: false,
          dragon_priority: true,
          baron_priority: true
        },
        'BALANCED': {
          aggression: 50,
          teamfight_focus: 50,
          objective_priority: 50,
          vision_control: 50,
          top_style: 'TANK',
          jungle_style: 'GANKER',
          mid_style: 'LANE',
          adc_style: 'LATE',
          support_style: 'ENGAGE',
          first_blood_priority: false,
          dragon_priority: true,
          baron_priority: true
        }
      };

      const preset = presets[presetName];
      if (!preset) {
        throw new Error('알 수 없는 프리셋입니다');
      }

      await this.updateTactics(teamId, preset);

      return {
        success: true,
        message: `${presetName} 전술 프리셋이 적용되었습니다`
      };
    } catch (error) {
      console.error('Apply preset error:', error);
      throw error;
    }
  }

  // 전술 추천
  static async recommendTactics(teamId: number) {
    try {
      // 팀 선수들의 스탯 분석
      const players = await pool.query(
        `SELECT position, mental, teamfight, focus, laning, overall
         FROM player_cards
         WHERE team_id = ? AND is_starter = true`,
        [teamId]
      );

      if (players.length < 5) {
        return { recommendation: 'BALANCED', reason: '선수가 부족합니다' };
      }

      // 평균 스탯 계산
      const avgStats = {
        mental: 0,
        teamfight: 0,
        focus: 0,
        laning: 0
      };

      for (const p of players) {
        avgStats.mental += p.mental;
        avgStats.teamfight += p.teamfight;
        avgStats.focus += p.focus;
        avgStats.laning += p.laning;
      }

      avgStats.mental /= players.length;
      avgStats.teamfight /= players.length;
      avgStats.focus /= players.length;
      avgStats.laning /= players.length;

      // 추천 전술 결정
      let recommendation = 'BALANCED';
      let reason = '';

      if (avgStats.teamfight > avgStats.laning + 10) {
        recommendation = 'TEAMFIGHT';
        reason = '팀파이트 스탯이 높습니다';
      } else if (avgStats.laning > avgStats.teamfight + 10) {
        recommendation = 'SPLITPUSH';
        reason = '라이닝 스탯이 높습니다';
      } else if (avgStats.mental > 80) {
        recommendation = 'AGGRESSIVE';
        reason = '멘탈 스탯이 높아 공격적 플레이에 유리합니다';
      } else if (avgStats.focus > 80) {
        recommendation = 'DEFENSIVE';
        reason = '집중력이 높아 수비적 플레이에 유리합니다';
      }

      return { recommendation, reason, avgStats };
    } catch (error) {
      console.error('Recommend tactics error:', error);
      throw error;
    }
  }
}

export default TacticsService;
