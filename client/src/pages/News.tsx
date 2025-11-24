import { useState, useEffect } from 'react';
import axios from 'axios';
import './News.css';

interface NewsItem {
  id: number;
  news_type: string;
  title: string;
  content: string;
  team_name: string | null;
  player_name: string | null;
  source_team_name: string | null;
  target_team_name: string | null;
  credibility: number;
  highlight_type: string | null;
  created_at: string;
  author_nickname: string;
  view_count: number;
  comment_count: number;
  like_count: number;
}

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  useEffect(() => {
    fetchNews();
  }, [activeTab, page]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/news', {
        params: {
          type: activeTab === 'all' ? undefined : activeTab,
          page,
          limit: 15
        }
      });
      setNews(res.data.news);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNewsTypeLabel = (type: string) => {
    switch (type) {
      case 'MATCH_HIGHLIGHT': return '경기 하이라이트';
      case 'PLAYER_CONFLICT': return '선수 이슈';
      case 'TRANSFER_RUMOR': return '이적 루머';
      case 'TRANSFER_OFFICIAL': return '이적 공식';
      case 'TEAM_NEWS': return '팀 소식';
      case 'LEAGUE_NEWS': return '리그 소식';
      default: return type;
    }
  };

  const getNewsTypeClass = (type: string) => {
    switch (type) {
      case 'MATCH_HIGHLIGHT': return 'highlight';
      case 'PLAYER_CONFLICT': return 'conflict';
      case 'TRANSFER_RUMOR': return 'rumor';
      case 'TRANSFER_OFFICIAL': return 'official';
      case 'TEAM_NEWS': return 'team';
      case 'LEAGUE_NEWS': return 'league';
      default: return '';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return '방금 전';
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  return (
    <div className="news-page community-style">
      <div className="community-header">
        <h1>LPO 게시판</h1>
        <p className="community-desc">리그 프로 온라인 커뮤니티</p>
      </div>

      <div className="news-tabs">
        <button
          className={activeTab === 'all' ? 'active' : ''}
          onClick={() => { setActiveTab('all'); setPage(1); }}
        >
          전체
        </button>
        <button
          className={activeTab === 'MATCH_HIGHLIGHT' ? 'active' : ''}
          onClick={() => { setActiveTab('MATCH_HIGHLIGHT'); setPage(1); }}
        >
          경기
        </button>
        <button
          className={activeTab === 'TRANSFER_RUMOR' ? 'active' : ''}
          onClick={() => { setActiveTab('TRANSFER_RUMOR'); setPage(1); }}
        >
          루머
        </button>
        <button
          className={activeTab === 'TRANSFER_OFFICIAL' ? 'active' : ''}
          onClick={() => { setActiveTab('TRANSFER_OFFICIAL'); setPage(1); }}
        >
          오피셜
        </button>
        <button
          className={activeTab === 'PLAYER_CONFLICT' ? 'active' : ''}
          onClick={() => { setActiveTab('PLAYER_CONFLICT'); setPage(1); }}
        >
          이슈
        </button>
      </div>

      {loading ? (
        <div className="loading">뉴스를 불러오는 중...</div>
      ) : news.length === 0 ? (
        <div className="no-news">뉴스가 없습니다</div>
      ) : (
        <>
          <div className="news-list community-list">
            <div className="list-header">
              <span className="col-type">말머리</span>
              <span className="col-title">제목</span>
              <span className="col-author">글쓴이</span>
              <span className="col-date">날짜</span>
              <span className="col-views">조회</span>
              <span className="col-likes">추천</span>
            </div>
            {news.map((item) => (
              <div
                key={item.id}
                className={`news-row ${getNewsTypeClass(item.news_type)}`}
                onClick={() => setSelectedNews(item)}
              >
                <span className={`col-type news-type-badge ${getNewsTypeClass(item.news_type)}`}>
                  {getNewsTypeLabel(item.news_type)}
                </span>
                <span className="col-title">
                  <span className="title-text">{item.title}</span>
                  {item.comment_count > 0 && (
                    <span className="comment-count">[{item.comment_count}]</span>
                  )}
                </span>
                <span className="col-author">{item.author_nickname || '익명'}</span>
                <span className="col-date">{formatDate(item.created_at)}</span>
                <span className="col-views">{item.view_count || 0}</span>
                <span className="col-likes">{item.like_count || 0}</span>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                이전
              </button>
              <span>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {selectedNews && (
        <div className="news-modal-overlay" onClick={() => setSelectedNews(null)}>
          <div className="news-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedNews(null)}>×</button>
            <div className="modal-header">
              <span className={`news-type ${getNewsTypeClass(selectedNews.news_type)}`}>
                {getNewsTypeLabel(selectedNews.news_type)}
              </span>
              <span className="news-date">{formatDate(selectedNews.created_at)}</span>
            </div>
            <h2>{selectedNews.title}</h2>
            <p className="news-content">{selectedNews.content}</p>
            {selectedNews.news_type === 'TRANSFER_RUMOR' && (
              <div className="credibility-info">
                <strong>루머 신뢰도:</strong> {selectedNews.credibility}%
                {selectedNews.source_team_name && (
                  <div>출발 팀: {selectedNews.source_team_name}</div>
                )}
                {selectedNews.target_team_name && (
                  <div>도착 팀: {selectedNews.target_team_name}</div>
                )}
              </div>
            )}
            {selectedNews.player_name && (
              <div className="player-info">관련 선수: {selectedNews.player_name}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
