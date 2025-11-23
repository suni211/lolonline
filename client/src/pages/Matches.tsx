import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Matches.css';

// 날짜 포맷 헬퍼 함수
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  // MySQL datetime 형식 처리
  const normalized = dateString.replace(' ', 'T');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface Match {
  id: number;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  status: string;
  scheduled_at: string;
  started_at?: string;
  finished_at?: string;
  match_type: string;
}

export default function Matches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'live' | 'finished'>('all');
  const [matchTypeFilter, setMatchTypeFilter] = useState<'all' | 'LEAGUE' | 'FRIENDLY'>('all');

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await axios.get('/api/matches');
      setMatches(response.data);
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    }
  };

  const filteredMatches = matches.filter(m => {
    // 상태 필터
    if (filter !== 'all' && m.status !== filter.toUpperCase()) return false;
    // 경기 타입 필터
    if (matchTypeFilter !== 'all' && m.match_type !== matchTypeFilter) return false;
    return true;
  });

  return (
    <div className="matches-page">
      <h1 className="page-title">경기</h1>

      <div className="match-filters">
        <div className="filter-group">
          <button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'filter-active' : ''}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('scheduled')}
            className={filter === 'scheduled' ? 'filter-active' : ''}
          >
            예정
          </button>
          <button
            onClick={() => setFilter('live')}
            className={filter === 'live' ? 'filter-active' : ''}
          >
            진행중
          </button>
          <button
            onClick={() => setFilter('finished')}
            className={filter === 'finished' ? 'filter-active' : ''}
          >
            종료
          </button>
        </div>
        <div className="filter-group">
          <button
            onClick={() => setMatchTypeFilter('all')}
            className={matchTypeFilter === 'all' ? 'filter-active' : ''}
          >
            전체
          </button>
          <button
            onClick={() => setMatchTypeFilter('LEAGUE')}
            className={matchTypeFilter === 'LEAGUE' ? 'filter-active' : ''}
          >
            리그전
          </button>
          <button
            onClick={() => setMatchTypeFilter('FRIENDLY')}
            className={matchTypeFilter === 'FRIENDLY' ? 'filter-active' : ''}
          >
            친선전
          </button>
        </div>
      </div>

      <div className="matches-container">
        <div className="matches-list">
          <h2>경기 목록</h2>
          {filteredMatches.map((match) => (
            <div
              key={match.id}
              className={`match-item ${match.status?.toLowerCase() || ''}`}
              onClick={() => navigate(`/live/${match.id}`)}
            >
              <div className="match-teams">
                <span className={match.home_score > match.away_score ? 'winner' : ''}>
                  {match.home_team_name}
                </span>
                <span className="vs">vs</span>
                <span className={match.away_score > match.home_score ? 'winner' : ''}>
                  {match.away_team_name}
                </span>
              </div>
              <div className="match-score">
                {match.status === 'FINISHED' && (
                  <span>{match.home_score} - {match.away_score}</span>
                )}
                {match.status === 'LIVE' && (
                  <span className="live-indicator">LIVE</span>
                )}
                {match.status === 'SCHEDULED' && (
                  <span className="scheduled-time">
                    {formatDate(match.scheduled_at)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
