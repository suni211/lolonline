import { useState, useEffect } from 'react';
import axios from 'axios';
import './Community.css';

interface NewsItem {
  id: number;
  type: 'NEWS' | 'RUMOR' | 'INTERVIEW';
  title: string;
  content: string;
  source: string;
  created_at: string;
  reactions: {
    like: number;
    angry: number;
    sad: number;
    laugh: number;
  };
  comments: Comment[];
}

interface Comment {
  id: number;
  author: string;
  content: string;
  created_at: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface FanMood {
  overall: number;
  trending: 'up' | 'down' | 'stable';
  hotTopics: string[];
}

export default function Community() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [fanMood, setFanMood] = useState<FanMood | null>(null);
  const [selectedTab, setSelectedTab] = useState<'all' | 'news' | 'rumor' | 'interview'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunityData();
  }, []);

  const fetchCommunityData = async () => {
    try {
      setLoading(true);
      const [newsRes, moodRes] = await Promise.all([
        axios.get('/api/community/news'),
        axios.get('/api/community/fan-mood')
      ]);
      setNews(newsRes.data);
      setFanMood(moodRes.data);
    } catch (error) {
      console.error('Failed to fetch community data:', error);
      // 더미 데이터
      setNews(generateDummyNews());
      setFanMood({
        overall: 65,
        trending: 'up',
        hotTopics: ['신규 선수 영입', '최근 연승', '팬미팅 예정']
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDummyNews = (): NewsItem[] => {
    return [
      {
        id: 1,
        type: 'NEWS',
        title: '팀, 다음 시즌 대비 훈련 시설 확충 발표',
        content: '구단이 선수들의 경기력 향상을 위해 최신 훈련 장비를 도입한다고 밝혔습니다.',
        source: 'LPO 공식',
        created_at: new Date().toISOString(),
        reactions: { like: 234, angry: 12, sad: 5, laugh: 8 },
        comments: [
          { id: 1, author: '열혈팬123', content: '드디어! 이번 시즌 우승 가즈아!', created_at: new Date().toISOString(), sentiment: 'positive' },
          { id: 2, author: '분석가김씨', content: '투자 좋네요. 결과로 보여주길', created_at: new Date().toISOString(), sentiment: 'neutral' }
        ]
      },
      {
        id: 2,
        type: 'RUMOR',
        title: '[루머] 에이스 선수, 타팀 이적설?',
        content: '소식통에 따르면 주전 미드라이너가 더 높은 연봉을 제시한 팀과 접촉 중이라는 소문이 돌고 있습니다.',
        source: '커뮤니티',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        reactions: { like: 45, angry: 189, sad: 234, laugh: 23 },
        comments: [
          { id: 3, author: '충성팬', content: '제발 거짓이길... 떠나지마ㅠㅠ', created_at: new Date().toISOString(), sentiment: 'negative' },
          { id: 4, author: '현실주의자', content: '선수도 먹고 살아야지. 이해는 함', created_at: new Date().toISOString(), sentiment: 'neutral' },
          { id: 5, author: '분노의팬', content: '구단이 제대로 대우 안해서 그런거 아님?', created_at: new Date().toISOString(), sentiment: 'negative' }
        ]
      },
      {
        id: 3,
        type: 'INTERVIEW',
        title: '[인터뷰] 감독 "이적설은 사실무근, 재계약 논의 중"',
        content: '감독이 직접 나서 최근 불거진 이적설에 대해 해명했습니다. "현재 좋은 조건으로 재계약을 논의 중이며, 선수도 팀에 남고 싶어한다"고 밝혔습니다.',
        source: '공식 인터뷰',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        reactions: { like: 567, angry: 23, sad: 12, laugh: 45 },
        comments: [
          { id: 6, author: '안심팬', content: '휴... 다행이다 진짜', created_at: new Date().toISOString(), sentiment: 'positive' },
          { id: 7, author: '의심쟁이', content: '말로만 그러는거 아님? 계약서 보여줘', created_at: new Date().toISOString(), sentiment: 'negative' }
        ]
      },
      {
        id: 4,
        type: 'NEWS',
        title: '지난 경기 MVP 선정, 팬들 환호',
        content: '어제 경기에서 맹활약한 서포터가 MVP로 선정되었습니다. 완벽한 시야장악과 로밍으로 팀 승리를 이끌었습니다.',
        source: 'LPO 공식',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        reactions: { like: 892, angry: 3, sad: 1, laugh: 156 },
        comments: [
          { id: 8, author: '서폿러버', content: '서폿 MVP 너무 감동ㅠㅠ 인정받아 마땅해!', created_at: new Date().toISOString(), sentiment: 'positive' }
        ]
      }
    ];
  };

  const filteredNews = selectedTab === 'all'
    ? news
    : news.filter(n => n.type.toLowerCase() === selectedTab);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'NEWS': return '뉴스';
      case 'RUMOR': return '루머';
      case 'INTERVIEW': return '인터뷰';
      default: return type;
    }
  };

  const getTypeClass = (type: string) => {
    switch (type) {
      case 'NEWS': return 'news';
      case 'RUMOR': return 'rumor';
      case 'INTERVIEW': return 'interview';
      default: return '';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😠';
      default: return '😐';
    }
  };

  if (loading) {
    return (
      <div className="community-page page-wrapper">
        <div className="loading">커뮤니티 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="community-page page-wrapper">
      <h1 className="page-title">커뮤니티</h1>

      {/* 팬 민심 요약 */}
      {fanMood && (
        <div className="fan-mood-section">
          <div className="mood-header">
            <h2>팬 민심</h2>
            <div className={`mood-trend ${fanMood.trending}`}>
              {fanMood.trending === 'up' && '📈 상승'}
              {fanMood.trending === 'down' && '📉 하락'}
              {fanMood.trending === 'stable' && '➡️ 유지'}
            </div>
          </div>
          <div className="mood-meter">
            <div className="mood-bar">
              <div
                className="mood-fill"
                style={{ width: `${fanMood.overall}%` }}
              />
            </div>
            <span className="mood-value">{fanMood.overall}%</span>
          </div>
          <div className="hot-topics">
            <span className="topics-label">화제:</span>
            {fanMood.hotTopics.map((topic, idx) => (
              <span key={idx} className="topic-tag">#{topic}</span>
            ))}
          </div>
        </div>
      )}

      {/* 탭 필터 */}
      <div className="community-tabs">
        <button
          className={selectedTab === 'all' ? 'active' : ''}
          onClick={() => setSelectedTab('all')}
        >
          전체
        </button>
        <button
          className={selectedTab === 'news' ? 'active' : ''}
          onClick={() => setSelectedTab('news')}
        >
          뉴스
        </button>
        <button
          className={selectedTab === 'rumor' ? 'active' : ''}
          onClick={() => setSelectedTab('rumor')}
        >
          루머
        </button>
        <button
          className={selectedTab === 'interview' ? 'active' : ''}
          onClick={() => setSelectedTab('interview')}
        >
          인터뷰
        </button>
      </div>

      {/* 뉴스 목록 */}
      <div className="news-list">
        {filteredNews.map(item => (
          <div key={item.id} className={`news-item ${getTypeClass(item.type)}`}>
            <div className="news-header">
              <span className={`news-type ${getTypeClass(item.type)}`}>
                {getTypeLabel(item.type)}
              </span>
              <span className="news-time">{formatTime(item.created_at)}</span>
            </div>

            <h3 className="news-title">{item.title}</h3>
            <p className="news-content">{item.content}</p>
            <div className="news-source">출처: {item.source}</div>

            {/* 반응 */}
            <div className="news-reactions">
              <span className="reaction">👍 {item.reactions.like}</span>
              <span className="reaction">😠 {item.reactions.angry}</span>
              <span className="reaction">😢 {item.reactions.sad}</span>
              <span className="reaction">😂 {item.reactions.laugh}</span>
            </div>

            {/* 댓글 */}
            {item.comments.length > 0 && (
              <div className="news-comments">
                <div className="comments-header">
                  팬 반응 ({item.comments.length})
                </div>
                {item.comments.map(comment => (
                  <div key={comment.id} className={`comment ${comment.sentiment}`}>
                    <div className="comment-header">
                      <span className="comment-author">{comment.author}</span>
                      <span className="comment-sentiment">
                        {getSentimentEmoji(comment.sentiment)}
                      </span>
                    </div>
                    <div className="comment-content">{comment.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
