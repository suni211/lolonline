import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Matches.css';

// 날짜 포맷 헬퍼 함수 (한국 시간대)
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  // MySQL datetime 형식 처리
  const normalized = dateString.replace(' ', 'T');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface Match {
  id: number;
  home_team_name: string;
  home_team_abbr: string | null;
  away_team_name: string;
  away_team_abbr: string | null;
  home_score: number;
  away_score: number;
  status: string;
  scheduled_at: string;
  started_at?: string;
  finished_at?: string;
  match_type: string;
  league_name?: string;
  source?: string; // 'matches' | 'cup'
}

interface CupMatch {
  id: number;
  round: string;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  home_team_abbr: string | null;
  away_team_name: string;
  away_team_abbr: string | null;
  home_score: number;
  away_score: number;
  scheduled_at: string;
  status: string;
}

// 팀 약자 표시 (약자가 없으면 팀 이름 앞 3글자)
const getTeamAbbr = (name: string, abbr: string | null) => {
  if (abbr) return abbr;
  return name.replace(/[^A-Za-z0-9가-힣]/g, '').substring(0, 3).toUpperCase();
};

export default function Matches() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'live' | 'finished'>('all');

  useEffect(() => {
    fetchAllMatches();
  }, [token]);

  const fetchAllMatches = async () => {
    try {
      // 일반 경기 (리그전, 친선전)
      const matchesResponse = await axios.get('/api/matches');
      const regularMatches = matchesResponse.data.map((m: Match) => ({
        ...m,
        source: 'matches'
      }));

      // 컵 경기 조회
      let cupMatches: Match[] = [];
      try {
        const cupResponse = await axios.get('/api/cup/current?season=1', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (cupResponse.data && cupResponse.data.matches) {
          cupMatches = cupResponse.data.matches.map((cm: CupMatch) => ({
            id: cm.id,
            home_team_name: cm.home_team_name,
            home_team_abbr: cm.home_team_abbr,
            away_team_name: cm.away_team_name,
            away_team_abbr: cm.away_team_abbr,
            home_score: cm.home_score,
            away_score: cm.away_score,
            status: cm.status === 'COMPLETED' ? 'FINISHED' : cm.status === 'IN_PROGRESS' ? 'LIVE' : 'SCHEDULED',
            scheduled_at: cm.scheduled_at,
            match_type: 'CUP',
            source: 'cup'
          }));
        }
      } catch (cupError) {
        console.log('No cup matches available');
      }

      // 모든 경기 병합 및 시간순 정렬
      const allMatches = [...regularMatches, ...cupMatches].sort((a, b) => {
        const dateA = new Date(a.scheduled_at.replace(' ', 'T'));
        const dateB = new Date(b.scheduled_at.replace(' ', 'T'));
        return dateA.getTime() - dateB.getTime();
      });

      setMatches(allMatches);
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    }
  };

  // 상태 필터 적용
  const filteredMatches = matches.filter(m => {
    if (filter !== 'all' && m.status !== filter.toUpperCase()) return false;
    return true;
  });

  // 경기 분류
  const cupMatches = filteredMatches.filter(m => m.match_type === 'CUP');
  const superLeagueMatches = filteredMatches.filter(m =>
    m.league_name?.includes('SUPER') || m.league_name?.includes('슈퍼')
  );
  const firstLeagueMatches = filteredMatches.filter(m =>
    m.league_name?.includes('1') || m.league_name?.includes('FIRST')
  );
  const secondLeagueMatches = filteredMatches.filter(m =>
    m.league_name?.includes('2') || m.league_name?.includes('SECOND')
  );
  const friendlyMatches = filteredMatches.filter(m => m.match_type === 'FRIENDLY');

  const renderMatchList = (matchList: Match[], title: string) => {
    if (matchList.length === 0) return null;

    return (
      <div className="matches-section">
        <h2>{title}</h2>
        <div className="matches-list">
          {matchList.map((match) => (
            <div
              key={`${match.source}-${match.id}`}
              className={`match-item ${match.status?.toLowerCase() || ''}`}
              onClick={() => navigate(`/live/${match.id}`)}
            >
              <div className="match-teams">
                <span
                  className={match.home_score > match.away_score ? 'winner' : ''}
                  title={match.home_team_name}
                >
                  {getTeamAbbr(match.home_team_name, match.home_team_abbr)}
                </span>
                <span className="vs">vs</span>
                <span
                  className={match.away_score > match.home_score ? 'winner' : ''}
                  title={match.away_team_name}
                >
                  {getTeamAbbr(match.away_team_name, match.away_team_abbr)}
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
    );
  };

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
      </div>

      <div className="matches-container">
        {renderMatchList(cupMatches, 'LPO 컵')}
        {renderMatchList(superLeagueMatches, 'LPO SUPER LEAGUE')}
        {renderMatchList(firstLeagueMatches, 'LPO 1 LEAGUE')}
        {renderMatchList(secondLeagueMatches, 'LPO 2 LEAGUE')}
        {renderMatchList(friendlyMatches, '친선전')}

        {filteredMatches.length === 0 && (
          <div className="no-matches">경기가 없습니다</div>
        )}
      </div>
    </div>
  );
}
