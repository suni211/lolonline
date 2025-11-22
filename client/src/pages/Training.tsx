import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Training.css';

interface Player {
  id: number;
  name: string;
  position: string;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  level: number;
  injury_status: string;
  overall: number;
}

interface TrainingHistory {
  id: number;
  player_name: string;
  training_type: string;
  stat_type: string;
  exp_gained: number;
  stat_increase: number;
  trained_at: string;
}

export default function Training() {
  const { team } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [selectedStat, setSelectedStat] = useState<'MENTAL' | 'TEAMFIGHT' | 'FOCUS' | 'LANING'>('MENTAL');
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistory[]>([]);
  const [trainingType, setTrainingType] = useState<'individual' | 'team'>('individual');

  useEffect(() => {
    fetchPlayers();
    fetchTrainingHistory();
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await axios.get('/api/players/my');
      setPlayers(response.data);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  const fetchTrainingHistory = async () => {
    try {
      const response = await axios.get('/api/training/history');
      setTrainingHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch training history:', error);
    }
  };

  const handleIndividualTraining = async () => {
    if (!selectedPlayer) {
      alert('선수를 선택해주세요.');
      return;
    }

    try {
      await axios.post('/api/training/individual', {
        player_id: selectedPlayer,
        stat_type: selectedStat
      });
      alert('훈련 완료!');
      fetchPlayers();
      fetchTrainingHistory();
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.error || '훈련 실패');
    }
  };

  const handleTeamTraining = async () => {
    if (!confirm('팀 전체를 훈련시키시겠습니까?')) return;

    try {
      await axios.post('/api/training/team', {
        stat_type: selectedStat
      });
      alert('팀 훈련 완료!');
      fetchPlayers();
      fetchTrainingHistory();
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.error || '훈련 실패');
    }
  };

  const availablePlayers = players.filter(p => p.injury_status === 'NONE');
  const starterPlayers = availablePlayers.filter(p => {
    const player = players.find(pl => pl.id === p.id);
    return player && (player as any).is_starter;
  });

  return (
    <div className="training-page">
      <h1 className="page-title">훈련 시스템</h1>

      <div className="training-sections">
        <div className="training-section">
          <h2>개별 훈련</h2>
          <div className="training-form">
            <div className="form-group">
              <label>선수 선택</label>
              <select
                value={selectedPlayer || ''}
                onChange={(e) => setSelectedPlayer(parseInt(e.target.value) || null)}
                className="form-select"
              >
                <option value="">선수 선택</option>
                {availablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} ({player.position}) - 오버롤: {player.overall}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>훈련할 스탯</label>
              <select
                value={selectedStat}
                onChange={(e) => setSelectedStat(e.target.value as any)}
                className="form-select"
              >
                <option value="MENTAL">멘탈</option>
                <option value="TEAMFIGHT">한타력</option>
                <option value="FOCUS">집중력</option>
                <option value="LANING">라인전</option>
              </select>
            </div>

            {selectedPlayer && (
              <div className="player-preview">
                <h3>선수 정보</h3>
                {(() => {
                  const player = players.find(p => p.id === selectedPlayer);
                  if (!player) return null;
                  return (
                    <div className="preview-stats">
                      <p>현재 {selectedStat === 'MENTAL' ? '멘탈' : selectedStat === 'TEAMFIGHT' ? '한타력' : selectedStat === 'FOCUS' ? '집중력' : '라인전'}: {
                        selectedStat === 'MENTAL' ? player.mental :
                        selectedStat === 'TEAMFIGHT' ? player.teamfight :
                        selectedStat === 'FOCUS' ? player.focus :
                        player.laning
                      } / 300</p>
                    </div>
                  );
                })()}
              </div>
            )}

            <button
              onClick={handleIndividualTraining}
              className="btn-primary"
              disabled={!selectedPlayer}
            >
              개별 훈련 시작
            </button>
          </div>
        </div>

        <div className="training-section">
          <h2>팀 훈련</h2>
          <div className="training-form">
            <div className="form-group">
              <label>훈련할 스탯</label>
              <select
                value={selectedStat}
                onChange={(e) => setSelectedStat(e.target.value as any)}
                className="form-select"
              >
                <option value="MENTAL">멘탈</option>
                <option value="TEAMFIGHT">한타력</option>
                <option value="FOCUS">집중력</option>
                <option value="LANING">라인전</option>
              </select>
            </div>

            <div className="team-info">
              <p>스타터 선수: {starterPlayers.length}명</p>
              <p>훈련 가능 선수: {availablePlayers.length}명</p>
            </div>

            <button
              onClick={handleTeamTraining}
              className="btn-primary"
              disabled={starterPlayers.length < 5}
            >
              팀 훈련 시작 (스타터 {starterPlayers.length}명)
            </button>
          </div>
        </div>
      </div>

      <div className="training-history-section">
        <h2>훈련 기록</h2>
        <div className="history-list">
          {trainingHistory.length > 0 ? (
            <table className="history-table">
              <thead>
                <tr>
                  <th>선수</th>
                  <th>훈련 종류</th>
                  <th>스탯</th>
                  <th>경험치</th>
                  <th>스탯 증가</th>
                  <th>날짜</th>
                </tr>
              </thead>
              <tbody>
                {trainingHistory.map((history) => (
                  <tr key={history.id}>
                    <td>{history.player_name}</td>
                    <td>{history.training_type === 'INDIVIDUAL' ? '개별' : '팀'}</td>
                    <td>
                      {history.stat_type === 'MENTAL' ? '멘탈' :
                       history.stat_type === 'TEAMFIGHT' ? '한타력' :
                       history.stat_type === 'FOCUS' ? '집중력' : '라인전'}
                    </td>
                    <td>+{history.exp_gained}</td>
                    <td>+{history.stat_increase}</td>
                    <td>{new Date(history.trained_at).toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-message">훈련 기록이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

