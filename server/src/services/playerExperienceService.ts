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

// 선수별 경기 경험치 획득
export async function awardPlayerExperience(
  playerId: number,
  position: string,
  matchResult: 'WIN' | 'DRAW' | 'LOSS',
  performance: 'MVP' | 'EXCELLENT' | 'GOOD' | 'NORMAL' | 'POOR' = 'NORMAL',
  minutesPlayed: number = 90
): Promise<{ exp: number; levelUp: boolean; newLevel: number }> {
  try {
    const player = await pool.query(
      'SELECT level, experience, ovr FROM player_cards WHERE id = ?',
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

    // 플레이어 능력치 약간 증가 (경험 누적)
    let ovrIncrease = 0;
    if (levelUp) {
      // 레벨업할 때마다 OVR +1
      ovrIncrease = newLevel - currentPlayer.level;
    }

    const newOvr = Math.min(99, currentPlayer.ovr + ovrIncrease);

    // 업데이트
    await pool.query(
      `UPDATE player_cards
       SET experience = ?, level = ?, ovr = ?
       WHERE id = ?`,
      [newTotalExp, newLevel, newOvr, playerId]
    );

    // 경험치 히스토리 기록
    await pool.query(
      `INSERT INTO player_experience_history (player_id, match_exp, level, recorded_at)
       VALUES (?, ?, ?, NOW())`,
      [playerId, totalExp, newLevel]
    );

    return {
      exp: totalExp,
      levelUp,
      newLevel
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
