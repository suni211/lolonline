import { useState, useEffect } from 'react';
import axios from 'axios';
import './Worlds.css';

interface WorldsData {
  exists: boolean;
  tournament?: {
    id: number;
    season: number;
    status: string;
    prize_pool: number;
    champion_team_id: number | null;
  };
  participants?: Array<{
    team_id: number;
    team_name: string;
    logo_url: string;
    region: string;
    seed: number;
    eliminated: boolean;
    final_rank: number | null;
  }>;
  matches?: Array<{
    id: number;
    round: string;
    match_number: number;
    team1_id: number | null;
    team1_name: string | null;
    team1_logo: string | null;
    team2_id: number | null;
    team2_name: string | null;
    team2_logo: string | null;
    team1_score: number;
    team2_score: number;
    winner_id: number | null;
    scheduled_at: string;
    status: string;
  }>;
}

export default function Worlds() {
  const [worldsData, setWorldsData] = useState<WorldsData | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorlds();
  }, [selectedSeason]);

  const fetchWorlds = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/league-structure/worlds/${selectedSeason}`);
      setWorldsData(res.data);
    } catch (error) {
      console.error('Failed to fetch worlds:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return '대기 중';
      case 'ONGOING': return '진행 중';
      case 'FINISHED': return '종료';
      default: return status;
    }
  };

  const getRoundLabel = (round: string) => {
    switch (round) {
      case 'QUARTER': return '8강';
      case 'SEMI': return '4강';
      case 'FINAL': return '결승';
      default: return round;
    }
  };

  if (loading) {
    return <div className="worlds-page"><div className="loading">로딩 중...</div></div>;
  }

  return (
    <div className="worlds-page">
      <h1>WORLDS</h1>

      <div className="season-selector">
        <label>시즌:</label>
        <select value={selectedSeason} onChange={e => setSelectedSeason(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map(s => (
            <option key={s} value={s}>시즌 {s}</option>
          ))}
        </select>
      </div>

      {!worldsData?.exists ? (
        <div className="no-worlds">
          <p>해당 시즌의 WORLDS 정보가 없습니다</p>
        </div>
      ) : (
        <>
          <div className="tournament-info">
            <div className="info-item">
              <span>상태</span>
              <span>{getStatusLabel(worldsData.tournament?.status || '')}</span>
            </div>
            <div className="info-item">
              <span>총 상금</span>
              <span>{(worldsData.tournament?.prize_pool || 0).toLocaleString()} 원</span>
            </div>
          </div>

          <div className="participants-section">
            <h2>참가팀</h2>
            <div className="region-split">
              <div className="region">
                <h3>LPO SOUTH</h3>
                <div className="team-list">
                  {worldsData.participants
                    ?.filter(p => p.region === 'SOUTH')
                    .sort((a, b) => a.seed - b.seed)
                    .map(p => (
                      <div key={p.team_id} className={`team-item ${p.eliminated ? 'eliminated' : ''}`}>
                        <span className="seed">#{p.seed}</span>
                        <span className="name">{p.team_name}</span>
                        {p.eliminated && <span className="status">탈락</span>}
                      </div>
                    ))}
                </div>
              </div>
              <div className="region">
                <h3>LPO NORTH</h3>
                <div className="team-list">
                  {worldsData.participants
                    ?.filter(p => p.region === 'NORTH')
                    .sort((a, b) => a.seed - b.seed)
                    .map(p => (
                      <div key={p.team_id} className={`team-item ${p.eliminated ? 'eliminated' : ''}`}>
                        <span className="seed">#{p.seed}</span>
                        <span className="name">{p.team_name}</span>
                        {p.eliminated && <span className="status">탈락</span>}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bracket-section">
            <h2>대진표</h2>
            <div className="bracket">
              {['QUARTER', 'SEMI', 'FINAL'].map(round => (
                <div key={round} className="round">
                  <h3>{getRoundLabel(round)}</h3>
                  <div className="matches">
                    {worldsData.matches
                      ?.filter(m => m.round === round)
                      .sort((a, b) => a.match_number - b.match_number)
                      .map(match => (
                        <div key={match.id} className={`match ${match.status}`}>
                          <div className={`team ${match.winner_id === match.team1_id ? 'winner' : ''}`}>
                            <span>{match.team1_name || 'TBD'}</span>
                            <span className="score">{match.team1_score}</span>
                          </div>
                          <div className={`team ${match.winner_id === match.team2_id ? 'winner' : ''}`}>
                            <span>{match.team2_name || 'TBD'}</span>
                            <span className="score">{match.team2_score}</span>
                          </div>
                          <div className="match-time">
                            {new Date(match.scheduled_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
