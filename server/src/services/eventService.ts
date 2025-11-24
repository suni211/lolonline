import pool from '../database/db.js';

interface Player {
  id: number;
  name: string;
  personality: string;
  is_starter: boolean;
  overall: number;
  player_condition: number;
}

interface EventTemplate {
  type: string;
  title: string;
  description: string;
  effectType: string;
  effectValue: number;
  requiresSecondPlayer: boolean;
}

// 성격별 이벤트 발생 확률 및 유형
const personalityEventWeights: { [key: string]: { [key: string]: number } } = {
  LEADER: { TEAMBUILDING: 30, CELEBRATION: 25, INTERVIEW: 20, BONUS: 15, CONFLICT: 10 },
  LONER: { CONFLICT: 30, SCANDAL: 25, INJURY: 20, BONUS: 15, INTERVIEW: 10 },
  TEAMPLAYER: { TEAMBUILDING: 35, CELEBRATION: 30, BONUS: 20, INTERVIEW: 10, CONFLICT: 5 },
  HOTHEAD: { CONFLICT: 40, SCANDAL: 30, INJURY: 15, CELEBRATION: 10, BONUS: 5 },
  CALM: { BONUS: 30, TEAMBUILDING: 25, CELEBRATION: 20, INTERVIEW: 15, CONFLICT: 10 },
  GREEDY: { SCANDAL: 30, CONFLICT: 25, BONUS: 20, INTERVIEW: 15, CELEBRATION: 10 },
  HUMBLE: { TEAMBUILDING: 30, CELEBRATION: 25, BONUS: 25, INTERVIEW: 15, CONFLICT: 5 },
  PRANKSTER: { PRANK: 40, CELEBRATION: 25, TEAMBUILDING: 20, CONFLICT: 10, SCANDAL: 5 }
};

// 이벤트 템플릿
const eventTemplates: { [key: string]: EventTemplate[] } = {
  CONFLICT: [
    { type: 'CONFLICT', title: '{player1}와 {player2} 사이에 갈등 발생', description: '팀 내 의견 충돌로 분위기가 험악해졌습니다.', effectType: 'MORALE', effectValue: -10, requiresSecondPlayer: true },
    { type: 'CONFLICT', title: '{player1}이(가) 감독과 마찰', description: '훈련 방식에 대해 불만을 표출했습니다.', effectType: 'CONDITION', effectValue: -15, requiresSecondPlayer: false },
    { type: 'CONFLICT', title: '{player1}이(가) 팀 미팅에서 폭발', description: '누적된 스트레스로 큰소리가 났습니다.', effectType: 'MORALE', effectValue: -20, requiresSecondPlayer: false }
  ],
  CELEBRATION: [
    { type: 'CELEBRATION', title: '{player1} 생일 파티!', description: '팀원들이 함께 생일을 축하했습니다.', effectType: 'MORALE', effectValue: 15, requiresSecondPlayer: false },
    { type: 'CELEBRATION', title: '{player1}이(가) 팀 회식 주선', description: '맛있는 음식으로 팀 분위기가 좋아졌습니다.', effectType: 'MORALE', effectValue: 10, requiresSecondPlayer: false },
    { type: 'CELEBRATION', title: '팀 볼링 대회에서 {player1} 우승', description: '팀 내 친목 활동이 성공적이었습니다.', effectType: 'CONDITION', effectValue: 10, requiresSecondPlayer: false }
  ],
  PRANK: [
    { type: 'PRANK', title: '{player1}이(가) {player2}에게 장난', description: '재미있는 장난으로 팀 분위기가 밝아졌습니다.', effectType: 'MORALE', effectValue: 5, requiresSecondPlayer: true },
    { type: 'PRANK', title: '{player1}의 깜짝 서프라이즈', description: '예상치 못한 장난에 모두가 웃었습니다.', effectType: 'MORALE', effectValue: 8, requiresSecondPlayer: false },
    { type: 'PRANK', title: '{player1}이(가) {player2}를 깜짝 놀래킴', description: '무해한 장난이었지만 조금 과했습니다.', effectType: 'MORALE', effectValue: -3, requiresSecondPlayer: true }
  ],
  INJURY: [
    { type: 'INJURY', title: '{player1} 가벼운 부상', description: '훈련 중 가벼운 손목 통증을 호소했습니다.', effectType: 'CONDITION', effectValue: -20, requiresSecondPlayer: false },
    { type: 'INJURY', title: '{player1} 피로 누적', description: '과도한 연습으로 컨디션이 급격히 떨어졌습니다.', effectType: 'CONDITION', effectValue: -25, requiresSecondPlayer: false }
  ],
  BONUS: [
    { type: 'BONUS', title: '{player1}이(가) 팬 이벤트 참여', description: '팬들과의 만남으로 팀 인지도가 올랐습니다.', effectType: 'FAN', effectValue: 100, requiresSecondPlayer: false },
    { type: 'BONUS', title: '{player1} 개인 스트리밍 대박', description: '개인 방송이 인기를 끌어 수익이 발생했습니다.', effectType: 'GOLD', effectValue: 5000, requiresSecondPlayer: false },
    { type: 'BONUS', title: '{player1}이(가) 팀 후원금 유치', description: '개인 인맥을 통해 추가 후원을 받았습니다.', effectType: 'GOLD', effectValue: 10000, requiresSecondPlayer: false }
  ],
  SCANDAL: [
    { type: 'SCANDAL', title: '{player1} SNS 논란', description: '부적절한 발언으로 팬들의 비난을 받았습니다.', effectType: 'FAN', effectValue: -200, requiresSecondPlayer: false },
    { type: 'SCANDAL', title: '{player1} 음주 스캔들', description: '미성년자 팀원과의 음주가 적발되었습니다.', effectType: 'FAN', effectValue: -500, requiresSecondPlayer: false },
    { type: 'SCANDAL', title: '{player1}의 과거 발언 논란', description: '과거 부적절한 채팅 내역이 유출되었습니다.', effectType: 'FAN', effectValue: -300, requiresSecondPlayer: false }
  ],
  INTERVIEW: [
    { type: 'INTERVIEW', title: '{player1} 인터뷰 호평', description: '매체 인터뷰에서 좋은 이미지를 보여줬습니다.', effectType: 'FAN', effectValue: 150, requiresSecondPlayer: false },
    { type: 'INTERVIEW', title: '{player1} 팬덤 형성', description: '팬들 사이에서 인기가 급상승했습니다.', effectType: 'FAN', effectValue: 200, requiresSecondPlayer: false },
    { type: 'INTERVIEW', title: '{player1}의 솔직한 인터뷰', description: '진솔한 이야기로 많은 공감을 얻었습니다.', effectType: 'FAN', effectValue: 100, requiresSecondPlayer: false }
  ],
  TEAMBUILDING: [
    { type: 'TEAMBUILDING', title: '{player1}이(가) 팀 훈련 주도', description: '자발적인 추가 훈련으로 팀 실력이 향상됐습니다.', effectType: 'MORALE', effectValue: 20, requiresSecondPlayer: false },
    { type: 'TEAMBUILDING', title: '{player1}과 {player2}의 듀오 케미', description: '두 선수의 호흡이 좋아졌습니다.', effectType: 'MORALE', effectValue: 15, requiresSecondPlayer: true },
    { type: 'TEAMBUILDING', title: '{player1}이(가) 팀 멘탈 케어', description: '힘든 팀원들을 격려하며 분위기를 살렸습니다.', effectType: 'MORALE', effectValue: 25, requiresSecondPlayer: false }
  ]
};

export class EventService {
  // 랜덤 이벤트 발생 확률 (1일 기준)
  private static EVENT_CHANCE = 0.3; // 30% 확률

  // 팀의 이벤트 발생 체크
  static async checkAndGenerateEvents(teamId: number): Promise<void> {
    // 랜덤 확률 체크
    if (Math.random() > this.EVENT_CHANCE) {
      return;
    }

    try {
      // 팀 선수 목록 조회
      const players = await pool.query(
        `SELECT id, name, personality, is_starter, overall, player_condition
         FROM players
         WHERE team_id = ? AND injury_status = 'NONE'`,
        [teamId]
      );

      if (players.length === 0) return;

      // 랜덤 선수 선택
      const player = players[Math.floor(Math.random() * players.length)] as Player;
      const personality = player.personality || 'CALM';

      // 성격에 따른 이벤트 타입 선택
      const eventType = this.selectEventType(personality);

      // 이벤트 템플릿 선택
      const templates = eventTemplates[eventType];
      const template = templates[Math.floor(Math.random() * templates.length)];

      // 두 번째 선수 필요시 선택
      let player2: Player | null = null;
      if (template.requiresSecondPlayer && players.length > 1) {
        const otherPlayers = players.filter((p: Player) => p.id !== player.id);
        player2 = otherPlayers[Math.floor(Math.random() * otherPlayers.length)] as Player;
      }

      // 이벤트 제목/설명 생성
      let title = template.title.replace('{player1}', player.name);
      let description = template.description;
      if (player2) {
        title = title.replace('{player2}', player2.name);
        description = description.replace('{player2}', player2.name);
      }

      // 이벤트 저장
      await pool.query(
        `INSERT INTO team_events (team_id, event_type, player_id, player2_id, title, description, effect_type, effect_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [teamId, eventType, player.id, player2?.id || null, title, description, template.effectType, template.effectValue]
      );

      // 효과 적용
      await this.applyEventEffect(teamId, player.id, template.effectType, template.effectValue);

    } catch (error) {
      console.error('Failed to generate event:', error);
    }
  }

  // 성격에 따른 이벤트 타입 선택
  private static selectEventType(personality: string): string {
    const weights = personalityEventWeights[personality] || personalityEventWeights['CALM'];
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (const [type, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        return type;
      }
    }

    return 'CELEBRATION'; // 기본값
  }

  // 이벤트 효과 적용
  private static async applyEventEffect(
    teamId: number,
    playerId: number,
    effectType: string,
    effectValue: number
  ): Promise<void> {
    switch (effectType) {
      case 'MORALE':
        // 팀 전체 선수 컨디션에 영향
        await pool.query(
          `UPDATE players
           SET player_condition = LEAST(100, GREATEST(0, player_condition + ?))
           WHERE team_id = ?`,
          [Math.floor(effectValue / 2), teamId]
        );
        break;

      case 'CONDITION':
        // 특정 선수 컨디션에 영향
        await pool.query(
          `UPDATE players
           SET player_condition = LEAST(100, GREATEST(0, player_condition + ?))
           WHERE id = ?`,
          [effectValue, playerId]
        );
        break;

      case 'GOLD':
        // 팀 골드에 영향
        await pool.query(
          `UPDATE teams SET gold = gold + ? WHERE id = ?`,
          [effectValue, teamId]
        );
        break;

      case 'FAN':
        // 팀 팬 수에 영향
        await pool.query(
          `UPDATE teams SET fan_count = GREATEST(0, fan_count + ?) WHERE id = ?`,
          [effectValue, teamId]
        );
        break;

      case 'SATISFACTION':
        // 선수 만족도에 영향 (추후 구현)
        break;
    }
  }

  // 팀 이벤트 목록 조회
  static async getTeamEvents(teamId: number, limit: number = 20): Promise<any[]> {
    const events = await pool.query(
      `SELECT e.*,
              p1.name as player_name,
              p2.name as player2_name
       FROM team_events e
       LEFT JOIN players p1 ON e.player_id = p1.id
       LEFT JOIN players p2 ON e.player2_id = p2.id
       WHERE e.team_id = ?
       ORDER BY e.created_at DESC
       LIMIT ?`,
      [teamId, limit]
    );
    return events;
  }

  // 읽지 않은 이벤트 수 조회
  static async getUnreadEventCount(teamId: number): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM team_events WHERE team_id = ? AND is_read = FALSE`,
      [teamId]
    );
    return result[0]?.count || 0;
  }

  // 이벤트 읽음 처리
  static async markEventsAsRead(teamId: number): Promise<void> {
    await pool.query(
      `UPDATE team_events SET is_read = TRUE WHERE team_id = ?`,
      [teamId]
    );
  }

  // 성격에 따른 연봉 협상 수정자 계산
  static getPersonalityNegotiationModifier(personality: string): { salaryMod: number; acceptChanceMod: number } {
    switch (personality) {
      case 'GREEDY':
        return { salaryMod: 1.3, acceptChanceMod: -15 }; // 더 높은 연봉 요구, 수락 확률 감소
      case 'HUMBLE':
        return { salaryMod: 0.9, acceptChanceMod: 10 }; // 낮은 연봉도 수락, 수락 확률 증가
      case 'HOTHEAD':
        return { salaryMod: 1.1, acceptChanceMod: -10 }; // 약간 높은 요구, 협상 불안정
      case 'CALM':
        return { salaryMod: 1.0, acceptChanceMod: 5 }; // 합리적인 협상
      case 'LEADER':
        return { salaryMod: 1.15, acceptChanceMod: 0 }; // 리더십에 맞는 대우 기대
      case 'LONER':
        return { salaryMod: 1.0, acceptChanceMod: -5 }; // 팀 이적에 소극적
      case 'TEAMPLAYER':
        return { salaryMod: 0.95, acceptChanceMod: 15 }; // 팀을 위해 양보, 이적 적극적
      case 'PRANKSTER':
        return { salaryMod: 1.0, acceptChanceMod: 0 }; // 보통
      default:
        return { salaryMod: 1.0, acceptChanceMod: 0 };
    }
  }

  // 성격에 따른 경기 성능 수정자
  static getPersonalityMatchModifier(personality: string, isImportantMatch: boolean): number {
    if (isImportantMatch) {
      switch (personality) {
        case 'LEADER': return 10; // 중요 경기에서 리더십 발휘
        case 'HOTHEAD': return -5; // 압박감에 흥분
        case 'CALM': return 5; // 침착하게 대응
        case 'LONER': return 0; // 영향 없음
        case 'TEAMPLAYER': return 3; // 팀을 위해 노력
        default: return 0;
      }
    }
    return 0;
  }

  // 벤치 선수 불만족 체크 및 갈등 이벤트 생성
  static async checkBenchedPlayerConflicts(teamId: number): Promise<void> {
    try {
      // 벤치 선수 중 고OVR 선수 조회 (player_cards 기반)
      const benchedPlayers = await pool.query(
        `SELECT pc.id,
                COALESCE(pp.name, pc.ai_player_name) as name,
                pc.ovr, pc.personality
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ? AND pc.is_contracted = true AND pc.is_starter = false`,
        [teamId]
      );

      // 스타터 평균 OVR 계산
      const starters = await pool.query(
        `SELECT AVG(ovr) as avg_ovr FROM player_cards
         WHERE team_id = ? AND is_contracted = true AND is_starter = true`,
        [teamId]
      );
      const starterAvgOvr = starters[0]?.avg_ovr || 50;

      for (const player of benchedPlayers) {
        // 벤치 선수가 스타터 평균보다 높은 OVR을 가진 경우
        if (player.ovr > starterAvgOvr) {
          const ovrDiff = player.ovr - starterAvgOvr;

          // OVR 차이에 따른 갈등 확률 (차이 10당 10%)
          const conflictChance = Math.min(0.5, ovrDiff * 0.01);

          if (Math.random() < conflictChance) {
            // 성격에 따른 갈등 유형 결정
            const personality = player.personality || 'CALM';
            let eventTitle = '';
            let eventDesc = '';
            let effectValue = -5;

            switch (personality) {
              case 'HOTHEAD':
              case 'REBELLIOUS':
                eventTitle = `${player.name}이(가) 출전 기회에 불만 폭발`;
                eventDesc = '더 높은 실력을 가지고도 벤치를 지키는 것에 분노를 표출했습니다.';
                effectValue = -15;
                break;
              case 'GREEDY':
                eventTitle = `${player.name}이(가) 이적 요청`;
                eventDesc = '출전 기회가 없다며 이적을 요청했습니다.';
                effectValue = -10;
                break;
              case 'LEADER':
                eventTitle = `${player.name}이(가) 경쟁 선언`;
                eventDesc = '주전 자리를 되찾겠다는 강한 의지를 표명했습니다.';
                effectValue = -3;
                break;
              default:
                eventTitle = `${player.name}이(가) 출전 기회 부족에 실망`;
                eventDesc = '실력에 비해 출전 기회가 적다고 생각합니다.';
                effectValue = -5;
            }

            // 갈등 이벤트 저장
            await pool.query(
              `INSERT INTO team_events (team_id, event_type, player_id, title, description, effect_type, effect_value)
               VALUES (?, 'CONFLICT', ?, ?, ?, 'MORALE', ?)`,
              [teamId, player.id, eventTitle, eventDesc, effectValue]
            );

            console.log(`Benched player conflict: ${player.name} (OVR ${player.ovr} vs avg ${starterAvgOvr})`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check benched player conflicts:', error);
    }
  }
}

export default EventService;
