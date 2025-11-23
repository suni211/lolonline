import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './TournamentHistory.css';

interface CupWinner {
  id: number;
  name: string;
  season: number;
  prize_pool: number;
  trophy_image: string | null;
  team_id: number;
  team_name: string;
  team_abbr: string | null;
  team_logo: string | null;
}

interface LeagueWinner {
  league_id: number;
  league_name: string;
  region: string;
  season: number;
  team_id: number;
  team_name: string;
  team_abbr: string | null;
  team_logo: string | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goal_difference: number;
}

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
  match_type: string;
  league_name?: string;
  source?: string;
}

// 팀 약자 표시 (약자가 없으면 팀 이름 앞 3글자)
const getTeamAbbr = (name: string, abbr: string | null) => {
  if (abbr) return abbr;
  return name.replace(/[^A-Za-z0-9가-힣]/g, '').substring(0, 3).toUpperCase();
};

// 날짜 포맷
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
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

const TournamentHistory: React.FC = () => {
  const { token } = useAuth();
  const [cupWinners, setCupWinners] = useState<CupWinner[]>([]);
  const [leagueWinners, setLeagueWinners] = useState<LeagueWinner[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'schedule' | 'history'>('schedule');

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const fetchHistory = async () => {
    try {
      setLoading(true);

      // 경기 목록 조회
      const matchesRes = await axios.get('/api/matches');
      let allMatches = matchesRes.data.map((m: Match) => ({ ...m, source: 'matches' }));

      // 컵 경기 조회
      try {
        const cupRes = await axios.get('/api/cup/current?season=1', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cupRes.data && cupRes.data.matches) {
          const cupMatches = cupRes.data.matches.map((cm: any) => ({
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
          allMatches = [...allMatches, ...cupMatches];
        }
      } catch (e) {}

      setMatches(allMatches);

      // 역대 우승 기록
      const [cupWinnersRes, leagueWinnersRes] = await Promise.all([
        fetch('/api/cup/history/winners', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/cup/history/league-winners', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (cupWinnersRes.ok) {
        const cupData = await cupWinnersRes.json();
        setCupWinners(cupData);
      }

      if (leagueWinnersRes.ok) {
        const leagueData = await leagueWinnersRes.json();
        setLeagueWinners(leagueData);
      }
    } catch (err) {
      setError('데이터를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  // 경기 분류
  const cupMatches = matches.filter(m => m.match_type === 'CUP');
  const superLeagueMatches = matches.filter(m =>
    m.league_name && (m.league_name.includes('SUPER') || m.league_name.includes('슈퍼'))
  );
  const firstLeagueMatches = matches.filter(m =>
    m.league_name && (m.league_name.includes('1 ') || m.league_name.includes('FIRST') || m.league_name === 'LPO 1')
  );
  const secondLeagueMatches = matches.filter(m =>
    m.league_name && (m.league_name.includes('2 ') || m.league_name.includes('SECOND') || m.league_name === 'LPO 2')
  );

  const getRegionName = (region: string) => {
    switch (region) {
      case 'SUPER': return 'LPO SUPER';
      case 'FIRST': return 'LPO 1부';
      case 'SECOND': return 'LPO 2부';
      default: return region;
    }
  };

  const formatPrize = (prize: number) => {
    if (prize >= 100000000) {
      return `${(prize / 100000000).toFixed(1)}억`;
    } else if (prize >= 10000) {
      return `${(prize / 10000).toFixed(0)}만`;
    }
    return prize.toLocaleString();
  };

  if (loading) {
    return <div className="tournament-history-page"><div className="loading">로딩 중...</div></div>;
  }

  if (error) {
    return <div className="tournament-history-page"><div className="error">{error}</div></div>;
  }

  const renderMatchSection = (matchList: Match[], title: string) => {
    if (matchList.length === 0) return null;
    return (
      <div className="schedule-section">
        <h3>{title}</h3>
        <div className="schedule-matches">
          {matchList.slice(0, 10).map((match) => (
            <div key={`${match.source}-${match.id}`} className={`schedule-match ${match.status?.toLowerCase()}`}>
              <div className="match-teams">
                <span title={match.home_team_name}>
                  {getTeamAbbr(match.home_team_name, match.home_team_abbr)}
                </span>
                <span className="vs">vs</span>
                <span title={match.away_team_name}>
                  {getTeamAbbr(match.away_team_name, match.away_team_abbr)}
                </span>
              </div>
              <div className="match-info">
                {match.status === 'FINISHED' && (
                  <span className="score">{match.home_score} - {match.away_score}</span>
                )}
                {match.status === 'LIVE' && <span className="live">LIVE</span>}
                {match.status === 'SCHEDULED' && (
                  <span className="time">{formatDate(match.scheduled_at)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="tournament-history-page">
      <h1>대회 정보</h1>

      <div className="history-tabs">
        <button
          className={activeTab === 'schedule' ? 'active' : ''}
          onClick={() => setActiveTab('schedule')}
        >
          경기 일정
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          역대 기록
        </button>
      </div>

      {activeTab === 'schedule' && (
        <div className="schedule-container">
          {renderMatchSection(cupMatches, 'LPO 컵')}
          {renderMatchSection(superLeagueMatches, 'LPO SUPER LEAGUE')}
          {renderMatchSection(firstLeagueMatches, 'LPO 1 LEAGUE')}
          {renderMatchSection(secondLeagueMatches, 'LPO 2 LEAGUE')}
          {matches.length === 0 && <div className="no-data">경기가 없습니다</div>}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="winners-section">
          <h2>LPO 컵 역대 우승</h2>
          {cupWinners.length === 0 ? (
            <div className="no-data">아직 우승 기록이 없습니다</div>
          ) : (
            <div className="cup-winners-grid">
              {cupWinners.map(winner => (
                <div key={winner.id} className="cup-winner-card">
                  {winner.trophy_image && (
                    <div className="trophy-image">
                      <img src={winner.trophy_image} alt="Trophy" />
                    </div>
                  )}
                  <div className="winner-info">
                    <div className="season-badge">시즌 {winner.season}</div>
                    <div className="cup-name">{winner.name}</div>
                    <div className="team-info">
                      {winner.team_logo && (
                        <img src={winner.team_logo} alt={winner.team_name} className="team-logo" />
                      )}
                      <span className="team-name" title={winner.team_name}>
                        {getTeamAbbr(winner.team_name, winner.team_abbr)}
                      </span>
                    </div>
                    <div className="prize">상금: {formatPrize(winner.prize_pool)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'league' && (
        <div className="winners-section">
          <h2>LPO 리그 역대 우승</h2>
          {leagueWinners.length === 0 ? (
            <div className="no-data">아직 우승 기록이 없습니다</div>
          ) : (
            <div className="league-winners-list">
              {/* Group by season */}
              {Array.from(new Set(leagueWinners.map(w => w.season)))
                .sort((a, b) => b - a)
                .map(season => (
                  <div key={season} className="season-group">
                    <h3>시즌 {season}</h3>
                    <div className="league-winners-grid">
                      {leagueWinners
                        .filter(w => w.season === season)
                        .sort((a, b) => {
                          const order = { SUPER: 0, FIRST: 1, SECOND: 2 };
                          return (order[a.region as keyof typeof order] || 0) - (order[b.region as keyof typeof order] || 0);
                        })
                        .map(winner => (
                          <div key={winner.league_id} className="league-winner-card">
                            <div className="league-name">{getRegionName(winner.region)}</div>
                            <div className="team-info">
                              {winner.team_logo && (
                                <img src={winner.team_logo} alt={winner.team_name} className="team-logo" />
                              )}
                              <span className="team-name" title={winner.team_name}>
                                {getTeamAbbr(winner.team_name, winner.team_abbr)}
                              </span>
                            </div>
                            <div className="stats">
                              <span>{winner.wins}승 {winner.draws}무 {winner.losses}패</span>
                              <span>승점 {winner.points}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TournamentHistory;
