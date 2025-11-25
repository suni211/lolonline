import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Matches.css';

// 날짜 포맷 헬퍼 함수 (한국 시간대)
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  // 문자열이 아닌 경우 문자열로 변환
  const str = typeof dateString === 'string' ? dateString : String(dateString);
  // MySQL datetime 형식 처리
  const normalized = str.replace(' ', 'T');
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
const getTeamAbbr = (name: string | null | undefined, abbr: string | null) => {
  if (abbr) return abbr;
  if (!name) return '???';
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
        const dateA = a.scheduled_at ? new Date(a.scheduled_at.replace(' ', 'T')) : new Date(0);
        const dateB = b.scheduled_at ? new Date(b.scheduled_at.replace(' ', 'T')) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      setMatches(allMatches);
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    }
  };

  // 상태 필터 적용
  const filteredMatches = matches.filter(m => {
    if (filter === 'all') {
      // 전체는 SCHEDULED와 LIVE만 표시
      return m.status === 'SCHEDULED' || m.status === 'LIVE';
    }
    // filter가 'all'이 아닌 경우 해당 상태만 표시
    return m.status === filter.toUpperCase();
  });

  // 경기 분류
  const cupMatches = filteredMatches.filter(m => m.match_type === 'CUP');
  const southLeagueMatches = filteredMatches.filter(m =>
    m.league_name && m.league_name.toUpperCase().includes('SOUTH')
  );
  const northLeagueMatches = filteredMatches.filter(m =>
    m.league_name && m.league_name.toUpperCase().includes('NORTH')
  );
  const amateurLeagueMatches = filteredMatches.filter(m =>
    m.league_name && m.league_name.toUpperCase().includes('AMATEUR')
  );
  const friendlyMatches = filteredMatches.filter(m => m.match_type === 'FRIENDLY');

  // 분류되지 않은 리그 경기
  const otherLeagueMatches = filteredMatches.filter(m =>
    m.match_type !== 'CUP' &&
    m.match_type !== 'FRIENDLY' &&
    !cupMatches.includes(m) &&
    !southLeagueMatches.includes(m) &&
    !northLeagueMatches.includes(m) &&
    !amateurLeagueMatches.includes(m)
  );

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

  // 종료된 경기들 (finished 필터일 때만)
  const finishedMatches = matches.filter(m => m.status === 'FINISHED');
  const finishedCupMatches = finishedMatches.filter(m => m.match_type === 'CUP');
  const finishedSouthLeagueMatches = finishedMatches.filter(m =>
    m.league_name && m.league_name.toUpperCase().includes('SOUTH')
  );
  const finishedNorthLeagueMatches = finishedMatches.filter(m =>
    m.league_name && m.league_name.toUpperCase().includes('NORTH')
  );
  const finishedAmateurLeagueMatches = finishedMatches.filter(m =>
    m.league_name && m.league_name.toUpperCase().includes('AMATEUR')
  );
  const finishedFriendlyMatches = finishedMatches.filter(m => m.match_type === 'FRIENDLY');
  const finishedOtherLeagueMatches = finishedMatches.filter(m =>
    m.match_type !== 'CUP' &&
    m.match_type !== 'FRIENDLY' &&
    !finishedCupMatches.includes(m) &&
    !finishedSouthLeagueMatches.includes(m) &&
    !finishedNorthLeagueMatches.includes(m) &&
    !finishedAmateurLeagueMatches.includes(m)
  );

  return (
    <div className="matches-page page-wrapper">
      <h1 className="page-title">스케쥴</h1>

      <div className="match-filters">
        <div className="filter-group">
          <button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'filter-active' : ''}
          >
            예정/진행중
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
            지난 경기
          </button>
        </div>
      </div>

      {/* 예정/진행중 경기 */}
      {filter !== 'finished' && (
        <div className="matches-container">
          {renderMatchList(cupMatches, 'LPO 컵')}
          {renderMatchList(southLeagueMatches, 'LPO SOUTH (1부)')}
          {renderMatchList(northLeagueMatches, 'LPO NORTH (1부)')}
          {renderMatchList(amateurLeagueMatches, 'LPO AMATEUR (2부)')}
          {renderMatchList(otherLeagueMatches, '기타 리그')}
          {renderMatchList(friendlyMatches, '친선전')}

          {filteredMatches.length === 0 && (
            <div className="no-matches">예정된 경기가 없습니다</div>
          )}
        </div>
      )}

      {/* 지난 경기 */}
      {filter === 'finished' && (
        <div className="matches-container">
          <h2 style={{ marginTop: '20px', marginBottom: '10px' }}>지난 경기</h2>
          {renderMatchList(finishedCupMatches, 'LPO 컵')}
          {renderMatchList(finishedSouthLeagueMatches, 'LPO SOUTH (1부)')}
          {renderMatchList(finishedNorthLeagueMatches, 'LPO NORTH (1부)')}
          {renderMatchList(finishedAmateurLeagueMatches, 'LPO AMATEUR (2부)')}
          {renderMatchList(finishedOtherLeagueMatches, '기타 리그')}
          {renderMatchList(finishedFriendlyMatches, '친선전')}

          {finishedMatches.length === 0 && (
            <div className="no-matches">지난 경기가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}
