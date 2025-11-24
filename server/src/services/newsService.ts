import pool from '../database/db.js';

export class NewsService {
  // 경기 하이라이트 뉴스 생성
  static async createMatchHighlight(
    matchId: number,
    highlightType: string,
    playerId: number | null,
    teamId: number
  ) {
    const team = await pool.query('SELECT name FROM teams WHERE id = ?', [teamId]);
    const teamName = team[0]?.name || '팀';

    let title = '';
    let content = '';

    if (playerId) {
      const player = await pool.query('SELECT name FROM pro_players WHERE id = ?', [playerId]);
      const playerName = player[0]?.name || '선수';

      switch (highlightType) {
        case 'MVP':
          title = `[MVP] ${playerName}, ${teamName}의 승리 이끌어`;
          content = `${teamName}의 ${playerName} 선수가 뛰어난 활약을 펼치며 MVP로 선정되었습니다. 팀의 승리에 결정적인 기여를 했습니다.`;
          break;
        case 'PENTAKILL':
          title = `[펜타킬] ${playerName}, 화려한 펜타킬 작성!`;
          content = `${teamName}의 ${playerName} 선수가 놀라운 펜타킬을 기록했습니다! 팬들의 환호 속에 팀이 승리를 거뒀습니다.`;
          break;
        case 'CARRY':
          title = `${playerName}, 원맨 캐리로 팀 구해`;
          content = `${teamName}의 ${playerName} 선수가 혼자서 팀을 이끌며 승리를 일궈냈습니다. 팀 전체 딜량의 40% 이상을 담당했습니다.`;
          break;
        default:
          title = `${teamName}, 멋진 경기력 선보여`;
          content = `${teamName}이(가) 인상적인 경기를 펼쳤습니다.`;
      }
    } else {
      switch (highlightType) {
        case 'COMEBACK':
          title = `[대역전] ${teamName}, 불리한 상황 뒤집고 승리!`;
          content = `${teamName}이(가) 불리했던 게임을 뒤집고 극적인 역전승을 거뒀습니다. 팬들에게 잊지 못할 명승부를 선사했습니다.`;
          break;
        case 'PERFECT_GAME':
          title = `[완벽한 경기] ${teamName}, 상대 완전 제압`;
          content = `${teamName}이(가) 상대팀을 완벽하게 제압하며 압도적인 승리를 거뒀습니다. 단 한 번의 죽음도 허용하지 않았습니다.`;
          break;
        case 'STOMP':
          title = `${teamName}, 압도적 경기력으로 빠른 승리`;
          content = `${teamName}이(가) 15분 만에 경기를 끝내며 압도적인 실력을 과시했습니다.`;
          break;
        default:
          title = `${teamName} 승리`;
          content = `${teamName}이(가) 승리를 거뒀습니다.`;
      }
    }

    await pool.query(
      `INSERT INTO news (news_type, title, content, team_id, player_id, match_id, highlight_type)
       VALUES ('MATCH_HIGHLIGHT', ?, ?, ?, ?, ?, ?)`,
      [title, content, teamId, playerId, matchId, highlightType]
    );
  }

  // 선수 불화 뉴스 생성
  static async createPlayerConflict(playerId: number, teamId: number, conflictType: string) {
    const player = await pool.query('SELECT name FROM pro_players WHERE id = ?', [playerId]);
    const team = await pool.query('SELECT name FROM teams WHERE id = ?', [teamId]);
    const playerName = player[0]?.name || '선수';
    const teamName = team[0]?.name || '팀';

    let title = '';
    let content = '';

    switch (conflictType) {
      case 'SALARY_DISPUTE':
        title = `${playerName}, ${teamName}와 연봉 협상 난항`;
        content = `${teamName} 소속 ${playerName} 선수가 구단과 연봉 협상에서 의견 차이를 보이고 있는 것으로 알려졌습니다. 양측의 입장 차이가 좁혀지지 않으면 이적 가능성도 점쳐지고 있습니다.`;
        break;
      case 'BENCHED':
        title = `${playerName}, ${teamName}에서 벤치 신세`;
        content = `${teamName}의 ${playerName} 선수가 최근 경기에 출전하지 못하고 벤치를 지키고 있습니다. 팀 내 경쟁에서 밀린 것으로 보입니다.`;
        break;
      case 'INTERNAL_CONFLICT':
        title = `[단독] ${teamName} 내부 갈등설, ${playerName} 연루`;
        content = `${teamName}에서 팀원 간 갈등이 있다는 소식이 전해졌습니다. ${playerName} 선수가 관련되어 있다는 루머가 돌고 있으나, 구단 측은 아직 공식 입장을 밝히지 않았습니다.`;
        break;
      case 'POOR_PERFORMANCE':
        title = `${playerName}, 부진 지속... 팬들 우려`;
        content = `${teamName}의 ${playerName} 선수가 최근 경기에서 부진한 성적을 보이고 있습니다. 팬들 사이에서 우려의 목소리가 높아지고 있습니다.`;
        break;
      default:
        title = `${teamName}에서 ${playerName} 관련 소식`;
        content = `${teamName}의 ${playerName} 선수와 관련된 소식이 전해졌습니다.`;
    }

    await pool.query(
      `INSERT INTO news (news_type, title, content, team_id, player_id)
       VALUES ('PLAYER_CONFLICT', ?, ?, ?, ?)`,
      [title, content, teamId, playerId]
    );
  }

  // 이적 루머 생성
  static async createTransferRumor(
    playerId: number,
    sourceTeamId: number | null,
    targetTeamId: number,
    credibility: number = 50
  ) {
    const player = await pool.query('SELECT name FROM pro_players WHERE id = ?', [playerId]);
    const targetTeam = await pool.query('SELECT name FROM teams WHERE id = ?', [targetTeamId]);
    const playerName = player[0]?.name || '선수';
    const targetTeamName = targetTeam[0]?.name || '팀';

    let sourceTeamName = 'FA';
    if (sourceTeamId) {
      const sourceTeam = await pool.query('SELECT name FROM teams WHERE id = ?', [sourceTeamId]);
      sourceTeamName = sourceTeam[0]?.name || '팀';
    }

    const rumors = [
      `${playerName}, ${targetTeamName} 이적설 솔솔`,
      `[루머] ${targetTeamName}, ${playerName} 영입 관심`,
      `${playerName} ${targetTeamName} 행? 업계 관계자 "접촉 중"`,
      `${targetTeamName}, ${playerName} 영입 위해 물밑 협상 중`,
    ];

    const title = rumors[Math.floor(Math.random() * rumors.length)];

    let content = '';
    if (sourceTeamId) {
      content = `${sourceTeamName} 소속 ${playerName} 선수가 ${targetTeamName}으로 이적할 가능성이 제기되고 있습니다. 관계자에 따르면 양 구단 간 접촉이 있었다고 합니다. 다만 아직 협상 초기 단계로, 성사 여부는 불투명합니다.`;
    } else {
      content = `FA 상태인 ${playerName} 선수에게 ${targetTeamName}이(가) 관심을 보이고 있는 것으로 알려졌습니다. 구단 측에서 먼저 연락을 취했다는 루머가 돌고 있습니다.`;
    }

    const result = await pool.query(
      `INSERT INTO news (news_type, title, content, player_id, source_team_id, target_team_id, credibility)
       VALUES ('TRANSFER_RUMOR', ?, ?, ?, ?, ?, ?)`,
      [title, content, playerId, sourceTeamId, targetTeamId, credibility]
    );

    return result.insertId;
  }

  // 이적 공식 발표
  static async createTransferOfficial(
    playerId: number,
    sourceTeamId: number | null,
    targetTeamId: number,
    rumorId: number | null = null
  ) {
    const player = await pool.query('SELECT name FROM pro_players WHERE id = ?', [playerId]);
    const targetTeam = await pool.query('SELECT name FROM teams WHERE id = ?', [targetTeamId]);
    const playerName = player[0]?.name || '선수';
    const targetTeamName = targetTeam[0]?.name || '팀';

    let sourceTeamName = 'FA';
    if (sourceTeamId) {
      const sourceTeam = await pool.query('SELECT name FROM teams WHERE id = ?', [sourceTeamId]);
      sourceTeamName = sourceTeam[0]?.name || '팀';
    }

    const title = `[오피셜] ${playerName}, ${targetTeamName} 입단`;

    let content = '';
    if (sourceTeamId) {
      content = `${targetTeamName}이(가) ${sourceTeamName} 출신 ${playerName} 선수의 영입을 공식 발표했습니다. "${playerName} 선수와 함께 더 높은 목표를 향해 나아가겠습니다"라고 구단 측은 밝혔습니다.`;
    } else {
      content = `${targetTeamName}이(가) FA ${playerName} 선수와 계약을 체결했습니다. ${playerName} 선수는 "좋은 기회를 주셔서 감사하다"며 포부를 밝혔습니다.`;
    }

    await pool.query(
      `INSERT INTO news (news_type, title, content, player_id, source_team_id, target_team_id, rumor_id)
       VALUES ('TRANSFER_OFFICIAL', ?, ?, ?, ?, ?, ?)`,
      [title, content, playerId, sourceTeamId, targetTeamId, rumorId]
    );
  }

  // 리그 뉴스 생성
  static async createLeagueNews(title: string, content: string, teamId: number | null = null) {
    await pool.query(
      `INSERT INTO news (news_type, title, content, team_id)
       VALUES ('LEAGUE_NEWS', ?, ?, ?)`,
      [title, content, teamId]
    );
  }

  // 팀 뉴스 생성
  static async createTeamNews(title: string, content: string, teamId: number) {
    await pool.query(
      `INSERT INTO news (news_type, title, content, team_id)
       VALUES ('TEAM_NEWS', ?, ?, ?)`,
      [title, content, teamId]
    );
  }

  // 경기 결과 기반 자동 뉴스 생성
  static async generateMatchNews(matchId: number, winnerId: number, loserId: number, winnerScore: number, loserScore: number) {
    // 압도적 승리 (3-0)
    if (winnerScore === 3 && loserScore === 0) {
      await this.createMatchHighlight(matchId, 'STOMP', null, winnerId);
    }
    // 역전승 (상대가 먼저 2점 앞섰다가 역전)
    else if (winnerScore === 3 && loserScore === 2) {
      await this.createMatchHighlight(matchId, 'COMEBACK', null, winnerId);
    }
    // 일반 승리
    else {
      // 20% 확률로 뉴스 생성
      if (Math.random() < 0.2) {
        await this.createMatchHighlight(matchId, 'MATCH_WIN', null, winnerId);
      }
    }
  }

  // 랜덤 루머 생성 (스케줄러용)
  static async generateRandomRumor() {
    // FA 선수 중 한 명 선택
    const faPlayers = await pool.query(
      `SELECT pp.id, pp.name FROM pro_players pp
       WHERE NOT EXISTS (
         SELECT 1 FROM player_cards pc WHERE pc.pro_player_id = pp.id AND pc.is_contracted = true
       )
       ORDER BY RAND() LIMIT 1`
    );

    if (faPlayers.length === 0) return;

    // 랜덤 팀 선택
    const teams = await pool.query(
      `SELECT id, name FROM teams WHERE is_ai = false ORDER BY RAND() LIMIT 1`
    );

    if (teams.length === 0) return;

    const credibility = Math.floor(Math.random() * 60) + 20; // 20-80
    await this.createTransferRumor(faPlayers[0].id, null, teams[0].id, credibility);
  }

  // 랜덤 선수 불화 생성
  static async generateRandomConflict() {
    // 계약된 선수 중 한 명 선택
    const players = await pool.query(
      `SELECT pc.pro_player_id, pc.team_id FROM player_cards pc
       WHERE pc.is_contracted = true AND pc.pro_player_id IS NOT NULL
       ORDER BY RAND() LIMIT 1`
    );

    if (players.length === 0) return;

    const conflictTypes = ['SALARY_DISPUTE', 'BENCHED', 'POOR_PERFORMANCE'];
    const conflictType = conflictTypes[Math.floor(Math.random() * conflictTypes.length)];

    await this.createPlayerConflict(players[0].pro_player_id, players[0].team_id, conflictType);
  }
}

export default NewsService;
