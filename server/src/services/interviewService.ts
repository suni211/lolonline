import pool from '../database/db.js';

// 면담 템플릿 정의
const INTERVIEW_TEMPLATES = {
  // 나쁜 상황들
  LOSING_STREAK: {
    type: 'COMPLAINT' as const,
    trigger: 'LOSING_STREAK',
    situations: [
      {
        personality: 'HOTHEAD',
        message: '감독님, 이대로는 안됩니다! 연패가 계속되고 있어요. 전술을 바꿔야 하지 않나요?',
        mood: 'ANGRY' as const,
        options: [
          {
            text: '전술을 재검토하겠다고 약속한다',
            effect: { satisfaction: 10, morale: 5 },
            response: '알겠습니다. 기대할게요.'
          },
          {
            text: '끝까지 현재 전술을 고수한다',
            effect: { satisfaction: -15, morale: -10 },
            response: '...이해할 수 없네요.'
          },
          {
            text: '선수들의 노력 부족을 지적한다',
            effect: { satisfaction: -20, morale: -15 },
            response: '그렇게 생각하시는군요. 실망했습니다.'
          }
        ]
      },
      {
        personality: 'LEADER',
        message: '감독님, 팀 분위기가 좋지 않습니다. 이 연패를 어떻게 극복할 계획이신가요?',
        mood: 'UPSET' as const,
        options: [
          {
            text: '함께 극복하자고 격려한다',
            effect: { satisfaction: 15, morale: 10, leadership: 2 },
            response: '감독님을 믿겠습니다. 함께 이겨냅시다!'
          },
          {
            text: '개인 훈련을 늘리라고 지시한다',
            effect: { satisfaction: 0, morale: -5 },
            response: '알겠습니다. 더 노력하겠습니다.'
          },
          {
            text: '팀 회식을 제안한다',
            effect: { satisfaction: 10, morale: 15, teamChemistry: 5 },
            response: '좋은 생각입니다! 팀 분위기를 환기시켜야죠.'
          }
        ]
      },
      {
        personality: 'LONER',
        message: '요즘 경기 결과가 안 좋은데, 제 플레이에 문제가 있나요?',
        mood: 'NEUTRAL' as const,
        options: [
          {
            text: '개인 플레이는 좋다고 위로한다',
            effect: { satisfaction: 10, morale: 5 },
            response: '그렇다면 다행이네요.'
          },
          {
            text: '팀 플레이를 더 신경 쓰라고 조언한다',
            effect: { satisfaction: 5, teamfight: 1 },
            response: '노력해보겠습니다.'
          }
        ]
      }
    ]
  },

  BENCHED: {
    type: 'CONCERN' as const,
    trigger: 'BENCHED',
    situations: [
      {
        personality: 'GREEDY',
        message: '감독님, 제가 왜 벤치에 있는 건가요? 이적을 고려하고 있습니다.',
        mood: 'ANGRY' as const,
        options: [
          {
            text: '곧 기회를 주겠다고 약속한다',
            effect: { satisfaction: 5, morale: 0 },
            response: '꼭 지켜주세요. 그렇지 않으면...'
          },
          {
            text: '현재 스타터가 더 낫다고 설명한다',
            effect: { satisfaction: -25, morale: -20, transferRequest: true },
            response: '알겠습니다. 이적을 신청하겠습니다.'
          },
          {
            text: '훈련 태도 개선을 요구한다',
            effect: { satisfaction: -10, morale: -5 },
            response: '...노력하겠습니다.'
          }
        ]
      },
      {
        personality: 'HUMBLE',
        message: '감독님, 제가 부족한 점을 알려주시면 더 노력하겠습니다.',
        mood: 'NEUTRAL' as const,
        options: [
          {
            text: '구체적인 피드백을 준다',
            effect: { satisfaction: 15, morale: 10, workEthic: 2 },
            response: '감사합니다! 꼭 개선하겠습니다.'
          },
          {
            text: '곧 기회가 올 거라고 격려한다',
            effect: { satisfaction: 10, morale: 5 },
            response: '기다리겠습니다. 열심히 준비하겠습니다!'
          }
        ]
      }
    ]
  },

  // 좋은 상황들
  WINNING_STREAK: {
    type: 'CELEBRATION' as const,
    trigger: 'WINNING_STREAK',
    situations: [
      {
        personality: 'LEADER',
        message: '감독님, 요즘 우리 팀 분위기 정말 좋죠? 이대로 우승까지 가봅시다!',
        mood: 'VERY_HAPPY' as const,
        options: [
          {
            text: '함께 축하하며 격려한다',
            effect: { satisfaction: 10, morale: 15, teamChemistry: 5 },
            response: '감독님 덕분입니다! 더 열심히 하겠습니다!'
          },
          {
            text: '방심하지 말라고 주의를 준다',
            effect: { satisfaction: 0, morale: -5 },
            response: '...알겠습니다.'
          },
          {
            text: '보너스를 약속한다',
            effect: { satisfaction: 20, morale: 20, goldCost: 5000000 },
            response: '와! 정말요? 더욱 열심히 뛰겠습니다!'
          }
        ]
      },
      {
        personality: 'HUMBLE',
        message: '감독님, 제가 팀에 도움이 되고 있는 것 같아 기쁩니다.',
        mood: 'HAPPY' as const,
        options: [
          {
            text: '크게 칭찬한다',
            effect: { satisfaction: 15, morale: 10, confidence: 5 },
            response: '감사합니다! 계속 노력하겠습니다!'
          },
          {
            text: '앞으로의 목표를 제시한다',
            effect: { satisfaction: 10, morale: 5, focus: 1 },
            response: '네! 그 목표를 향해 달리겠습니다!'
          }
        ]
      }
    ]
  },

  MVP_PERFORMANCE: {
    type: 'ACHIEVEMENT' as const,
    trigger: 'MVP',
    situations: [
      {
        personality: 'GREEDY',
        message: '감독님, 제 플레이 보셨죠? MVP 인센티브는 당연히 받는 거죠?',
        mood: 'HAPPY' as const,
        options: [
          {
            text: '인센티브를 지급한다',
            effect: { satisfaction: 20, morale: 15, goldCost: 3000000 },
            response: '감사합니다! 다음에도 기대하세요!'
          },
          {
            text: '팀 플레이가 더 중요하다고 말한다',
            effect: { satisfaction: -10, morale: -5 },
            response: '...그렇군요.'
          }
        ]
      },
      {
        personality: 'TEAMPLAYER',
        message: '감독님, 오늘 경기는 팀원들 덕분이에요. 모두가 잘해줬습니다!',
        mood: 'VERY_HAPPY' as const,
        options: [
          {
            text: '팀워크를 칭찬한다',
            effect: { satisfaction: 15, morale: 15, teamChemistry: 10 },
            response: '감독님도 그렇게 생각하시는군요! 앞으로도 함께 잘해봅시다!'
          },
          {
            text: '개인의 공을 인정한다',
            effect: { satisfaction: 10, morale: 10 },
            response: '감사합니다! 하지만 진짜 팀워크가 좋았어요!'
          }
        ]
      }
    ]
  },

  INJURY_RECOVERY: {
    type: 'CONCERN' as const,
    trigger: 'INJURY',
    situations: [
      {
        personality: 'CALM',
        message: '감독님, 부상이 완전히 나았는지 확신이 서지 않습니다.',
        mood: 'UPSET' as const,
        options: [
          {
            text: '충분히 쉬라고 배려한다',
            effect: { satisfaction: 15, morale: 10, condition: 5 },
            response: '감사합니다. 천천히 컨디션을 올리겠습니다.'
          },
          {
            text: '바로 복귀를 시킨다',
            effect: { satisfaction: -10, morale: -10, injuryRisk: 20 },
            response: '...알겠습니다. 최선을 다하겠습니다.'
          },
          {
            text: '재활 전문가를 붙여준다',
            effect: { satisfaction: 20, morale: 15, condition: 10, goldCost: 10000000 },
            response: '정말 감사합니다! 빨리 회복해서 돌아오겠습니다!'
          }
        ]
      }
    ]
  },

  CONTRACT_NEGOTIATION: {
    type: 'REQUEST' as const,
    trigger: 'CONTRACT_EXPIRING',
    situations: [
      {
        personality: 'GREEDY',
        message: '감독님, 계약 만료가 얼마 안 남았는데요. 연봉 인상을 고려해주시죠?',
        mood: 'NEUTRAL' as const,
        options: [
          {
            text: '연봉 인상을 약속한다',
            effect: { satisfaction: 25, morale: 15, contractExtension: true },
            response: '좋습니다! 계약 연장하겠습니다!'
          },
          {
            text: '성적을 보고 결정하겠다고 한다',
            effect: { satisfaction: -5, morale: 0 },
            response: '알겠습니다. 더 열심히 뛰겠습니다.'
          },
          {
            text: '현재 연봉이 적정하다고 말한다',
            effect: { satisfaction: -20, morale: -15, transferRequest: true },
            response: '그렇다면 다른 팀을 알아봐야겠네요.'
          }
        ]
      },
      {
        personality: 'HUMBLE',
        message: '감독님, 계약 만료가 다가오는데 팀에 계속 있고 싶습니다.',
        mood: 'NEUTRAL' as const,
        options: [
          {
            text: '계약 연장을 제안한다',
            effect: { satisfaction: 20, morale: 15, contractExtension: true },
            response: '감사합니다! 계속 열심히 하겠습니다!'
          },
          {
            text: '나중에 논의하자고 한다',
            effect: { satisfaction: 0, morale: -5 },
            response: '...알겠습니다.'
          }
        ]
      }
    ]
  },

  TEAM_CHEMISTRY_ISSUE: {
    type: 'COMPLAINT' as const,
    trigger: 'CHEMISTRY_LOW',
    situations: [
      {
        personality: 'HOTHEAD',
        message: '감독님, 저 선수랑은 같이 못 뛰겠습니다. 둘 중 하나를 벤치에 앉히세요!',
        mood: 'ANGRY' as const,
        options: [
          {
            text: '두 선수를 중재한다',
            effect: { satisfaction: 5, morale: 0, teamChemistry: 5 },
            response: '...일단 이야기는 들었습니다.'
          },
          {
            text: '선수에게 참으라고 한다',
            effect: { satisfaction: -15, morale: -10 },
            response: '이런 식이면 이적을 고려해야겠네요.'
          },
          {
            text: '팀 빌딩 이벤트를 계획한다',
            effect: { satisfaction: 10, morale: 10, teamChemistry: 15, goldCost: 5000000 },
            response: '...그게 도움이 될까요? 뭐, 해보죠.'
          }
        ]
      },
      {
        personality: 'TEAMPLAYER',
        message: '감독님, 팀 분위기가 좋지 않은 것 같아요. 팀 식사라도 함께 하는 게 어떨까요?',
        mood: 'UPSET' as const,
        options: [
          {
            text: '팀 회식을 승인한다',
            effect: { satisfaction: 15, morale: 15, teamChemistry: 10, goldCost: 2000000 },
            response: '감사합니다! 팀 분위기가 좋아질 거예요!'
          },
          {
            text: '훈련에 집중하라고 한다',
            effect: { satisfaction: -5, morale: -5 },
            response: '...알겠습니다.'
          }
        ]
      }
    ]
  }
};

export class InterviewService {
  // 면담 생성 (상황에 맞는 면담 자동 생성)
  static async generateInterview(
    teamId: number,
    playerCardId: number,
    triggerReason: string
  ) {
    try {
      // 선수 정보 가져오기
      const player = await pool.query(
        `SELECT pc.*, COALESCE(pp.name, pc.ai_player_name) as player_name, pc.personality
         FROM player_cards pc
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.id = ? AND pc.team_id = ?`,
        [playerCardId, teamId]
      );

      if (player.length === 0) {
        throw new Error('선수를 찾을 수 없습니다');
      }

      const playerData = player[0];
      const personality = playerData.personality || 'CALM';

      // 트리거에 맞는 템플릿 찾기
      const templateKey = Object.keys(INTERVIEW_TEMPLATES).find(
        key => INTERVIEW_TEMPLATES[key as keyof typeof INTERVIEW_TEMPLATES].trigger === triggerReason
      );

      if (!templateKey) {
        throw new Error('유효하지 않은 트리거입니다');
      }

      const template = INTERVIEW_TEMPLATES[templateKey as keyof typeof INTERVIEW_TEMPLATES];

      // 성격에 맞는 상황 찾기
      let situation = template.situations.find((s: any) => s.personality === personality);
      if (!situation) {
        // 성격 맞는 게 없으면 랜덤
        situation = template.situations[Math.floor(Math.random() * template.situations.length)];
      }

      // 면담 생성
      const result = await pool.query(
        `INSERT INTO player_interviews
         (team_id, player_card_id, interview_type, trigger_reason, situation, player_message, player_mood, options)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          teamId,
          playerCardId,
          template.type,
          triggerReason,
          `${playerData.player_name}와(과)의 면담`,
          situation.message,
          situation.mood,
          JSON.stringify(situation.options)
        ]
      );

      return result.insertId;
    } catch (error) {
      console.error('면담 생성 오류:', error);
      throw error;
    }
  }

  // 면담 응답 처리
  static async respondToInterview(
    interviewId: number,
    selectedOption: number
  ) {
    try {
      // 면담 정보 가져오기
      const interview = await pool.query(
        'SELECT * FROM player_interviews WHERE id = ? AND is_resolved = FALSE',
        [interviewId]
      );

      if (interview.length === 0) {
        throw new Error('면담을 찾을 수 없거나 이미 처리되었습니다');
      }

      const interviewData = interview[0];
      const options = JSON.parse(interviewData.options);

      if (selectedOption < 0 || selectedOption >= options.length) {
        throw new Error('유효하지 않은 선택입니다');
      }

      const chosenOption = options[selectedOption];
      const effect = chosenOption.effect;

      // 효과 적용
      let updateQuery = 'UPDATE player_cards SET ';
      const updates: string[] = [];
      const params: any[] = [];

      // 만족도 변화
      if (effect.satisfaction) {
        updates.push('satisfaction = GREATEST(0, LEAST(100, satisfaction + ?))');
        params.push(effect.satisfaction);
      }

      // 컨디션 변화
      if (effect.condition) {
        updates.push('player_condition = GREATEST(0, LEAST(100, player_condition + ?))');
        params.push(effect.condition);
      }

      // 스탯 변화
      if (effect.leadership) {
        updates.push('leadership = LEAST(300, leadership + ?)');
        params.push(effect.leadership);
      }

      if (effect.teamfight) {
        updates.push('teamfight = LEAST(300, teamfight + ?)');
        params.push(effect.teamfight);
      }

      if (effect.workEthic) {
        updates.push('work_ethic = LEAST(300, work_ethic + ?)');
        params.push(effect.workEthic);
      }

      if (effect.focus) {
        updates.push('focus = LEAST(300, focus + ?)');
        params.push(effect.focus);
      }

      if (updates.length > 0) {
        updateQuery += updates.join(', ') + ' WHERE id = ?';
        params.push(interviewData.player_card_id);
        await pool.query(updateQuery, params);
      }

      // 골드 비용 처리
      if (effect.goldCost) {
        await pool.query(
          'UPDATE teams SET gold = gold - ? WHERE id = ?',
          [effect.goldCost, interviewData.team_id]
        );

        await pool.query(
          `INSERT INTO financial_records (team_id, record_type, category, amount, description)
           VALUES (?, 'EXPENSE', 'OTHER', ?, ?)`,
          [interviewData.team_id, effect.goldCost, '선수 면담 관련 지출']
        );
      }

      // 이적 요청 처리
      if (effect.transferRequest) {
        // 이적 요청 플래그 추가 (추후 구현)
        console.log(`⚠️ 선수 ${interviewData.player_card_id}가 이적을 요청했습니다!`);
      }

      // 면담 완료 처리
      await pool.query(
        `UPDATE player_interviews
         SET selected_option = ?, result = ?, is_resolved = TRUE, resolved_at = NOW()
         WHERE id = ?`,
        [selectedOption, JSON.stringify(effect), interviewId]
      );

      // 만족도 히스토리 기록
      await pool.query(
        `INSERT INTO player_satisfaction_history (player_card_id, satisfaction, change_reason)
         SELECT satisfaction, ?, ? FROM player_cards WHERE id = ?`,
        [`면담 결과: 옵션 ${selectedOption + 1} 선택`, interviewData.player_card_id]
      );

      return {
        success: true,
        response: chosenOption.response,
        effect
      };
    } catch (error) {
      console.error('면담 응답 처리 오류:', error);
      throw error;
    }
  }

  // 미해결 면담 목록 조회
  static async getPendingInterviews(teamId: number) {
    try {
      const interviews = await pool.query(
        `SELECT pi.*, COALESCE(pp.name, pc.ai_player_name) as player_name, pc.ai_position
         FROM player_interviews pi
         JOIN player_cards pc ON pi.player_card_id = pc.id
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pi.team_id = ? AND pi.is_resolved = FALSE
         ORDER BY pi.created_at DESC`,
        [teamId]
      );

      return interviews.map((i: any) => ({
        ...i,
        options: JSON.parse(i.options)
      }));
    } catch (error) {
      console.error('면담 목록 조회 오류:', error);
      throw error;
    }
  }

  // 면담 히스토리 조회
  static async getInterviewHistory(teamId: number, limit: number = 20) {
    try {
      const history = await pool.query(
        `SELECT pi.*, COALESCE(pp.name, pc.ai_player_name) as player_name
         FROM player_interviews pi
         JOIN player_cards pc ON pi.player_card_id = pc.id
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pi.team_id = ? AND pi.is_resolved = TRUE
         ORDER BY pi.resolved_at DESC
         LIMIT ?`,
        [teamId, limit]
      );

      return history.map((i: any) => ({
        ...i,
        options: JSON.parse(i.options),
        result: i.result ? JSON.parse(i.result) : null
      }));
    } catch (error) {
      console.error('면담 히스토리 조회 오류:', error);
      throw error;
    }
  }
}

export default InterviewService;
