import pool from '../database/db.js';

// 자동 리그 경기 실행 서비스
export class LeagueMatchService {
  private static intervalId: NodeJS.Timeout | null = null;

  // 서비스 시작 (1분마다 체크)
  static start() {
    console.log('League match service started');
    this.intervalId = setInterval(() => {
      this.checkAndRunMatches();
    }, 60000); // 1분마다 체크

    // 시작 시 즉시 한 번 체크
    this.checkAndRunMatches();
  }

  // 서비스 중지
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // 예정된 경기 체크 및 실행
  static async checkAndRunMatches() {
    try {
      const now = new Date();

      // 예정 시간이 지난 SCHEDULED 경기 조회
      const pendingMatches = await pool.query(
        `SELECT lm.*, l.name as league_name
         FROM league_matches lm
         JOIN leagues l ON lm.league_id = l.id
         WHERE lm.status = 'SCHEDULED' AND lm.scheduled_at <= ?
         ORDER BY lm.scheduled_at
         LIMIT 5`,
        [now]
      );

      for (const match of pendingMatches) {
        await this.simulateMatch(match);
      }
    } catch (error) {
      console.error('Check matches error:', error);
    }
  }

  // 경기 시뮬레이션
  static async simulateMatch(match: any) {
    try {
      // 경기 진행 중으로 변경
      await pool.query(
        `UPDATE league_matches SET status = 'IN_PROGRESS' WHERE id = ?`,
        [match.id]
      );

      // 양 팀 선수 오버롤 합계 조회
      const homeTeam = await this.getTeamPower(match.home_team_id);
      const awayTeam = await this.getTeamPower(match.away_team_id);

      // 점수 계산 (팀 파워 + 랜덤)
      const homeAdvantage = 5; // 홈 어드밴티지
      const homePower = homeTeam.totalPower + homeAdvantage;
      const awayPower = awayTeam.totalPower;

      // 점수 생성 (0-3점)
      let homeScore = 0;
      let awayScore = 0;

      // 3세트 경기
      for (let i = 0; i < 3; i++) {
        const homeRoll = Math.random() * homePower;
        const awayRoll = Math.random() * awayPower;

        if (homeRoll > awayRoll) {
          homeScore++;
        } else {
          awayScore++;
        }

        // 2승 선승제
        if (homeScore === 2 || awayScore === 2) break;
      }

      // 경기 결과 저장
      await pool.query(
        `UPDATE league_matches
         SET home_score = ?, away_score = ?, status = 'FINISHED', finished_at = NOW()
         WHERE id = ?`,
        [homeScore, awayScore, match.id]
      );

      // 리그 순위 업데이트
      const winnerId = homeScore > awayScore ? match.home_team_id : match.away_team_id;
      const loserId = homeScore > awayScore ? match.away_team_id : match.home_team_id;

      await pool.query(
        `UPDATE league_standings
         SET wins = wins + 1, points = points + 3
         WHERE league_id = ? AND team_id = ?`,
        [match.league_id, winnerId]
      );

      await pool.query(
        `UPDATE league_standings
         SET losses = losses + 1
         WHERE league_id = ? AND team_id = ?`,
        [match.league_id, loserId]
      );

      console.log(`Match ${match.id}: ${homeScore}-${awayScore}`);
    } catch (error) {
      console.error(`Simulate match ${match.id} error:`, error);
    }
  }

  // 팀 전력 계산
  static async getTeamPower(teamId: number): Promise<{ totalPower: number }> {
    try {
      // 스타터 선수들의 오버롤 합계
      const players = await pool.query(
        `SELECT SUM(mental + teamfight + focus + laning) as total_power
         FROM players
         WHERE team_id = ? AND is_starter = true`,
        [teamId]
      );

      return {
        totalPower: players[0]?.total_power || 100
      };
    } catch (error) {
      return { totalPower: 100 };
    }
  }

  // 특정 경기 관전 데이터 조회
  static async getMatchDetails(matchId: number) {
    const match = await pool.query(
      `SELECT lm.*,
              ht.name as home_team_name,
              at.name as away_team_name,
              l.name as league_name
       FROM league_matches lm
       JOIN teams ht ON lm.home_team_id = ht.id
       JOIN teams at ON lm.away_team_id = at.id
       JOIN leagues l ON lm.league_id = l.id
       WHERE lm.id = ?`,
      [matchId]
    );

    if (match.length === 0) return null;

    // 양 팀 스타터 정보
    const homePlayers = await pool.query(
      `SELECT id, name, position, mental, teamfight, focus, laning,
              (mental + teamfight + focus + laning) as overall
       FROM players
       WHERE team_id = ? AND is_starter = true
       ORDER BY FIELD(position, 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')`,
      [match[0].home_team_id]
    );

    const awayPlayers = await pool.query(
      `SELECT id, name, position, mental, teamfight, focus, laning,
              (mental + teamfight + focus + laning) as overall
       FROM players
       WHERE team_id = ? AND is_starter = true
       ORDER BY FIELD(position, 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')`,
      [match[0].away_team_id]
    );

    return {
      ...match[0],
      home_players: homePlayers,
      away_players: awayPlayers
    };
  }
}

// 서비스 초기화 함수
export function initializeLeagueMatchService() {
  LeagueMatchService.start();
}

export default LeagueMatchService;
