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

// 팀 이름 요약 함수
const abbreviateTeamName = (name: string): string => {
  if (!name) return '';

  // 이미 짧으면 그대로 반환
  if (name.length <= 6) return name;

  // 공백으로 분리
  const words = name.trim().split(/\s+/);

  // 3단어 이상이면 이니셜 사용
  if (words.length >= 3) {
    return words.map(w => w[0].toUpperCase()).join('');
  }

  // 2단어면 각 단어 앞 2-3글자
  if (words.length === 2) {
    const first = words[0].slice(0, 3);
    const second = words[1].slice(0, 3);
    return first + second;
  }

  // 1단어면 앞 5글자
  return name.slice(0, 5);
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
  const [selectedTier, setSelectedTier] = useState<'SOUTH' | 'NORTH'>('SOUTH');
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
      case 'SOUTH': return 'LPO SOUTH';
      case 'NORTH': return 'LPO NORTH';
      default: return tier;
    }
  };

  const getTierDescription = (tier: string) => {
    switch (tier) {
      case 'SOUTH': return '남부 리그 - 16팀';
      case 'NORTH': return '북부 리그 - 16팀';
      default: return '';
    }
  };

  const getPromotionInfo = (_tier: string, rank: number, _totalTeams: number) => {
    // SOUTH/NORTH는 상위 4팀이 WORLDS 진출
    if (rank <= 4) return 'promotion'; // 상위 4팀 WORLDS
    return '';
  };

  return (
    <div className="leagues-page page-wrapper">
      <h1 className="page-title">LPO LEAGUE</h1>

      <div className="tier-selector">
        <button
          onClick={() => setSelectedTier('SOUTH')}
          className={`tier-btn south ${selectedTier === 'SOUTH' ? 'active' : ''}`}
        >
          <div className="tier-name">SOUTH</div>
          <div className="tier-sub">남부</div>
        </button>
        <button
          onClick={() => setSelectedTier('NORTH')}
          className={`tier-btn north ${selectedTier === 'NORTH' ? 'active' : ''}`}
        >
          <div className="tier-name">NORTH</div>
          <div className="tier-sub">북부</div>
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
            <span className="legend-item promotion">WORLDS 진출</span>
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
                      <span className="team-with-logo" title={match.home_team_name}>
                        {match.home_team_logo && <img src={match.home_team_logo} alt="" className="team-logo-small" />}
                        {abbreviateTeamName(match.home_team_name)}
                      </span>
                      <span className="vs">vs</span>
                      <span className="team-with-logo" title={match.away_team_name}>
                        {match.away_team_logo && <img src={match.away_team_logo} alt="" className="team-logo-small" />}
                        {abbreviateTeamName(match.away_team_name)}
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
