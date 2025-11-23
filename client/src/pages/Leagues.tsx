import { useEffect, useState } from 'react';
import axios from 'axios';
import './Leagues.css';

// 날짜 포맷 헬퍼 함수
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR');
};

interface League {
  id: number;
  name: string;
  region: string;
  season: number;
  current_month: number;
  status: string;
}

interface Standing {
  team_id: number;
  team_name: string;
  logo_url: string | null;
  is_ai: boolean;
  wins: number;
  losses: number;
  draws: number;
  total_points: number;
  goal_difference: number;
  rank: number;
}

export default function Leagues() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedTier, setSelectedTier] = useState<'SUPER' | 'FIRST' | 'SECOND'>('SUPER');
  const [standings, setStandings] = useState<Standing[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [playoffBracket, setPlayoffBracket] = useState<any[]>([]);
  const [currentLeague, setCurrentLeague] = useState<League | null>(null);

  useEffect(() => {
    fetchLeagues();
  }, []);

  useEffect(() => {
    const league = leagues.find(l => l.region === selectedTier);
    if (league) {
      setCurrentLeague(league);
      fetchLeagueDetails(league.id);
    }
  }, [selectedTier, leagues]);

  const fetchLeagues = async () => {
    try {
      const response = await axios.get('/api/leagues');
      // LPO 리그만 필터링하고 현재 시즌만
      const lpoLeagues = response.data.filter((l: League) => l.name.includes('LPO'));
      setLeagues(lpoLeagues);
    } catch (error) {
      console.error('Failed to fetch leagues:', error);
    }
  };

  const fetchLeagueDetails = async (leagueId: number) => {
    try {
      const [leagueRes, playoffRes] = await Promise.all([
        axios.get(`/api/leagues/${leagueId}`),
        axios.get(`/api/leagues/${leagueId}/playoff`)
      ]);

      setStandings(leagueRes.data.standings || []);
      setUpcomingMatches(leagueRes.data.upcomingMatches || []);
      setPlayoffBracket(playoffRes.data || []);
    } catch (error) {
      console.error('Failed to fetch league details:', error);
    }
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'SUPER': return 'LPO SUPER LEAGUE';
      case 'FIRST': return 'LPO 1 LEAGUE';
      case 'SECOND': return 'LPO 2 LEAGUE';
      default: return tier;
    }
  };

  const getTierDescription = (tier: string) => {
    switch (tier) {
      case 'SUPER': return '1부 리그 - 최상위 10팀';
      case 'FIRST': return '2부 리그 - 10팀';
      case 'SECOND': return '3부 리그 - 12팀 (신규 팀 시작)';
      default: return '';
    }
  };

  const getPromotionInfo = (tier: string, rank: number, totalTeams: number) => {
    if (tier === 'SUPER') {
      if (rank >= totalTeams - 1) return 'relegation'; // 하위 2팀 강등
    } else if (tier === 'FIRST') {
      if (rank <= 2) return 'promotion'; // 상위 2팀 승격
      if (rank >= totalTeams - 1) return 'relegation'; // 하위 2팀 강등
    } else if (tier === 'SECOND') {
      if (rank <= 2) return 'promotion'; // 상위 2팀 승격
    }
    return '';
  };

  return (
    <div className="leagues-page">
      <h1 className="page-title">LPO LEAGUE</h1>

      <div className="tier-selector">
        <button
          onClick={() => setSelectedTier('SUPER')}
          className={`tier-btn super ${selectedTier === 'SUPER' ? 'active' : ''}`}
        >
          <div className="tier-name">SUPER</div>
          <div className="tier-sub">1부</div>
        </button>
        <button
          onClick={() => setSelectedTier('FIRST')}
          className={`tier-btn first ${selectedTier === 'FIRST' ? 'active' : ''}`}
        >
          <div className="tier-name">1 LEAGUE</div>
          <div className="tier-sub">2부</div>
        </button>
        <button
          onClick={() => setSelectedTier('SECOND')}
          className={`tier-btn second ${selectedTier === 'SECOND' ? 'active' : ''}`}
        >
          <div className="tier-name">2 LEAGUE</div>
          <div className="tier-sub">3부</div>
        </button>
      </div>

      {currentLeague && (
        <div className="league-content">
          <div className="league-info">
            <h2>{getTierName(selectedTier)}</h2>
            <p className="tier-desc">{getTierDescription(selectedTier)}</p>
            <p>시즌 {currentLeague.season} | {currentLeague.current_month}월</p>
            <p className={`status-badge ${currentLeague.status.toLowerCase()}`}>
              {currentLeague.status === 'REGULAR' && '정규시즌'}
              {currentLeague.status === 'PLAYOFF' && '플레이오프'}
              {currentLeague.status === 'OFFSEASON' && '스토브리그'}
            </p>
          </div>

          <div className="promotion-legend">
            <span className="legend-item promotion">승격권</span>
            <span className="legend-item relegation">강등권</span>
            <span className="legend-item ai-team">AI 팀</span>
          </div>

          {currentLeague.status === 'PLAYOFF' && playoffBracket.length > 0 && (
            <div className="playoff-section">
              <h3>플레이오프 브래킷</h3>
              <div className="playoff-bracket">
                {playoffBracket.map((bracket) => (
                  <div key={bracket.id} className="bracket-match">
                    <div className="bracket-round">{bracket.round}</div>
                    <div className="bracket-teams">
                      <div className={`bracket-team ${bracket.winner_id === bracket.team1_id ? 'winner' : ''}`}>
                        {bracket.team1_name || 'TBD'}
                      </div>
                      <div className="bracket-vs">VS</div>
                      <div className={`bracket-team ${bracket.winner_id === bracket.team2_id ? 'winner' : ''}`}>
                        {bracket.team2_name || 'TBD'}
                      </div>
                    </div>
                    {bracket.match_status === 'FINISHED' && (
                      <div className="bracket-score">
                        {bracket.home_score} - {bracket.away_score}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="standings-section">
            <h3>순위표</h3>
            <table className="standings-table">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>팀</th>
                  <th>승</th>
                  <th>무</th>
                  <th>패</th>
                  <th>득실차</th>
                  <th>승점</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing, idx) => {
                  const rank = standing.rank || idx + 1;
                  const promoStatus = getPromotionInfo(selectedTier, rank, standings.length);
                  return (
                    <tr
                      key={idx}
                      className={`
                        ${promoStatus === 'promotion' ? 'promotion-zone' : ''}
                        ${promoStatus === 'relegation' ? 'relegation-zone' : ''}
                        ${standing.is_ai ? 'ai-team-row' : ''}
                      `}
                    >
                      <td>{rank}</td>
                      <td className="team-cell">
                        {standing.logo_url ? (
                          <img src={standing.logo_url} alt="" className="team-logo-small" />
                        ) : (
                          <div className="team-logo-placeholder" />
                        )}
                        <span className="team-name">
                          {standing.team_name}
                          {standing.is_ai ? <span className="ai-badge">AI</span> : null}
                        </span>
                      </td>
                      <td>{standing.wins}</td>
                      <td>{standing.draws}</td>
                      <td>{standing.losses}</td>
                      <td>{standing.goal_difference > 0 ? '+' : ''}{standing.goal_difference}</td>
                      <td className="points">{standing.total_points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="upcoming-matches-section">
            <h3>다음 경기</h3>
            {upcomingMatches.length > 0 ? (
              <div className="matches-list">
                {upcomingMatches.map((match) => (
                  <div key={match.id} className="match-item">
                    <div className="match-teams">
                      <span className="team-with-logo">
                        {match.home_team_logo && <img src={match.home_team_logo} alt="" className="team-logo-small" />}
                        {match.home_team_name}
                      </span>
                      <span className="vs">vs</span>
                      <span className="team-with-logo">
                        {match.away_team_logo && <img src={match.away_team_logo} alt="" className="team-logo-small" />}
                        {match.away_team_name}
                      </span>
                    </div>
                    <div className="match-time">
                      {formatDate(match.scheduled_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-matches">예정된 경기가 없습니다</p>
            )}
          </div>
        </div>
      )}

      {!currentLeague && leagues.length === 0 && (
        <div className="no-league">
          <p>리그가 아직 생성되지 않았습니다.</p>
          <p className="sub-text">관리자가 LPO 리그를 초기화해야 합니다.</p>
        </div>
      )}
    </div>
  );
}
