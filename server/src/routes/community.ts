import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../database/db.js';

const router = Router();

// 뉴스/루머 타입
const NEWS_TYPES = ['NEWS', 'RUMOR', 'INTERVIEW'] as const;

// AI 생성 뉴스 템플릿
const NEWS_TEMPLATES = {
  NEWS: [
    { title: '{team}, 다음 시즌 대비 훈련 시설 확충 발표', content: '구단이 선수들의 경기력 향상을 위해 최신 훈련 장비를 도입한다고 밝혔습니다.' },
    { title: '{team}, 신규 스폰서 계약 체결', content: '구단이 대형 스폰서와 다년간 계약을 체결하여 재정 안정화를 이뤘습니다.' },
    { title: '{player} MVP 선정, 팬들 환호', content: '지난 경기에서 맹활약한 {player}가 MVP로 선정되었습니다.' },
    { title: '{team}, 연승 행진 이어가', content: '{team}이 {wins}연승을 기록하며 리그 상위권을 유지하고 있습니다.' },
    { title: '{team} 팬미팅 개최 예정', content: '구단이 시즌 종료 후 팬들과의 만남을 위한 팬미팅을 개최한다고 발표했습니다.' },
  ],
  RUMOR: [
    { title: '[루머] {player}, 타팀 이적설?', content: '소식통에 따르면 {player}가 더 높은 연봉을 제시한 팀과 접촉 중이라는 소문이 돌고 있습니다.' },
    { title: '[루머] {team}, 해외 선수 영입 추진?', content: '구단이 실력있는 해외 선수를 물색 중이라는 소식이 전해졌습니다.' },
    { title: '[루머] {team} 감독 경질설', content: '최근 부진한 성적으로 인해 감독 교체설이 불거지고 있습니다.' },
    { title: '[루머] {player} 부상 우려', content: '지난 경기에서 불편한 모습을 보인 {player}의 부상설이 제기되고 있습니다.' },
  ],
  INTERVIEW: [
    { title: '[인터뷰] 감독 "이적설은 사실무근"', content: '감독이 직접 나서 최근 불거진 이적설에 대해 해명했습니다. "현재 좋은 조건으로 재계약을 논의 중"이라고 밝혔습니다.' },
    { title: '[인터뷰] {player} "팀과 함께 성장하고 싶다"', content: '{player}가 인터뷰에서 팀에 대한 애정을 드러냈습니다.' },
    { title: '[인터뷰] 감독 "팬들의 응원이 큰 힘"', content: '감독이 팬들에게 감사의 메시지를 전했습니다.' },
  ]
};

// AI 생성 댓글 템플릿
const COMMENT_TEMPLATES = {
  positive: [
    '드디어! 이번 시즌 우승 가즈아!',
    '믿고 있었다구~',
    '역시 우리팀 최고!',
    '눈물이 난다ㅠㅠ 감동',
    '팬으로서 자랑스럽습니다',
    '계속 이렇게만 해주세요!',
  ],
  negative: [
    '제발 거짓이길...',
    '구단이 뭐하는거야?',
    '이러면 안되는데...',
    '팬들 마음도 생각해줘',
    '실망스럽다 진짜',
    '당장 해명해라',
  ],
  neutral: [
    '지켜보겠습니다',
    '결과로 보여줘야지',
    '아직 판단하기 이르다',
    '일단 기다려보자',
    '좀 더 두고봐야 할듯',
  ]
};

// 랜덤 닉네임 생성
const NICKNAMES = [
  '열혈팬', '충성파', '분석가', '예언자', '관전러',
  '팬심장', '응원단장', '신입팬', '고참팬', '팬클럽회장',
  '킹갓팬', '사랑해요', '믿음직스', '현실주의자', '낙관론자'
];

function getRandomNickname(): string {
  const base = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${base}${num}`;
}

// 뉴스/루머 목록 조회
router.get('/news', async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.teamId;

    // 팀 정보 조회
    const teams = await pool.query(
      'SELECT id, name FROM teams WHERE id = ?',
      [teamId]
    );

    if (teams.length === 0) {
      return res.json([]);
    }

    const team = teams[0];

    // 팀 선수 조회
    const players = await pool.query(
      `SELECT pc.id, COALESCE(pp.nickname, pc.ai_player_name, '선수') as name
       FROM player_cards pc
       LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
       WHERE pc.team_id = ? AND pc.is_contracted = true
       LIMIT 5`,
      [teamId]
    );

    // 팀 성적 조회
    const stats = await pool.query(
      `SELECT wins, losses FROM league_participants lp
       JOIN leagues l ON lp.league_id = l.id
       WHERE lp.team_id = ? AND l.status IN ('REGULAR', 'PLAYOFF')
       ORDER BY l.season DESC LIMIT 1`,
      [teamId]
    );

    const wins = stats.length > 0 ? stats[0].wins : 0;

    // AI 뉴스 생성 (5-8개)
    const newsCount = 5 + Math.floor(Math.random() * 4);
    const generatedNews = [];

    for (let i = 0; i < newsCount; i++) {
      const type = NEWS_TYPES[Math.floor(Math.random() * NEWS_TYPES.length)];
      const templates = NEWS_TEMPLATES[type];
      const template = templates[Math.floor(Math.random() * templates.length)];

      // 랜덤 선수 선택
      const player = players.length > 0
        ? players[Math.floor(Math.random() * players.length)].name
        : '주전 선수';

      // 템플릿 치환
      const title = template.title
        .replace('{team}', team.name)
        .replace('{player}', player)
        .replace('{wins}', String(wins));

      const content = template.content
        .replace('{team}', team.name)
        .replace('{player}', player)
        .replace('{wins}', String(wins));

      // 반응 생성
      const baseReactions = type === 'RUMOR'
        ? { like: 30, angry: 100, sad: 150, laugh: 20 }
        : type === 'INTERVIEW'
        ? { like: 200, angry: 20, sad: 10, laugh: 30 }
        : { like: 150, angry: 10, sad: 5, laugh: 40 };

      const reactions = {
        like: baseReactions.like + Math.floor(Math.random() * 100),
        angry: baseReactions.angry + Math.floor(Math.random() * 50),
        sad: baseReactions.sad + Math.floor(Math.random() * 50),
        laugh: baseReactions.laugh + Math.floor(Math.random() * 30),
      };

      // 댓글 생성 (1-4개)
      const commentCount = 1 + Math.floor(Math.random() * 4);
      const comments = [];

      for (let j = 0; j < commentCount; j++) {
        // 뉴스 타입에 따른 감정 확률 조정
        let sentiment: 'positive' | 'negative' | 'neutral';
        const rand = Math.random();

        if (type === 'RUMOR') {
          sentiment = rand < 0.6 ? 'negative' : rand < 0.8 ? 'neutral' : 'positive';
        } else if (type === 'INTERVIEW') {
          sentiment = rand < 0.5 ? 'positive' : rand < 0.8 ? 'neutral' : 'negative';
        } else {
          sentiment = rand < 0.6 ? 'positive' : rand < 0.9 ? 'neutral' : 'negative';
        }

        const commentTemplates = COMMENT_TEMPLATES[sentiment];
        const commentContent = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];

        comments.push({
          id: i * 100 + j,
          author: getRandomNickname(),
          content: commentContent,
          created_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          sentiment
        });
      }

      generatedNews.push({
        id: i + 1,
        type,
        title,
        content,
        source: type === 'INTERVIEW' ? '공식 인터뷰' : type === 'RUMOR' ? '커뮤니티' : 'LPO 공식',
        created_at: new Date(Date.now() - i * 3600000).toISOString(),
        reactions,
        comments
      });
    }

    res.json(generatedNews);

  } catch (error) {
    console.error('Failed to get community news:', error);
    res.status(500).json({ error: 'Failed to get news' });
  }
});

// 팬 민심 조회
router.get('/fan-mood', async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.teamId;

    // 팀 정보 조회
    const teams = await pool.query(
      'SELECT fan_count, fan_morale FROM teams WHERE id = ?',
      [teamId]
    );

    if (teams.length === 0) {
      return res.json({ overall: 50, trending: 'stable', hotTopics: [] });
    }

    const team = teams[0];
    const morale = team.fan_morale || 50;

    // 최근 경기 결과로 트렌드 계산
    const recentMatches = await pool.query(
      `SELECT
        CASE
          WHEN (m.home_team_id = ? AND m.home_score > m.away_score) OR
               (m.away_team_id = ? AND m.away_score > m.home_score) THEN 1
          ELSE 0
        END as won
       FROM matches m
       WHERE (m.home_team_id = ? OR m.away_team_id = ?)
         AND m.status = 'FINISHED'
       ORDER BY m.finished_at DESC
       LIMIT 5`,
      [teamId, teamId, teamId, teamId]
    );

    const wins = recentMatches.filter((m: any) => m.won === 1).length;
    const trending = wins >= 3 ? 'up' : wins <= 1 ? 'down' : 'stable';

    // 화제 토픽 생성
    const hotTopics = [];
    if (wins >= 3) hotTopics.push('연승 행진');
    if (morale >= 70) hotTopics.push('팬 민심 최고');
    if (morale <= 40) hotTopics.push('위기 극복 필요');

    // 랜덤 토픽 추가
    const randomTopics = ['신규 선수 영입', '팬미팅 예정', '굿즈 출시', '시즌 목표', '훈련 공개'];
    hotTopics.push(randomTopics[Math.floor(Math.random() * randomTopics.length)]);

    res.json({
      overall: morale,
      trending,
      hotTopics: hotTopics.slice(0, 3)
    });

  } catch (error) {
    console.error('Failed to get fan mood:', error);
    res.status(500).json({ error: 'Failed to get fan mood' });
  }
});

export default router;
