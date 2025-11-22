import pool from '../database/db.js';

// AI 팀 이름 목록 (32팀)
const AI_TEAM_NAMES = [
  // Esports가 들어가는 팀 (10팀)
  'Dragon Esports',
  'Phoenix Esports',
  'Thunder Esports',
  'Titan Esports',
  'Storm Esports',
  'Shadow Esports',
  'Blaze Esports',
  'Frost Esports',
  'Nova Esports',
  'Apex Esports',
  // 나머지 팀 (22팀)
  'Golden Lions',
  'Silver Knights',
  'Dark Ravens',
  'White Tigers',
  'Blue Dolphins',
  'Red Wolves',
  'Green Vipers',
  'Black Panthers',
  'Sky Hawks',
  'Ocean Sharks',
  'Mountain Bears',
  'Desert Foxes',
  'Iron Giants',
  'Crystal Dragons',
  'Neon Ninjas',
  'Cyber Samurai',
  'Royal Guard',
  'Elite Force',
  'Prime Legion',
  'Victory Squad',
  'Glory Hunters',
  'Rising Stars'
];

export class LPOLeagueService {
  // LPO 리그 초기화 (AI 팀 생성 포함)
  static async initializeLPOLeagues() {
    try {
      console.log('Initializing LPO League system...');

      // AI 시스템 유저 확인/생성
      let aiUser = await pool.query('SELECT id FROM users WHERE username = ?', ['AI_SYSTEM']);
      let aiUserId: number;

      if (aiUser.length === 0) {
        const result = await pool.query(
          'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
          ['AI_SYSTEM', 'not_a_real_password', 'ai@system.local']
        );
        aiUserId = result.insertId;
      } else {
        aiUserId = aiUser[0].id;
      }

      // 기존 LPO 리그 확인
      const existingLeagues = await pool.query(
        "SELECT * FROM leagues WHERE name LIKE 'LPO%' AND season = 1"
      );

      if (existingLeagues.length >= 3) {
        console.log('LPO Leagues already exist');
        return;
      }

      // LPO 리그 생성
      const superLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO SUPER LEAGUE', 'SUPER', 1, 1, 'REGULAR')"
      );
      const firstLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO 1 LEAGUE', 'FIRST', 1, 1, 'REGULAR')"
      );
      const secondLeague = await pool.query(
        "INSERT INTO leagues (name, region, season, current_month, status) VALUES ('LPO 2 LEAGUE', 'SECOND', 1, 1, 'REGULAR')"
      );

      // AI 팀 생성 및 리그 배정
      // SUPER: 10팀, FIRST: 10팀, SECOND: 12팀
      const tiers = [
        { leagueId: superLeague.insertId, tier: 'SUPER', count: 10, startIdx: 0 },
        { leagueId: firstLeague.insertId, tier: 'FIRST', count: 10, startIdx: 10 },
        { leagueId: secondLeague.insertId, tier: 'SECOND', count: 12, startIdx: 20 }
      ];

      for (const tierInfo of tiers) {
        for (let i = 0; i < tierInfo.count; i++) {
          const teamName = AI_TEAM_NAMES[tierInfo.startIdx + i];

          // AI 팀 생성
          const teamResult = await pool.query(
            `INSERT INTO teams (user_id, name, league, is_ai, gold, diamond, fan_count)
             VALUES (?, ?, ?, true, 100000, 100, 1000)`,
            [aiUserId, teamName, tierInfo.tier]
          );

          const teamId = teamResult.insertId;

          // AI 선수 5명 생성 (스타터)
          await this.createAIPlayers(teamId, tierInfo.tier);

          // 리그 참가
          await pool.query(
            `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
             VALUES (?, ?, 0, 0, 0, 0, 0)`,
            [tierInfo.leagueId, teamId]
          );
        }
      }

      console.log('LPO League system initialized successfully!');
      console.log('- LPO SUPER LEAGUE: 10 AI teams');
      console.log('- LPO 1 LEAGUE: 10 AI teams');
      console.log('- LPO 2 LEAGUE: 12 AI teams');

    } catch (error) {
      console.error('Failed to initialize LPO leagues:', error);
      throw error;
    }
  }

  // AI 선수 생성
  static async createAIPlayers(teamId: number, tier: string) {
    const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

    // 티어별 스탯 범위
    const statRanges: { [key: string]: { min: number; max: number } } = {
      'SUPER': { min: 60, max: 85 },
      'FIRST': { min: 45, max: 70 },
      'SECOND': { min: 30, max: 55 }
    };

    const range = statRanges[tier] || statRanges['SECOND'];

    for (const position of positions) {
      const name = this.generatePlayerName();
      const mental = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const teamfight = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const focus = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const laning = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

      // 선수 생성
      const playerResult = await pool.query(
        `INSERT INTO players (name, position, mental, teamfight, focus, laning)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, position, mental, teamfight, focus, laning]
      );

      // 팀에 배정 (스타터로)
      await pool.query(
        `INSERT INTO player_ownership (player_id, team_id, is_starter) VALUES (?, ?, true)`,
        [playerResult.insertId, teamId]
      );
    }
  }

  // 랜덤 선수 이름 생성
  static generatePlayerName(): string {
    const firstNames = [
      'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim',
      'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang', 'An', 'Song', 'Ryu', 'Hong'
    ];
    const nicknames = [
      'Faker', 'Chovy', 'Ruler', 'Keria', 'Zeus', 'Oner', 'Canyon', 'ShowMaker',
      'Viper', 'Beryl', 'Deft', 'Lehends', 'Peanut', 'Bdd', 'Prince', 'Peyz',
      'Gumayusi', 'Teddy', 'Cuzz', 'Canna', 'Doran', 'Pyosik', 'Zeka', 'Delight',
      'Morgan', 'Croco', 'Fate', 'Mystic', 'Kellin', 'Effort', 'Ellim', 'Willer'
    ];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const nickname = nicknames[Math.floor(Math.random() * nicknames.length)];

    return `${firstName} '${nickname}'`;
  }

  // 플레이어 팀이 AI 팀을 대체
  static async replaceAITeam(playerTeamId: number) {
    try {
      // 플레이어 팀 정보 확인
      const playerTeam = await pool.query('SELECT * FROM teams WHERE id = ? AND is_ai = false', [playerTeamId]);
      if (playerTeam.length === 0) {
        throw new Error('Player team not found');
      }

      // LPO 2 LEAGUE에서 가장 낮은 순위의 AI 팀 찾기
      const aiTeam = await pool.query(
        `SELECT t.id, t.name, lp.league_id, lp.wins, lp.losses, lp.draws, lp.points, lp.goal_difference
         FROM teams t
         JOIN league_participants lp ON t.id = lp.team_id
         JOIN leagues l ON lp.league_id = l.id
         WHERE t.is_ai = true AND l.region = 'SECOND'
         ORDER BY lp.points ASC, lp.goal_difference ASC
         LIMIT 1`
      );

      if (aiTeam.length === 0) {
        throw new Error('No AI team available in LPO 2 LEAGUE');
      }

      const targetAI = aiTeam[0];

      // AI 팀 교체 기록 저장
      await pool.query(
        `INSERT INTO ai_team_replacements
         (ai_team_id, player_team_id, league_id, wins, losses, draws, points, goal_difference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [targetAI.id, playerTeamId, targetAI.league_id,
         targetAI.wins, targetAI.losses, targetAI.draws, targetAI.points, targetAI.goal_difference]
      );

      // 플레이어 팀의 tier를 SECOND로 변경
      await pool.query('UPDATE teams SET league = ? WHERE id = ?', ['SECOND', playerTeamId]);

      // AI 팀을 리그에서 제거
      await pool.query('DELETE FROM league_participants WHERE team_id = ?', [targetAI.id]);

      // 플레이어 팀을 리그에 추가 (AI 팀의 성적 그대로)
      await pool.query(
        `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [targetAI.league_id, playerTeamId,
         targetAI.wins, targetAI.losses, targetAI.draws, targetAI.points, targetAI.goal_difference]
      );

      console.log(`Player team ${playerTeamId} replaced AI team ${targetAI.name} in LPO 2 LEAGUE`);

      return {
        success: true,
        replacedTeam: targetAI.name,
        inheritedStats: {
          wins: targetAI.wins,
          losses: targetAI.losses,
          draws: targetAI.draws,
          points: targetAI.points
        }
      };

    } catch (error) {
      console.error('Failed to replace AI team:', error);
      throw error;
    }
  }

  // 승강제 처리
  static async processPromotionRelegation(season: number) {
    try {
      // 각 리그의 순위 계산
      const tiers = ['SUPER', 'FIRST', 'SECOND'];

      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];

        // 해당 티어 리그 조회
        const league = await pool.query(
          "SELECT id FROM leagues WHERE region = ? AND season = ?",
          [tier, season]
        );

        if (league.length === 0) continue;

        // 순위 정렬
        const standings = await pool.query(
          `SELECT lp.team_id, lp.points, lp.goal_difference, t.is_ai
           FROM league_participants lp
           JOIN teams t ON lp.team_id = t.id
           WHERE lp.league_id = ?
           ORDER BY lp.points DESC, lp.goal_difference DESC`,
          [league[0].id]
        );

        // 강등 (SUPER, FIRST만 - 하위 2팀)
        if (tier !== 'SECOND' && standings.length >= 2) {
          const relegatedTeams = standings.slice(-2);
          const lowerTier = tier === 'SUPER' ? 'FIRST' : 'SECOND';

          for (const team of relegatedTeams) {
            await pool.query(
              `INSERT INTO promotions_relegations (season, team_id, from_tier, to_tier, type)
               VALUES (?, ?, ?, ?, 'RELEGATION')`,
              [season, team.team_id, tier, lowerTier]
            );

            // 팀 티어 변경
            await pool.query('UPDATE teams SET league = ? WHERE id = ?', [lowerTier, team.team_id]);
          }
        }

        // 승격 (FIRST, SECOND만 - 상위 2팀)
        if (tier !== 'SUPER' && standings.length >= 2) {
          const promotedTeams = standings.slice(0, 2);
          const upperTier = tier === 'FIRST' ? 'SUPER' : 'FIRST';

          for (const team of promotedTeams) {
            await pool.query(
              `INSERT INTO promotions_relegations (season, team_id, from_tier, to_tier, type)
               VALUES (?, ?, ?, ?, 'PROMOTION')`,
              [season, team.team_id, tier, upperTier]
            );

            // 팀 티어 변경
            await pool.query('UPDATE teams SET league = ? WHERE id = ?', [upperTier, team.team_id]);
          }
        }
      }

      console.log(`Promotion/Relegation processed for season ${season}`);

    } catch (error) {
      console.error('Failed to process promotion/relegation:', error);
      throw error;
    }
  }

  // 다음 시즌 시작
  static async startNewSeason(currentSeason: number) {
    try {
      const newSeason = currentSeason + 1;

      // 승강제 먼저 처리
      await this.processPromotionRelegation(currentSeason);

      // 기존 리그 종료
      await pool.query(
        "UPDATE leagues SET status = 'OFFSEASON' WHERE season = ?",
        [currentSeason]
      );

      // 새 리그 생성
      const tiers = [
        { name: 'LPO SUPER LEAGUE', region: 'SUPER' },
        { name: 'LPO 1 LEAGUE', region: 'FIRST' },
        { name: 'LPO 2 LEAGUE', region: 'SECOND' }
      ];

      for (const tier of tiers) {
        const leagueResult = await pool.query(
          "INSERT INTO leagues (name, region, season, current_month, status) VALUES (?, ?, ?, 1, 'REGULAR')",
          [tier.name, tier.region, newSeason]
        );

        // 해당 티어 팀들을 새 리그에 등록
        const teams = await pool.query(
          'SELECT id FROM teams WHERE league = ?',
          [tier.region]
        );

        for (const team of teams) {
          await pool.query(
            `INSERT INTO league_participants (league_id, team_id, wins, losses, draws, points, goal_difference)
             VALUES (?, ?, 0, 0, 0, 0, 0)`,
            [leagueResult.insertId, team.id]
          );
        }
      }

      console.log(`Season ${newSeason} started!`);

    } catch (error) {
      console.error('Failed to start new season:', error);
      throw error;
    }
  }
}

export default LPOLeagueService;
