import pool from '../database/db.js';

// 커뮤니티 닉네임 생성
const COMMUNITY_NICKNAMES = [
  '야구갤러', '롤갤러', '에펨갤러', '풋볼매니저', '게임러', '아재',
  '찐팬', '안티팬', '관종', '아이언', '브론즈', '실버', '골드러',
  '다이아', '마스터', '챌린저', '기자놀이', '분석가', '해설위원',
  '전적검색러', '팀킬러', '피지컬', '멘탈', '롤창', '겜창', '통계충'
];

const getRandomNickname = () => {
  const base = COMMUNITY_NICKNAMES[Math.floor(Math.random() * COMMUNITY_NICKNAMES.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${base}${num}`;
};

const getRandomViews = () => Math.floor(Math.random() * 5000) + 100;
const getRandomComments = () => Math.floor(Math.random() * 200);
const getRandomLikes = () => Math.floor(Math.random() * 500);

export class NewsService {
  // 커뮤니티 스타일 글 생성 (모든 행동에 대해)
  static async createCommunityPost(
    teamId: number,
    actionType: string,
    details: any = {}
  ) {
    const team = await pool.query('SELECT name FROM teams WHERE id = ?', [teamId]);
    const teamName = team[0]?.name || '어떤팀';

    let title = '';
    let content = '';
    let newsType = 'COMMUNITY';

    // 행동 유형별 커뮤니티 스타일 제목과 내용 생성
    switch (actionType) {
      case 'TRAINING':
        const trainTitles = [
          `${teamName} 훈련 ㅋㅋㅋ 이거 실화냐`,
          `와 ${teamName} 진짜 열심히 하네`,
          `${teamName} 선수들 훈련하는거 봄?`,
          `[속보] ${teamName} 오늘도 훈련 중`,
          `${teamName} 훈련 근황.jpg`,
        ];
        title = trainTitles[Math.floor(Math.random() * trainTitles.length)];
        content = details.playerName
          ? `${details.playerName} 선수가 ${details.statType} 훈련함 ㅋㅋ\n스탯 +${details.statIncrease || 1} 올랐다고 함\n\n진짜 노력하네 ㄷㄷ`
          : `${teamName} 팀 전체 훈련 중임\n요즘 열심히 하는듯`;
        break;

      case 'STREAMING':
        const streamTitles = [
          `${details.playerName || '선수'} 방송 킴 ㅋㅋㅋ`,
          `와 ${details.playerName} 스트리밍 레전드`,
          `[실시간] ${teamName} ${details.playerName} 방송 중`,
          `${details.playerName} 팬들 모여라`,
          `${details.playerName} 오늘 방송 ${details.duration}시간 함`,
        ];
        title = streamTitles[Math.floor(Math.random() * streamTitles.length)];
        content = `시청자 ${details.viewers?.toLocaleString() || '???'}명 모임\n수익 ${details.income?.toLocaleString() || '???'}원\n\n팬들 열광 중 ㅋㅋㅋ`;
        break;

      case 'FAN_EVENT':
        const eventTitles = [
          `${teamName} ${details.eventType} 개최함`,
          `와 ${teamName} 팬 이벤트 ㄷㄷ`,
          `${teamName} 팬미팅 후기`,
          `[후기] ${teamName} 이벤트 다녀옴`,
        ];
        title = eventTitles[Math.floor(Math.random() * eventTitles.length)];
        content = `비용: ${details.cost?.toLocaleString() || '???'}원\n남팬 +${details.maleFans || 0}, 여팬 +${details.femaleFans || 0}\n\n팬들 좋아 죽는다 ㅋㅋ`;
        break;

      case 'TRANSFER':
        const transferTitles = [
          `${teamName} ${details.playerName} 영입 ㄷㄷㄷ`,
          `와 ${details.playerName} ${teamName} 감?`,
          `[오피셜] ${details.playerName} → ${teamName}`,
          `${teamName} 이적시장 열일 중`,
          `${details.playerName} ${teamName} 오심 ㅋㅋ`,
        ];
        title = transferTitles[Math.floor(Math.random() * transferTitles.length)];
        content = `연봉: ${details.salary?.toLocaleString() || '???'}원\n\n이거 잘한거임? 못한거임?\n댓글로 토론 ㄱㄱ`;
        newsType = 'TRANSFER_OFFICIAL';
        break;

      case 'MATCH_WIN':
        const winTitles = [
          `${teamName} 이겼다 ㅋㅋㅋㅋ`,
          `와 ${teamName} 존나 잘하네`,
          `${teamName} vs ${details.opponent} 승리`,
          `[경기결과] ${teamName} ${details.score}`,
          `${teamName} 오늘 컨디션 ㄹㅇ 좋았음`,
        ];
        title = winTitles[Math.floor(Math.random() * winTitles.length)];
        content = `상대: ${details.opponent || '상대팀'}\n스코어: ${details.score || '???'}\n\n오늘 개잘함 ㄹㅇ`;
        newsType = 'MATCH_HIGHLIGHT';
        break;

      case 'MATCH_LOSE':
        const loseTitles = [
          `${teamName} 졌다...`,
          `${teamName} 왜 이럼 ㅠㅠ`,
          `[경기결과] ${teamName} 패배`,
          `${teamName} 오늘 폼 최악`,
          `${teamName} 팬들 멘탈 터짐`,
        ];
        title = loseTitles[Math.floor(Math.random() * loseTitles.length)];
        content = `상대: ${details.opponent || '상대팀'}\n스코어: ${details.score || '???'}\n\n왜 졌냐고... 진짜...`;
        newsType = 'MATCH_HIGHLIGHT';
        break;

      case 'CARD_PACK':
        const packTitles = [
          `${teamName} 카드팩 깜 ㅋㅋ`,
          `와 이거 뭐가 나옴?`,
          `[운빨] ${teamName} 카드팩 결과`,
          `카드팩 개봉기`,
        ];
        title = packTitles[Math.floor(Math.random() * packTitles.length)];
        content = details.playerName
          ? `${details.playerName} 나옴!\n등급: ${details.grade || 'NORMAL'}\nOVR: ${details.ovr || '???'}\n\n${details.grade === 'LEGEND' ? '개쩐다 ㄷㄷ' : '음... 그럭저럭?'}`
          : '카드팩 열어봄';
        newsType = 'TEAM_NEWS';
        break;

      case 'SPONSOR':
        const sponsorTitles = [
          `${teamName} 스폰서 계약함`,
          `와 ${teamName} 돈 벌었다`,
          `[스폰서] ${teamName} ${details.sponsorName}과 계약`,
          `${teamName} 스폰서 근황`,
        ];
        title = sponsorTitles[Math.floor(Math.random() * sponsorTitles.length)];
        content = `스폰서: ${details.sponsorName || '???'}\n계약금: ${details.amount?.toLocaleString() || '???'}원\n\n돈 좀 버네 ㅋㅋ`;
        newsType = 'TEAM_NEWS';
        break;

      case 'FACILITY':
        const facilityTitles = [
          `${teamName} 시설 업그레이드함`,
          `${teamName} 돈 쓰는거 보소`,
          `[시설] ${teamName} ${details.facilityName} 업그레이드`,
        ];
        title = facilityTitles[Math.floor(Math.random() * facilityTitles.length)];
        content = `${details.facilityName || '시설'} Lv.${details.level || '???'}\n비용: ${details.cost?.toLocaleString() || '???'}원\n\n돈 많네 ㅋㅋ`;
        newsType = 'TEAM_NEWS';
        break;

      default:
        title = `${teamName} 근황`;
        content = `${teamName}에서 뭔가 했음`;
        newsType = 'TEAM_NEWS';
    }

    // 커뮤니티 메타데이터 추가
    const author = getRandomNickname();
    const views = getRandomViews();
    const comments = getRandomComments();
    const likes = getRandomLikes();

    await pool.query(
      `INSERT INTO news (news_type, title, content, team_id, author_nickname, view_count, comment_count, like_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newsType, title, content, teamId, author, views, comments, likes]
    );
  }

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

  // 자동 뉴스 생성 (모든 팀에 대해 일정 주기마다 실행)
  static async generateAutoNews() {
    try {
      // 모든 플레이어팀 조회
      const teams = await pool.query('SELECT id FROM teams WHERE is_ai = false');

      if (teams.length === 0) return;

      // 각 팀에 대해 랜덤 뉴스 생성
      for (const team of teams) {
        const newsTypes = [
          'training',      // 훈련
          'streaming',     // 방송
          'facility',      // 시설 업그레이드
          'sponsor',       // 스폰서
          'card_pack'      // 카드팩
        ];

        // 60% 확률로 일반 뉴스 생성
        if (Math.random() < 0.6) {
          const newsType = newsTypes[Math.floor(Math.random() * newsTypes.length)];

          switch (newsType) {
            case 'training':
              // 팀의 계약 선수 중 한 명 선택
              const players = await pool.query(
                `SELECT p.id, p.name, s.mental, s.teamfight, s.focus, s.laning
                 FROM player_cards pc
                 JOIN pro_players p ON pc.pro_player_id = p.id
                 WHERE pc.team_id = ? AND pc.is_contracted = true
                 ORDER BY RAND() LIMIT 1`,
                [team.id]
              );

              if (players.length > 0) {
                const stats = ['mental', 'teamfight', 'focus', 'laning'];
                const statType = stats[Math.floor(Math.random() * stats.length)];

                await this.createCommunityPost(team.id, 'TRAINING', {
                  playerName: players[0].name,
                  statType: statType,
                  statIncrease: 1 + Math.floor(Math.random() * 3)
                });
              }
              break;

            case 'streaming':
              const streamers = await pool.query(
                `SELECT p.name FROM player_cards pc
                 JOIN pro_players p ON pc.pro_player_id = p.id
                 WHERE pc.team_id = ? AND pc.is_contracted = true
                 ORDER BY RAND() LIMIT 1`,
                [team.id]
              );

              if (streamers.length > 0) {
                await this.createCommunityPost(team.id, 'STREAMING', {
                  playerName: streamers[0].name,
                  viewers: 1000 + Math.floor(Math.random() * 5000),
                  income: 100000 + Math.floor(Math.random() * 500000),
                  duration: 2 + Math.floor(Math.random() * 4)
                });
              }
              break;

            case 'facility':
              const facilities = ['훈련장', '피지컬실', '분석실', '의료센터', '회의실'];
              const facilityName = facilities[Math.floor(Math.random() * facilities.length)];

              await this.createCommunityPost(team.id, 'FACILITY', {
                facilityName: facilityName,
                level: 1 + Math.floor(Math.random() * 5),
                cost: 500000 + Math.floor(Math.random() * 2000000)
              });
              break;

            case 'sponsor':
              const sponsors = ['롯데', '삼성', 'SK', 'LG', '현대', '기아'];
              const sponsorName = sponsors[Math.floor(Math.random() * sponsors.length)];

              await this.createCommunityPost(team.id, 'SPONSOR', {
                sponsorName: sponsorName,
                amount: 5000000 + Math.floor(Math.random() * 15000000)
              });
              break;

            case 'card_pack':
              const grades = ['NORMAL', 'RARE', 'LEGEND'];
              const grade = grades[Math.floor(Math.random() * grades.length)];

              // 임의의 선수 정보로 뉴스 생성
              const proPlayers = await pool.query(
                `SELECT name, overall as ovr FROM pro_players ORDER BY RAND() LIMIT 1`
              );

              if (proPlayers.length > 0) {
                await this.createCommunityPost(team.id, 'CARD_PACK', {
                  playerName: proPlayers[0].name,
                  grade: grade,
                  ovr: proPlayers[0].ovr || 75
                });
              }
              break;
          }
        }

        // 30% 확률로 이적 루머 생성
        if (Math.random() < 0.3) {
          await this.generateRandomRumor();
        }

        // 20% 확률로 선수 불화 뉴스 생성
        if (Math.random() < 0.2) {
          await this.generateRandomConflict();
        }
      }
    } catch (error) {
      console.error('Error generating auto news:', error);
    }
  }
}

export default NewsService;
