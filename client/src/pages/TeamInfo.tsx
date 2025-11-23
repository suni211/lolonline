import { useState } from 'react';
import axios from 'axios';
import './TeamInfo.css';

interface Team {
  id: number;
  name: string;
  league: string;
  logo_url: string | null;
  team_color: string;
  fan_count: number;
  gold: number;
  is_ai: boolean;
  player_count: number;
  starter_count: number;
  avg_overall: number;
}

interface Player {
  id: number;
  player_name: string;
  position: string;
  ovr: number;
  is_starter: boolean;
  laning: number;
  teamfight: number;
  mentality: number;
  consistency: number;
  aggression: number;
}

interface Match {
  id: number;
  home_score: number;
  away_score: number;
  match_date: string;
  home_team_name: string;
  away_team_name: string;
}

interface LeagueStats {
  wins: number;
  losses: number;
  draws: number;
  points: number;
  league_name: string;
}

interface TeamDetail {
  team: Team & {
    diamond: number;
    ticket_price: number;
  };
  players: Player[];
  matches: Match[];
  sponsorIncome: number;
  leagueStats: LeagueStats | null;
}

export default function TeamInfo() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('검색어를 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');
    setSelectedTeam(null);

    try {
      const response = await axios.get(`/api/teams/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
      if (response.data.length === 0) {
        setError('검색 결과가 없습니다');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '검색 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeam = async (teamId: number) => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get(`/api/teams/${teamId}/info`);
      setSelectedTeam(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '팀 정보를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const formatGold = (gold: number) => {
    if (gold >= 100000000) {
      return `${(gold / 100000000).toFixed(1)}억`;
    } else if (gold >= 10000) {
      return `${(gold / 10000).toFixed(1)}만`;
    }
    return gold.toLocaleString();
  };

  const getPositionOrder = (position: string) => {
    const order: { [key: string]: number } = { TOP: 1, JGL: 2, MID: 3, ADC: 4, SUP: 5 };
    return order[position] || 6;
  };

  return (
    <div className="team-info-page">
      <h1>팀 정보</h1>

      <div className="search-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="팀 이름으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={loading}>
            {loading ? '검색중...' : '검색'}
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
      </div>

      {searchResults.length > 0 && !selectedTeam && (
        <div className="search-results">
          <h2>검색 결과</h2>
          <div className="team-list">
            {searchResults.map((team) => (
              <div
                key={team.id}
                className="team-card"
                onClick={() => handleSelectTeam(team.id)}
              >
                <div className="team-header">
                  {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className="team-logo" />
                  ) : (
                    <div className="team-logo-placeholder" style={{ backgroundColor: team.team_color }}>
                      {team.name.charAt(0)}
                    </div>
                  )}
                  <div className="team-name-section">
                    <h3>{team.name}</h3>
                    <span className={`league-badge ${team.league?.toLowerCase()}`}>{team.league}</span>
                    {team.is_ai && <span className="ai-badge">AI</span>}
                  </div>
                </div>
                <div className="team-quick-stats">
                  <div className="stat">
                    <span className="label">팬</span>
                    <span className="value">{team.fan_count?.toLocaleString() || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">선수</span>
                    <span className="value">{team.starter_count}/{team.player_count}</span>
                  </div>
                  <div className="stat">
                    <span className="label">평균 OVR</span>
                    <span className="value">{Math.round(team.avg_overall || 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTeam && (
        <div className="team-detail">
          <button className="back-btn" onClick={() => setSelectedTeam(null)}>
            ← 검색 결과로
          </button>

          <div className="detail-header">
            {selectedTeam.team.logo_url ? (
              <img src={selectedTeam.team.logo_url} alt={selectedTeam.team.name} className="detail-logo" />
            ) : (
              <div className="detail-logo-placeholder" style={{ backgroundColor: selectedTeam.team.team_color }}>
                {selectedTeam.team.name.charAt(0)}
              </div>
            )}
            <div className="detail-title">
              <h2>{selectedTeam.team.name}</h2>
              <span className={`league-badge ${selectedTeam.team.league?.toLowerCase()}`}>
                {selectedTeam.team.league}
              </span>
              {selectedTeam.team.is_ai && <span className="ai-badge">AI</span>}
            </div>
          </div>

          <div className="detail-content">
            <div className="info-grid">
              <div className="info-card">
                <h3>팀 정보</h3>
                <div className="info-row">
                  <span>팬 수</span>
                  <span>{selectedTeam.team.fan_count?.toLocaleString() || 0}명</span>
                </div>
                <div className="info-row">
                  <span>자금</span>
                  <span>{formatGold(selectedTeam.team.gold || 0)}원</span>
                </div>
                <div className="info-row">
                  <span>에너지</span>
                  <span>{selectedTeam.team.diamond || 0}</span>
                </div>
                <div className="info-row">
                  <span>입장료</span>
                  <span>{selectedTeam.team.ticket_price?.toLocaleString() || 5000}원</span>
                </div>
                <div className="info-row">
                  <span>주간 스폰서 수입</span>
                  <span>{formatGold(selectedTeam.sponsorIncome)}원</span>
                </div>
              </div>

              {selectedTeam.leagueStats && (
                <div className="info-card">
                  <h3>리그 현황</h3>
                  <div className="info-row">
                    <span>리그</span>
                    <span>{selectedTeam.leagueStats.league_name}</span>
                  </div>
                  <div className="info-row">
                    <span>승/무/패</span>
                    <span>{selectedTeam.leagueStats.wins}/{selectedTeam.leagueStats.draws}/{selectedTeam.leagueStats.losses}</span>
                  </div>
                  <div className="info-row">
                    <span>승점</span>
                    <span>{selectedTeam.leagueStats.points}점</span>
                  </div>
                </div>
              )}
            </div>

            <div className="players-section">
              <h3>로스터 ({selectedTeam.players.length}명)</h3>
              <div className="players-list">
                {selectedTeam.players
                  .sort((a, b) => getPositionOrder(a.position) - getPositionOrder(b.position))
                  .map((player) => (
                    <div key={player.id} className={`player-row ${player.is_starter ? 'starter' : ''}`}>
                      <span className="position">{player.position}</span>
                      <span className="name">{player.player_name}</span>
                      <span className="ovr">OVR {player.ovr}</span>
                      {player.is_starter && <span className="starter-badge">주전</span>}
                    </div>
                  ))}
              </div>
            </div>

            {selectedTeam.matches.length > 0 && (
              <div className="matches-section">
                <h3>최근 경기</h3>
                <div className="matches-list">
                  {selectedTeam.matches.map((match) => (
                    <div key={match.id} className="match-row">
                      <span className="date">{match.match_date}</span>
                      <span className="teams">
                        <span className={match.home_team_name === selectedTeam.team.name ? 'highlight' : ''}>
                          {match.home_team_name}
                        </span>
                        <span className="score">{match.home_score} - {match.away_score}</span>
                        <span className={match.away_team_name === selectedTeam.team.name ? 'highlight' : ''}>
                          {match.away_team_name}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
