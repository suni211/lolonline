import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// 선수 성격 타입
export type PersonalityType = 'LEADER' | 'REBELLIOUS' | 'CALM' | 'EMOTIONAL' | 'COMPETITIVE' | 'TIMID' | 'GREEDY' | 'LOYAL' | 'PERFECTIONIST' | 'LAZY';

// 선수 성격에 따른 특성
export const personalityTraits: Record<PersonalityType, {
  name: string;
  description: string;
  conflictChance: number; // 갈등 확률 (0-1)
  motivationBonus: number; // 동기부여 보너스
}> = {
  LEADER: {
    name: '리더형',
    description: '팀을 이끄는 카리스마가 있지만, 자신의 의견이 무시되면 불만을 가짐',
    conflictChance: 0.1,
    motivationBonus: 5
  },
  REBELLIOUS: {
    name: '반항적',
    description: '재능은 뛰어나지만 감독의 지시에 자주 반발함',
    conflictChance: 0.4,
    motivationBonus: -5
  },
  CALM: {
    name: '차분함',
    description: '어떤 상황에서도 평정심을 유지하며 갈등을 피함',
    conflictChance: 0.05,
    motivationBonus: 3
  },
  EMOTIONAL: {
    name: '감정적',
    description: '경기 결과에 따라 기분이 크게 변하며, 슬럼프에 빠지기 쉬움',
    conflictChance: 0.25,
    motivationBonus: 0
  },
  COMPETITIVE: {
    name: '승부욕',
    description: '이기는 것에 집착하며, 패배 시 팀원을 탓하기도 함',
    conflictChance: 0.2,
    motivationBonus: 7
  },
  TIMID: {
    name: '소심함',
    description: '자기주장이 약하고 계약 조건에 순순히 따름. 갈등을 극도로 피함',
    conflictChance: 0.02,
    motivationBonus: -2
  },
  GREEDY: {
    name: '탐욕스러움',
    description: '돈과 명예에 집착하며, 더 좋은 조건을 항상 요구함',
    conflictChance: 0.3,
    motivationBonus: 2
  },
  LOYAL: {
    name: '충성스러움',
    description: '팀에 헌신적이며, 어려운 상황에서도 팀을 떠나지 않음',
    conflictChance: 0.05,
    motivationBonus: 4
  },
  PERFECTIONIST: {
    name: '완벽주의',
    description: '자신과 팀에 높은 기준을 요구하며, 실수에 민감함',
    conflictChance: 0.15,
    motivationBonus: 6
  },
  LAZY: {
    name: '게으름',
    description: '훈련에 열의가 없고, 최소한의 노력만 함',
    conflictChance: 0.2,
    motivationBonus: -7
  }
};

// 성격 기반 랜덤 성격 생성
export function generatePersonality(mental: number): PersonalityType {
  const rand = Math.random();

  // mental이 높으면 좋은 성격, 낮으면 나쁜 성격 확률 증가
  if (mental >= 80) {
    // 고멘탈: 리더형, 충성, 완벽주의, 차분 위주
    if (rand < 0.20) return 'LEADER';
    if (rand < 0.35) return 'LOYAL';
    if (rand < 0.50) return 'PERFECTIONIST';
    if (rand < 0.65) return 'CALM';
    if (rand < 0.80) return 'COMPETITIVE';
    if (rand < 0.90) return 'TIMID';
    return 'EMOTIONAL';
  } else if (mental >= 60) {
    // 중멘탈: 다양한 성격
    if (rand < 0.12) return 'LEADER';
    if (rand < 0.24) return 'CALM';
    if (rand < 0.36) return 'COMPETITIVE';
    if (rand < 0.48) return 'LOYAL';
    if (rand < 0.58) return 'PERFECTIONIST';
    if (rand < 0.68) return 'TIMID';
    if (rand < 0.78) return 'EMOTIONAL';
    if (rand < 0.88) return 'GREEDY';
    return 'REBELLIOUS';
  } else if (mental >= 40) {
    // 저멘탈: 부정적 성격 증가
    if (rand < 0.15) return 'REBELLIOUS';
    if (rand < 0.30) return 'EMOTIONAL';
    if (rand < 0.42) return 'GREEDY';
    if (rand < 0.54) return 'LAZY';
    if (rand < 0.66) return 'TIMID';
    if (rand < 0.76) return 'COMPETITIVE';
    if (rand < 0.86) return 'CALM';
    return 'LOYAL';
  } else {
    // 매우 저멘탈: 나쁜 성격 위주
    if (rand < 0.25) return 'LAZY';
    if (rand < 0.45) return 'REBELLIOUS';
    if (rand < 0.60) return 'EMOTIONAL';
    if (rand < 0.75) return 'GREEDY';
    if (rand < 0.85) return 'TIMID';
    if (rand < 0.95) return 'COMPETITIVE';
    return 'CALM';
  }
}

// 선수와 대화하기
export async function chatWithPlayer(
  playerName: string,
  playerPosition: string,
  personality: PersonalityType,
  teamName: string,
  recentPerformance: string, // 'good' | 'average' | 'bad'
  userMessage: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const traits = personalityTraits[personality];

    const prompt = `당신은 ${teamName} 소속 프로 LoL 선수 "${playerName}"입니다.
포지션: ${playerPosition}
성격: ${traits.name} - ${traits.description}
최근 경기력: ${recentPerformance === 'good' ? '좋음' : recentPerformance === 'average' ? '보통' : '부진'}

당신은 감독(사용자)과 대화하고 있습니다. 성격에 맞게 자연스럽게 대답하세요.
- 한국어로 대답하세요
- 2-3문장으로 간결하게 대답하세요
- 프로게이머답게 대화하세요
- 성격 특성을 반영하세요

감독: ${userMessage}

${playerName}:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    return '(응답을 생성할 수 없습니다)';
  }
}

// 선수 이벤트 생성 (갈등, 동기부여 등)
export async function generatePlayerEvent(
  playerName: string,
  personality: PersonalityType,
  teamMorale: number, // 0-100
  recentResults: string[], // ['WIN', 'LOSS', 'WIN', ...]
): Promise<{
  type: 'CONFLICT' | 'MOTIVATION' | 'SLUMP' | 'BREAKTHROUGH' | 'NONE';
  title: string;
  description: string;
  effect: { stat: string; value: number } | null;
} | null> {
  const traits = personalityTraits[personality];

  // 이벤트 발생 확률 계산
  const recentLosses = recentResults.filter(r => r === 'LOSS').length;
  const recentWins = recentResults.filter(r => r === 'WIN').length;

  // 갈등 이벤트
  if (Math.random() < traits.conflictChance * (recentLosses * 0.3 + 1)) {
    if (teamMorale < 50 || recentLosses >= 3) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `LoL 이스포츠 게임에서 선수 이벤트를 생성해주세요.
선수: ${playerName}
성격: ${traits.name}
상황: 팀 사기 ${teamMorale}%, 최근 ${recentLosses}패

갈등 이벤트를 JSON 형식으로 생성:
{
  "title": "이벤트 제목 (10자 이내)",
  "description": "이벤트 설명 (30자 이내)",
  "statAffected": "mental 또는 focus 또는 teamfight",
  "statChange": -5에서 -15 사이의 정수
}

JSON만 출력:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // JSON 파싱 시도
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const eventData = JSON.parse(jsonMatch[0]);
          return {
            type: 'CONFLICT',
            title: eventData.title,
            description: eventData.description,
            effect: {
              stat: eventData.statAffected,
              value: eventData.statChange
            }
          };
        }
      } catch (error) {
        console.error('Event generation error:', error);
      }

      // 기본 갈등 이벤트
      return {
        type: 'CONFLICT',
        title: '감독과 의견 충돌',
        description: `${playerName} 선수가 전술에 불만을 표출했습니다.`,
        effect: { stat: 'mental', value: -10 }
      };
    }
  }

  // 돌파구 이벤트 (연승 시)
  if (recentWins >= 3 && Math.random() < 0.3) {
    return {
      type: 'BREAKTHROUGH',
      title: '자신감 상승',
      description: `${playerName} 선수가 연승으로 자신감이 넘칩니다!`,
      effect: { stat: 'mental', value: 5 }
    };
  }

  // 슬럼프 이벤트 (연패 시)
  if (recentLosses >= 3 && personality === 'EMOTIONAL' && Math.random() < 0.4) {
    return {
      type: 'SLUMP',
      title: '슬럼프',
      description: `${playerName} 선수가 슬럼프에 빠졌습니다.`,
      effect: { stat: 'focus', value: -8 }
    };
  }

  return null;
}

// 팀 회의 결과 생성
export async function generateTeamMeeting(
  teamName: string,
  players: { name: string; personality: PersonalityType }[],
  topic: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const playerList = players.map(p =>
      `${p.name} (${personalityTraits[p.personality].name})`
    ).join(', ');

    const prompt = `LoL 프로팀 ${teamName}의 팀 회의 결과를 생성해주세요.
선수들: ${playerList}
회의 주제: ${topic}

각 선수의 성격을 반영하여 회의 결과를 3-4문장으로 요약해주세요.
한국어로 작성하세요.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Team meeting generation error:', error);
    return '회의가 진행되었습니다.';
  }
}

// 연봉협상 AI 대사 생성
export async function generateContractNegotiationDialogue(
  playerName: string,
  personality: PersonalityType,
  proposedSalary: number,
  baseSalary: number,
  responseType: 'ACCEPT' | 'REJECT' | 'COUNTER',
  counterSalary?: number
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const traits = personalityTraits[personality];
    const salaryRatio = (proposedSalary / baseSalary * 100).toFixed(0);

    let situation = '';
    if (responseType === 'ACCEPT') {
      situation = '제안을 수락하며 감사를 표현';
    } else if (responseType === 'REJECT') {
      situation = `제안이 너무 낮아서 거절 (제안 연봉이 기대치의 ${salaryRatio}%)`;
    } else {
      situation = `카운터 오퍼 제시 (${counterSalary?.toLocaleString()} 원 요구)`;
    }

    const prompt = `당신은 프로 LoL 선수 "${playerName}"입니다.
성격: ${traits.name} - ${traits.description}

연봉 협상 중입니다.
상황: ${situation}

성격에 맞게 1-2문장으로 대사를 생성하세요.
- 한국어로 작성
- 프로게이머답게
- 감정을 담아서
- 따옴표 없이 대사만 출력

대사:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Contract negotiation dialogue error:', error);

    // 기본 대사
    if (responseType === 'ACCEPT') {
      return '좋은 조건입니다. 팀을 위해 최선을 다하겠습니다.';
    } else if (responseType === 'REJECT') {
      return '죄송하지만 이 조건으론 계약하기 어렵습니다.';
    } else {
      return `${counterSalary?.toLocaleString()}원 정도는 되어야 할 것 같습니다.`;
    }
  }
}

// 스카우트 AI 대사 생성
export async function generateScoutDialogue(
  playerName: string,
  playerPosition: string,
  personality: PersonalityType,
  overall: number,
  scoutResult: 'SUCCESS' | 'PARTIAL' | 'FAILED'
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const traits = personalityTraits[personality];

    let situation = '';
    if (scoutResult === 'SUCCESS') {
      situation = '스카우트 제안에 관심을 보이며 긍정적으로 응답';
    } else if (scoutResult === 'PARTIAL') {
      situation = '관심은 있지만 조건을 더 알고 싶어함';
    } else {
      situation = '현재 상황에 만족하여 이적 의사 없음';
    }

    const prompt = `당신은 프로 LoL 선수 "${playerName}"입니다.
포지션: ${playerPosition}
실력: 오버롤 ${overall}
성격: ${traits.name}

스카우트가 접촉했습니다.
상황: ${situation}

성격에 맞게 1-2문장으로 대사를 생성하세요.
한국어로, 따옴표 없이 대사만 출력:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Scout dialogue error:', error);

    if (scoutResult === 'SUCCESS') {
      return '흥미로운 제안이네요. 자세한 조건을 들어보겠습니다.';
    } else if (scoutResult === 'PARTIAL') {
      return '조금 더 생각해볼 시간이 필요합니다.';
    } else {
      return '지금은 이적할 생각이 없습니다.';
    }
  }
}

// 훈련 결과 AI 코멘트
export async function generateTrainingComment(
  playerName: string,
  personality: PersonalityType,
  trainingType: string,
  statChange: number,
  newValue: number
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const traits = personalityTraits[personality];
    const isGoodResult = statChange >= 3;

    const prompt = `당신은 프로 LoL 선수 "${playerName}"입니다.
성격: ${traits.name}

${trainingType} 훈련 후 능력치가 ${statChange > 0 ? '+' : ''}${statChange} 변화했습니다. (현재: ${newValue})

훈련 결과에 대한 반응을 1문장으로 생성하세요.
- 한국어
- 성격 반영
- ${isGoodResult ? '긍정적' : '부정적'} 톤
- 따옴표 없이 대사만:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Training comment error:', error);
    return statChange > 0 ? '훈련이 잘 됐습니다.' : '오늘은 컨디션이 별로였네요.';
  }
}

// 경기 후 인터뷰 생성
export async function generatePostMatchInterview(
  playerName: string,
  personality: PersonalityType,
  isWin: boolean,
  mvp: boolean,
  kills: number,
  deaths: number,
  assists: number
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const traits = personalityTraits[personality];
    const kda = ((kills + assists) / Math.max(1, deaths)).toFixed(2);

    const prompt = `당신은 프로 LoL 선수 "${playerName}"입니다.
성격: ${traits.name}

경기 결과: ${isWin ? '승리' : '패배'}
${mvp ? 'MVP를 수상했습니다!' : ''}
KDA: ${kills}/${deaths}/${assists} (${kda})

경기 후 인터뷰 답변을 2-3문장으로 생성하세요.
- 한국어
- 성격 반영
- 실제 프로게이머처럼
- 따옴표 없이:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Post match interview error:', error);
    return isWin ? '팀원들 덕분에 이길 수 있었습니다.' : '다음 경기에서 더 잘하겠습니다.';
  }
}

export default {
  chatWithPlayer,
  generatePlayerEvent,
  generateTeamMeeting,
  generatePersonality,
  personalityTraits,
  generateContractNegotiationDialogue,
  generateScoutDialogue,
  generateTrainingComment,
  generatePostMatchInterview
};
