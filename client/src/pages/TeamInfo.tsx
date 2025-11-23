import { useState, useEffect } from 'react';
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

type SortType = 'fan_count' | 'gold' | 'avg_overall' | 'name';
type SortOrder = 'asc' | 'desc';

export default function TeamInfo() {
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 필터/정렬 상태
  const [sortBy, setSortBy] = useState<SortType>('fan_count');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [leagueFilter, setLeagueFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAI, setShowAI] = useState(true);

  useEffect(() => {
    fetchAllTeams();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [allTeams, sortBy, sortOrder, leagueFilter, searchQuery, showAI]);

  const fetchAllTeams = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/teams/all');
      setAllTeams(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '팀 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let teams = [...allTeams];

    // AI 팀 필터
    if (!showAI) {
      teams = teams.filter(team => !team.is_ai);
    }

    // 리그 필터
    if (leagueFilter) {
      teams = teams.filter(team => team.league === leagueFilter);
    }

    // 검색 필터
    if (searchQuery) {
      teams = teams.filter(team =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 정렬
    teams.sort((a, b) => {
      let compareA: number | string = 0;
      let compareB: number | string = 0;

      switch (sortBy) {
        case 'fan_count':
          compareA = a.fan_count || 0;
          compareB = b.fan_count || 0;
          break;
        case 'gold':
          compareA = a.gold || 0;
          compareB = b.gold || 0;
          break;
        case 'avg_overall':
          compareA = a.avg_overall || 0;
          compareB = b.avg_overall || 0;
          break;
        case 'name':
          compareA = a.name;
          compareB = b.name;
          break;
      }

      if (typeof compareA === 'string') {
        return sortOrder === 'asc'
          ? compareA.localeCompare(compareB as string)
          : (compareB as string).localeCompare(compareA);
      }

      return sortOrder === 'asc'
        ? (compareA as number) - (compareB as number)
        : (compareB as number) - (compareA as number);
    });

    setFilteredTeams(teams);
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
      return `${(gold / 10000).toFixed(0)}만`;
    }
    return gold.toLocaleString();
  };

  const getPositionOrder = (position: string) => {
    const order: { [key: string]: number } = { TOP: 1, JGL: 2, MID: 3, ADC: 4, SUP: 5 };
    return order[position] || 6;
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="team-info-page">
      <h1>팀 정보</h1>

      {!selectedTeam && (
        <>
          <div className="filter-section">
            <div className="filter-row">
              <div className="filter-group">
                <label>정렬</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortType)}>
                  <option value="fan_count">팬 수</option>
                  <option value="gold">자금</option>
                  <option value="avg_overall">평균 OVR</option>
                  <option value="name">이름</option>
                </select>
                <button className="sort-order-btn" onClick={toggleSortOrder}>
                  {sortOrder === 'desc' ? '↓' : '↑'}
                </button>
              </div>

              <div className="filter-group">
                <label>리그</label>
                <select value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)}>
                  <option value="">전체</option>
                  <option value="SUPER">SUPER</option>
                  <option value="FIRST">FIRST</option>
                  <option value="SECOND">SECOND</option>
                </select>
              </div>

              <div className="filter-group">
                <label>
                  <input
                    type="checkbox"
                    checked={showAI}
                    onChange={(e) => setShowAI(e.target.checked)}
                  />
                  AI 팀 표시
                </label>
              </div>

              <div className="filter-group search-group">
                <input
                  type="text"
                  placeholder="팀 이름 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="loading">로딩 중...</div>
          ) : (
            <div className="team-list">
              <div className="team-count">총 {filteredTeams.length}개 팀</div>
              {filteredTeams.map((team, index) => (
                <div
                  key={team.id}
                  className="team-card"
                  onClick={() => handleSelectTeam(team.id)}
                >
                  <div className="team-rank">{index + 1}</div>
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
                      <span className="value">{(team.fan_count || 0).toLocaleString()}</span>
                    </div>
                    <div className="stat">
                      <span className="label">자금</span>
                      <span className="value">{formatGold(team.gold || 0)}</span>
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
          )}
        </>
      )}

      {selectedTeam && (
        <div className="team-detail">
          <button className="back-btn" onClick={() => setSelectedTeam(null)}>
            ← 목록으로
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
