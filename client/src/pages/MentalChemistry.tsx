import { useState, useEffect } from 'react';
import axios from 'axios';
import './MentalChemistry.css';

interface PlayerMental {
  player_card_id: number;
  name: string;
  position: string;
  morale: number;
  stress: number;
  confidence: number;
  team_satisfaction: number;
}

interface TeamMentalData {
  players: PlayerMental[];
  average: {
    morale: number;
    stress: number;
    confidence: number;
    team_satisfaction: number;
  };
}

interface Chemistry {
  chemistry: number;
  details: Array<{
    player1: number;
    player2: number;
    value: number;
    type: string;
  }>;
}

export default function MentalChemistry() {
  const [mentalData, setMentalData] = useState<TeamMentalData | null>(null);
  const [chemistry, setChemistry] = useState<Chemistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerMental | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mentalRes, chemistryRes] = await Promise.all([
        axios.get('/api/mental/team'),
        axios.get('/api/mental/chemistry')
      ]);
      setMentalData(mentalRes.data);
      setChemistry(chemistryRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCare = async (playerCardId: number, careType: string) => {
    try {
      setActionLoading(true);
      const res = await axios.post('/api/mental/care', { playerCardId, careType });
      alert(res.data.message);
      setSelectedPlayer(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || '케어 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatColor = (value: number, isStress: boolean = false) => {
    if (isStress) {
      if (value <= 30) return '#4ecdc4';
      if (value <= 60) return '#f9ca24';
      return '#ff6b6b';
    }
    if (value >= 70) return '#4ecdc4';
    if (value >= 40) return '#f9ca24';
    return '#ff6b6b';
  };

  const getChemistryColor = (value: number) => {
    if (value >= 80) return '#4ecdc4';
    if (value >= 60) return '#4a9eff';
    if (value >= 40) return '#f9ca24';
    return '#ff6b6b';
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'TOP': return '#ff6b6b';
      case 'JUNGLE': return '#4ecdc4';
      case 'MID': return '#45b7d1';
      case 'ADC': return '#f9ca24';
      case 'SUPPORT': return '#a29bfe';
      default: return '#888';
    }
  };

  if (loading) {
    return <div className="mental-chemistry-page"><div className="loading">로딩 중...</div></div>;
  }

  return (
    <div className="mental-chemistry-page">
      <h1>멘탈 & 케미스트리</h1>

      {chemistry && (
        <div className="chemistry-section">
          <h2>팀 케미스트리</h2>
          <div className="chemistry-score" style={{ color: getChemistryColor(chemistry.chemistry) }}>
            {chemistry.chemistry}
          </div>
          <div className="chemistry-label">
            {chemistry.chemistry >= 80 ? '최상' :
             chemistry.chemistry >= 60 ? '좋음' :
             chemistry.chemistry >= 40 ? '보통' : '나쁨'}
          </div>
        </div>
      )}

      {mentalData && (
        <>
          <div className="average-section">
            <h2>팀 평균 멘탈</h2>
            <div className="average-stats">
              <div className="avg-stat">
                <span>사기</span>
                <div className="bar">
                  <div
                    className="fill"
                    style={{
                      width: `${mentalData.average.morale}%`,
                      backgroundColor: getStatColor(mentalData.average.morale)
                    }}
                  />
                </div>
                <span>{mentalData.average.morale}</span>
              </div>
              <div className="avg-stat">
                <span>스트레스</span>
                <div className="bar">
                  <div
                    className="fill"
                    style={{
                      width: `${mentalData.average.stress}%`,
                      backgroundColor: getStatColor(mentalData.average.stress, true)
                    }}
                  />
                </div>
                <span>{mentalData.average.stress}</span>
              </div>
              <div className="avg-stat">
                <span>자신감</span>
                <div className="bar">
                  <div
                    className="fill"
                    style={{
                      width: `${mentalData.average.confidence}%`,
                      backgroundColor: getStatColor(mentalData.average.confidence)
                    }}
                  />
                </div>
                <span>{mentalData.average.confidence}</span>
              </div>
              <div className="avg-stat">
                <span>팀 만족도</span>
                <div className="bar">
                  <div
                    className="fill"
                    style={{
                      width: `${mentalData.average.team_satisfaction}%`,
                      backgroundColor: getStatColor(mentalData.average.team_satisfaction)
                    }}
                  />
                </div>
                <span>{mentalData.average.team_satisfaction}</span>
              </div>
            </div>
          </div>

          <div className="players-section">
            <h2>선수별 멘탈 상태</h2>
            <div className="player-grid">
              {mentalData.players.map(player => (
                <div
                  key={player.player_card_id}
                  className="player-mental-card"
                  onClick={() => setSelectedPlayer(player)}
                >
                  <div className="position" style={{ color: getPositionColor(player.position) }}>
                    {player.position}
                  </div>
                  <div className="name">{player.name}</div>
                  <div className="mental-bars">
                    <div className="mini-bar">
                      <span>사기</span>
                      <div className="bar-bg">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${player.morale}%`,
                            backgroundColor: getStatColor(player.morale)
                          }}
                        />
                      </div>
                    </div>
                    <div className="mini-bar">
                      <span>스트레스</span>
                      <div className="bar-bg">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${player.stress}%`,
                            backgroundColor: getStatColor(player.stress, true)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {selectedPlayer && (
        <div className="player-modal" onClick={() => setSelectedPlayer(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{selectedPlayer.name} 멘탈 케어</h2>
            <div className="mental-details">
              <div className="detail">사기: {selectedPlayer.morale}</div>
              <div className="detail">스트레스: {selectedPlayer.stress}</div>
              <div className="detail">자신감: {selectedPlayer.confidence}</div>
              <div className="detail">팀 만족도: {selectedPlayer.team_satisfaction}</div>
            </div>
            <div className="care-options">
              <button onClick={() => handleCare(selectedPlayer.player_card_id, 'REST')} disabled={actionLoading}>
                휴식 (무료)<br />
                <small>사기+5, 스트레스-10</small>
              </button>
              <button onClick={() => handleCare(selectedPlayer.player_card_id, 'COUNSELING')} disabled={actionLoading}>
                상담 (500,000)<br />
                <small>사기+10, 스트레스-15, 자신감+5</small>
              </button>
              <button onClick={() => handleCare(selectedPlayer.player_card_id, 'VACATION')} disabled={actionLoading}>
                휴가 (2,000,000)<br />
                <small>사기+20, 스트레스-30, 자신감+10, 만족도+10</small>
              </button>
            </div>
            <button className="close-btn" onClick={() => setSelectedPlayer(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
