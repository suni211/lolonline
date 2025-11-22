import { useEffect, useState } from 'react';
import axios from 'axios';
import './Leagues.css';

interface League {
  id: number;
  name: string;
  region: string;
  season: number;
  current_month: number;
  status: string;
}

interface Standing {
  team_name: string;
  wins: number;
  losses: number;
  draws: number;
  total_points: number;
  goal_difference: number;
  rank: number;
}

export default function Leagues() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [playoffBracket, setPlayoffBracket] = useState<any[]>([]);

  useEffect(() => {
    fetchLeagues();
  }, []);

  useEffect(() => {
    if (selectedLeague) {
      fetchLeagueDetails(selectedLeague.id);
    }
  }, [selectedLeague]);

  const fetchLeagues = async () => {
    try {
      const response = await axios.get('/api/leagues');
      setLeagues(response.data);
      if (response.data.length > 0) {
        setSelectedLeague(response.data[0]);
      }
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

  return (
    <div className="leagues-page">
      <h1 className="page-title">리그</h1>

      <div className="league-selector">
        {leagues.map((league) => (
          <button
            key={league.id}
            onClick={() => setSelectedLeague(league)}
            className={`league-btn ${selectedLeague?.id === league.id ? 'active' : ''}`}
          >
            {league.name} - 시즌 {league.season} ({league.current_month}월)
            {league.status === 'PLAYOFF' && ' - 플레이오프'}
            {league.status === 'OFFSEASON' && ' - 스토브리그'}
          </button>
        ))}
      </div>

      {selectedLeague && (
        <div className="league-content">
          <div className="league-info">
            <h2>{selectedLeague.name}</h2>
            <p>시즌 {selectedLeague.season} | {selectedLeague.current_month}월</p>
            <p className={`status-badge ${selectedLeague.status.toLowerCase()}`}>
              {selectedLeague.status === 'REGULAR' && '정규시즌'}
              {selectedLeague.status === 'PLAYOFF' && '플레이오프'}
              {selectedLeague.status === 'OFFSEASON' && '스토브리그'}
            </p>
          </div>

          {selectedLeague.status === 'PLAYOFF' && playoffBracket.length > 0 && (
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
                {standings.map((standing, idx) => (
                  <tr key={idx} className={standing.rank <= 4 ? 'top-four' : ''}>
                    <td>{standing.rank || idx + 1}</td>
                    <td>{standing.team_name}</td>
                    <td>{standing.wins}</td>
                    <td>{standing.draws}</td>
                    <td>{standing.losses}</td>
                    <td>{standing.goal_difference > 0 ? '+' : ''}{standing.goal_difference}</td>
                    <td className="points">{standing.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="upcoming-matches-section">
            <h3>다음 경기</h3>
            <div className="matches-list">
              {upcomingMatches.map((match) => (
                <div key={match.id} className="match-item">
                  <span>{match.home_team_name} vs {match.away_team_name}</span>
                  <span className="match-time">
                    {new Date(match.scheduled_at).toLocaleString('ko-KR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

