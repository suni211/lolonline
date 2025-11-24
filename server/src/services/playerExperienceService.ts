import pool from '../database/db.js';

// 포지션별 경험치 획득 계수
const POSITION_EXP_MULTIPLIER = {
  'TOP': 1.0,
  'JUNGLE': 1.15,   // 정글은 더 많은 활동
  'MID': 1.1,
  'ADC': 1.05,
  'SUPPORT': 0.9    // 서포터는 조금 적음
};

// 경기 결과별 경험치 보너스
const RESULT_EXP_BONUS = {
  'WIN': 1.5,       // 승리 시 1.5배
  'DRAW': 1.0,      // 무승부
  'LOSS': 0.7       // 패배 시 0.7배
};

// 성과 보너스
const PERFORMANCE_BONUS = {
  'MVP': 0.3,       // MVP +30%
  'EXCELLENT': 0.2, // 우수 +20%
  'GOOD': 0.1,      // 좋음 +10%
  'NORMAL': 0.0,    // 일반
  'POOR': -0.1      // 부진 -10%
};

// 포지션별 선호 스탯
const POSITION_STAT_PREFERENCE: Record<string, string[]> = {
  'TOP': ['LANING', 'MENTAL', 'TEAMFIGHT'],
  'JUNGLE': ['TEAMFIGHT', 'MENTAL', 'FOCUS'],
  'MID': ['FOCUS', 'MENTAL', 'LANING'],
  'ADC': ['LANING', 'TEAMFIGHT', 'FOCUS'],
  'SUPPORT': ['MENTAL', 'TEAMFIGHT', 'FOCUS']
};

// 성격별 선호 스탯
const PERSONALITY_STAT_PREFERENCE: Record<string, string[]> = {
  'LEADER': ['MENTAL', 'TEAMFIGHT'],
  'REBELLIOUS': ['LANING', 'MENTAL'],
  'CALM': ['FOCUS', 'MENTAL'],
  'EMOTIONAL': ['MENTAL', 'TEAMFIGHT'],
  'COMPETITIVE': ['TEAMFIGHT', 'LANING'],
  'TIMID': ['FOCUS', 'MENTAL'],
  'GREEDY': ['LANING', 'TEAMFIGHT'],
  'LOYAL': ['MENTAL', 'TEAMFIGHT'],
  'PERFECTIONIST': ['MENTAL', 'TEAMFIGHT', 'FOCUS', 'LANING'],
  'LAZY': ['FOCUS', 'MENTAL']
};

// 선호 스탯에 따라 자동으로 올릴 스탯 결정
function getAutoIncreaseStats(position: string, personality: string): string[] {
  let preferred: string[] = [];

  // 포지션 선호도
  if (POSITION_STAT_PREFERENCE[position]) {
    preferred = [...POSITION_STAT_PREFERENCE[position]];
  } else {
    preferred = ['TEAMFIGHT', 'MENTAL', 'FOCUS', 'LANING'];
  }

  // 성격 선호도 추가 (성격이 더 강한 가중치)
  if (PERSONALITY_STAT_PREFERENCE[personality]) {
    const personalityPrefs = PERSONALITY_STAT_PREFERENCE[personality];
    // 성격의 첫 번째 선호 스탯은 항상 올림
    if (!preferred.includes(personalityPrefs[0])) {
      preferred.unshift(personalityPrefs[0]);
    }
  }

  return preferred;
}

// 선수별 경기 경험치 획득
export async function awardPlayerExperience(
  playerId: number,
  position: string,
  matchResult: 'WIN' | 'DRAW' | 'LOSS',
  performance: 'MVP' | 'EXCELLENT' | 'GOOD' | 'NORMAL' | 'POOR' = 'NORMAL',
  minutesPlayed: number = 90
): Promise<{ exp: number; levelUp: boolean; newLevel: number; statIncreases?: Record<string, number> }> {
  try {
    const player = await pool.query(
      'SELECT level, experience, ovr, personality, mental, teamfight, focus, laning FROM player_cards WHERE id = ?',
      [playerId]
    );

    if (player.length === 0) return { exp: 0, levelUp: false, newLevel: 0 };

    const currentPlayer = player[0];

    // 기본 경험치: 90분 경기 기준 200~400
    const baseExp = 200 + Math.random() * 200;

    // 위치 보너스
    const positionBonus = POSITION_EXP_MULTIPLIER[position as keyof typeof POSITION_EXP_MULTIPLIER] || 1.0;

    // 경기 결과 보너스
    const resultBonus = RESULT_EXP_BONUS[matchResult] || 1.0;

    // 성과 보너스
    const performanceBonus = 1 + (PERFORMANCE_BONUS[performance] || 0);

    // 플레이 시간 팩터 (90분 기준)
    const timeFactor = minutesPlayed / 90;

    // 총 경험치
    const totalExp = Math.floor(baseExp * positionBonus * resultBonus * performanceBonus * timeFactor);

    // 레벨업 확인 (100 경험치 = 1 레벨)
    const newTotalExp = currentPlayer.experience + totalExp;
    const newLevel = Math.floor(newTotalExp / 100);
    const levelUp = newLevel > currentPlayer.level;
    const levelUps = newLevel - currentPlayer.level;

    let statIncreases: Record<string, number> = {};
    let newOvr = currentPlayer.ovr;

    if (levelUp && levelUps > 0) {
      // AI가 자동으로 올릴 스탯 결정
      const preferredStats = getAutoIncreaseStats(position, currentPlayer.personality);

      // 레벨업 횟수만큼 스탯 증가
      for (let i = 0; i < levelUps; i++) {
        // 우선순위에 따라 스탯 올림
        const stat = preferredStats[i % preferredStats.length].toLowerCase();

        if (!statIncreases[stat]) {
          statIncreases[stat] = 0;
        }

        // 최대값(200)을 넘지 않도록 확인
        const currentStat = currentPlayer[stat as keyof typeof currentPlayer] as number || 50;
        if (currentStat < 200) {
          statIncreases[stat]++;
        }
      }

      // DB 업데이트 쿼리 구성
      let updateQuery = 'UPDATE player_cards SET experience = ?, level = ?';
      const params: any[] = [newTotalExp, newLevel];

      if (statIncreases.mental) {
        updateQuery += ', mental = LEAST(mental + ?, 200)';
        params.push(statIncreases.mental);
      }
      if (statIncreases.teamfight) {
        updateQuery += ', teamfight = LEAST(teamfight + ?, 200)';
        params.push(statIncreases.teamfight);
      }
      if (statIncreases.focus) {
        updateQuery += ', focus = LEAST(focus + ?, 200)';
        params.push(statIncreases.focus);
      }
      if (statIncreases.laning) {
        updateQuery += ', laning = LEAST(laning + ?, 200)';
        params.push(statIncreases.laning);
      }

      updateQuery += ' WHERE id = ?';
      params.push(playerId);

      await pool.query(updateQuery, params);

      // OVR 재계산
      const updatedStats = await pool.query(
        'SELECT mental, teamfight, focus, laning FROM player_cards WHERE id = ?',
        [playerId]
      );

      if (updatedStats.length > 0) {
        newOvr = Math.round((updatedStats[0].mental + updatedStats[0].teamfight + updatedStats[0].focus + updatedStats[0].laning) / 4);
        newOvr = Math.min(99, newOvr);
        await pool.query('UPDATE player_cards SET ovr = ? WHERE id = ?', [newOvr, playerId]);
      }
    } else {
      // 레벨업 없음 - 경험치만 업데이트
      await pool.query(
        'UPDATE player_cards SET experience = ? WHERE id = ?',
        [newTotalExp, playerId]
      );
    }

    // 경험치 히스토리 기록
    await pool.query(
      `INSERT INTO player_experience_history (player_id, match_exp, level, recorded_at)
       VALUES (?, ?, ?, NOW())`,
      [playerId, totalExp, newLevel]
    );

    return {
      exp: totalExp,
      levelUp,
      newLevel,
      statIncreases: Object.keys(statIncreases).length > 0 ? statIncreases : undefined
    };
  } catch (error) {
    console.error('Error awarding player experience:', error);
    return { exp: 0, levelUp: false, newLevel: 0 };
  }
}

// 일괄 경기 경험치 지급
export async function awardMatchExperience(
  matchId: number,
  homeTeamId: number,
  awayTeamId: number,
  homeWon: boolean
): Promise<void> {
  try {
    // 경기 통계 조회
    const stats = await pool.query(
      `SELECT ms.*, pc.level, pc.experience, pc.ovr, pc.ai_position
       FROM match_stats ms
       JOIN player_cards pc ON ms.player_id = pc.id
       WHERE ms.match_id = ?`,
      [matchId]
    );

    for (const stat of stats) {
      // 팀별 승패 결정
      let matchResult: 'WIN' | 'DRAW' | 'LOSS' = 'DRAW';
      if ((stat.team_id === homeTeamId && homeWon) || (stat.team_id === awayTeamId && !homeWon)) {
        matchResult = 'WIN';
      } else if ((stat.team_id === homeTeamId && !homeWon) || (stat.team_id === awayTeamId && homeWon)) {
        matchResult = 'LOSS';
      }

      // 성과 평가 (KDA 기반)
      let performance: 'MVP' | 'EXCELLENT' | 'GOOD' | 'NORMAL' | 'POOR' = 'NORMAL';
      const kda = stat.kills + stat.assists - stat.deaths;

      if (kda >= 5) {
        performance = 'EXCELLENT';
      } else if (kda >= 2) {
        performance = 'GOOD';
      } else if (kda < -2) {
        performance = 'POOR';
      }

      // 경험치 지급
      await awardPlayerExperience(
        stat.player_id,
        stat.ai_position || stat.position || 'MID',
        matchResult,
        performance,
        stat.cs ? Math.min(90, Math.floor(stat.cs / 3)) : 90 // CS 기반 플레이 시간 추정
      );
    }
  } catch (error) {
    console.error('Error awarding match experience:', error);
  }
}
