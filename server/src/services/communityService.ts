import pool from '../database/db.js';

// 다양한 커뮤니티 글 템플릿 (도배성 글이 아닌 다양한 관점)
const MATCH_POST_TEMPLATES = {
  bigWin: [
    '{winner} {score} 대승! {player}의 압도적인 플레이',
    '와... {winner} 이게 맞아? {score}로 완승',
    '{winner}의 완벽한 경기 운영, {score} 승리',
    '오늘 경기 진짜 재밌었다 {winner} {score}',
    '{player} 오늘 미쳤네요 ㄷㄷ {winner} {score} 승',
  ],
  closeWin: [
    '{winner} 간신히 이겼네... {score} 아슬아슬',
    '심장 떨렸다 {winner} {score} 신승',
    '{winner} vs {loser} 명경기였다 {score}',
    '오늘 경기 손에 땀 쥐었음 {winner} {score}',
    '{score}... {winner} 가까스로 승리',
  ],
  upsetWin: [
    '이게 가능해?! {winner}가 {loser}를 {score}로!',
    '대이변! {winner} {score} 승리!',
    '누가 예상했겠어 {winner} {score}',
    '{winner} 오늘 제대로 해냈다 {score}',
    '충격적인 결과... {winner} {score}로 {loser} 격파',
  ],
  loss: [
    '{loser} {score}로 패배... 아쉽다',
    '오늘은 운이 없었네 {loser} {score}',
    '{loser} 분발 필요. {score} 패배',
    '이번 경기는 실수가 많았던듯 {loser} {score}',
    '{loser} {score}로 졌지만 다음 경기 기대',
  ],
  draw: [
    '{home} vs {away} {score} 무승부',
    '박빙의 승부... {home} {away} {score}',
    '둘 다 잘했다 {home} vs {away} {score}',
    '명경기였지만 무승부 {score}',
    '{score} 무승부... 아쉽지만 할만했다',
  ],
  playerFocus: [
    '{player} 오늘 캐리했네 진짜',
    '{player} 덕분에 이긴 거 아니냐',
    '{player} 경기력 미쳤다 ㄷㄷ',
    '{player} 좀 봐라 ㅋㅋㅋ',
    '{player} 이번 경기 MVP 확정',
  ],
  tactical: [
    '{winner}의 전술이 먹혔네',
    '감독의 선수 기용이 적중했다',
    '{winner} 초반 운영이 승부를 갈랐어',
    '전략적으로 완벽한 경기였다',
    '{loser} 대응이 늦었던게 패인',
  ],
  emotional: [
    '오늘 경기 보면서 울었다...',
    '선수들 고생 많았어 ㅠㅠ',
    '팬으로서 자랑스럽다',
    '이런 경기 보려고 팬질한다',
    '감동적인 경기였다 진심',
  ],
  critical: [
    '실수가 너무 많았어 오늘',
    '이건 좀 아쉽네...',
    '왜 그렇게 플레이했을까',
    '다음엔 더 잘해야 할듯',
    '경기 운영에 문제가 있어 보임',
  ],
  hopeful: [
    '다음 경기는 꼭 이긴다',
    '이번 시즌 기대된다',
    '점점 좋아지고 있어',
    '앞으로가 기대되는 팀',
    '우승 노려볼만 하다',
  ]
};

// 랜덤 닉네임 생성
const NICKNAME_PREFIXES = [
  '열혈', '진짜', '찐', '충성', '프로', '올드', '뉴비', '고수', '초보', '베테랑',
  '냉철한', '열정적인', '분석하는', '응원하는', '사랑하는'
];
const NICKNAME_SUFFIXES = [
  '팬', '덕후', '매니아', '지지자', '서포터', '관전러', '분석가', '예언자', '전문가', '러버'
];

function generateNickname(): string {
  const prefix = NICKNAME_PREFIXES[Math.floor(Math.random() * NICKNAME_PREFIXES.length)];
  const suffix = NICKNAME_SUFFIXES[Math.floor(Math.random() * NICKNAME_SUFFIXES.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${prefix}${suffix}${num}`;
}

// 경기 결과에 따라 커뮤니티 글 자동 생성
export async function generateMatchPosts(
  matchId: number,
  homeTeamId: number,
  awayTeamId: number,
  homeScore: number,
  awayScore: number
): Promise<void> {
  try {
    // 팀 정보 가져오기
    const homeTeam = await pool.query('SELECT name FROM teams WHERE id = ?', [homeTeamId]);
    const awayTeam = await pool.query('SELECT name FROM teams WHERE id = ?', [awayTeamId]);

    if (homeTeam.length === 0 || awayTeam.length === 0) return;

    const homeTeamName = homeTeam[0].name;
    const awayTeamName = awayTeam[0].name;
    const scoreText = `${homeScore}-${awayScore}`;

    // 경기 MVP 선수 찾기 (가장 많이 킬/어시스트한 선수)
    const topPlayer = await pool.query(
      `SELECT COALESCE(pp.name, pc.ai_player_name, '선수') as name
       FROM match_stats ms
       JOIN player_cards pc ON ms.player_id = pc.id
       LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE ms.match_id = ?
       ORDER BY ms.kills DESC, ms.assists DESC
       LIMIT 1`,
      [matchId]
    );

    const playerName = topPlayer.length > 0 ? topPlayer[0].name : '주전 선수';

    // 경기 결과 분석
    const scoreDiff = Math.abs(homeScore - awayScore);
    const winner = homeScore > awayScore ? homeTeamName : awayTeamName;
    const loser = homeScore > awayScore ? awayTeamName : homeTeamName;
    const isDraw = homeScore === awayScore;
    const isBigWin = scoreDiff >= 3;
    const isCloseGame = scoreDiff === 1;

    // 생성할 글 개수 (2-4개)
    const postCount = 2 + Math.floor(Math.random() * 3);
    const usedTemplateTypes: string[] = [];

    for (let i = 0; i < postCount; i++) {
      let templateType: string;
      let templates: string[];

      // 상황에 따라 다른 템플릿 선택 (중복 방지)
      if (isDraw) {
        templateType = 'draw';
        templates = MATCH_POST_TEMPLATES.draw;
      } else if (isBigWin) {
        // 대승 시 다양한 관점의 글
        const options = ['bigWin', 'playerFocus', 'tactical', 'emotional'];
        templateType = options.filter(t => !usedTemplateTypes.includes(t))[
          Math.floor(Math.random() * options.filter(t => !usedTemplateTypes.includes(t)).length)
        ] || 'bigWin';
        templates = MATCH_POST_TEMPLATES[templateType as keyof typeof MATCH_POST_TEMPLATES];
      } else if (isCloseGame) {
        const options = ['closeWin', 'emotional', 'tactical'];
        templateType = options.filter(t => !usedTemplateTypes.includes(t))[
          Math.floor(Math.random() * options.filter(t => !usedTemplateTypes.includes(t)).length)
        ] || 'closeWin';
        templates = MATCH_POST_TEMPLATES[templateType as keyof typeof MATCH_POST_TEMPLATES];
      } else {
        // 일반 승부
        const options = ['upsetWin', 'playerFocus', 'loss', 'hopeful', 'critical'];
        templateType = options.filter(t => !usedTemplateTypes.includes(t))[
          Math.floor(Math.random() * options.filter(t => !usedTemplateTypes.includes(t)).length)
        ] || 'upsetWin';
        templates = MATCH_POST_TEMPLATES[templateType as keyof typeof MATCH_POST_TEMPLATES];
      }

      usedTemplateTypes.push(templateType);

      // 템플릿 선택 및 치환
      const template = templates[Math.floor(Math.random() * templates.length)];
      let content = template
        .replace('{winner}', winner)
        .replace('{loser}', loser)
        .replace('{home}', homeTeamName)
        .replace('{away}', awayTeamName)
        .replace('{score}', scoreText)
        .replace('{player}', playerName);

      // 글쓴이는 양 팀 중 랜덤 (약간 승리팀 쪽이 더 많이)
      const authorTeamId = isDraw
        ? (Math.random() < 0.5 ? homeTeamId : awayTeamId)
        : (Math.random() < 0.7 ? (homeScore > awayScore ? homeTeamId : awayTeamId) : (homeScore > awayScore ? awayTeamId : homeTeamId));

      const authorNickname = generateNickname();

      // 글 타입 결정
      const postType = ['MATCH_REVIEW', 'MATCH_REACTION', 'PLAYER_PRAISE'][
        Math.floor(Math.random() * 3)
      ];

      // 데이터베이스에 저장
      await pool.query(
        `INSERT INTO community_posts (team_id, author_nickname, post_type, content, match_id, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [authorTeamId, authorNickname, postType, content, matchId]
      );
    }

    console.log(`✅ 커뮤니티 글 ${postCount}개 생성 (경기 ID: ${matchId})`);
  } catch (error) {
    console.error('커뮤니티 글 생성 오류:', error);
  }
}

export default {
  generateMatchPosts
};
