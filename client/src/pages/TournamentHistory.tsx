import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './TournamentHistory.css';

interface CupWinner {
  id: number;
  name: string;
  season: number;
  prize_pool: number;
  trophy_image: string | null;
  team_id: number;
  team_name: string;
  team_logo: string | null;
}

interface LeagueWinner {
  league_id: number;
  league_name: string;
  region: string;
  season: number;
  team_id: number;
  team_name: string;
  team_logo: string | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goal_difference: number;
}

const TournamentHistory: React.FC = () => {
  const { token } = useAuth();
  const [cupWinners, setCupWinners] = useState<CupWinner[]>([]);
  const [leagueWinners, setLeagueWinners] = useState<LeagueWinner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'cup' | 'league'>('cup');

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const [cupRes, leagueRes] = await Promise.all([
        fetch('/api/cup/history/winners', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/cup/history/league-winners', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (cupRes.ok) {
        const cupData = await cupRes.json();
        setCupWinners(cupData);
      }

      if (leagueRes.ok) {
        const leagueData = await leagueRes.json();
        setLeagueWinners(leagueData);
      }
    } catch (err) {
      setError('데이터를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="tournament-history-page">
      <h1>역대 우승 기록</h1>

      <div className="history-tabs">
        <button
          className={activeTab === 'cup' ? 'active' : ''}
          onClick={() => setActiveTab('cup')}
        >
          컵 대회
        </button>
        <button
          className={activeTab === 'league' ? 'active' : ''}
          onClick={() => setActiveTab('league')}
        >
          리그
        </button>
      </div>

      {activeTab === 'cup' && (
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
                      <span className="team-name">{winner.team_name}</span>
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
                              <span className="team-name">{winner.team_name}</span>
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
