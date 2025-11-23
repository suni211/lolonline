import { useEffect, useState } from 'react';
import axios from 'axios';
import './Scout.css';

interface ProPlayer {
  id: number;
  name: string;
  position: string;
  nationality: string;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  overall: number;
  face_image: string | null;
}

interface ScoutHistory {
  id: number;
  name: string;
  position: string;
  result: 'SUCCESS' | 'FAILED';
  cost: number;
  dialogue: string;
  created_at: string;
}

export default function Scout() {
  const [availablePlayers, setAvailablePlayers] = useState<ProPlayer[]>([]);
  const [scoutHistory, setScoutHistory] = useState<ScoutHistory[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scoutResult, setScoutResult] = useState<{
    success: boolean;
    message: string;
    dialogue?: string;
    player?: any;
  } | null>(null);

  useEffect(() => {
    fetchAvailablePlayers();
    fetchScoutHistory();
  }, [selectedPosition]);

  const fetchAvailablePlayers = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedPosition) params.append('position', selectedPosition);

      const response = await axios.get(`/api/scout/available?${params}`);
      setAvailablePlayers(response.data);
    } catch (error) {
      console.error('Failed to fetch available players:', error);
    }
  };

  const fetchScoutHistory = async () => {
    try {
      const response = await axios.get('/api/scout/history');
      setScoutHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch scout history:', error);
    }
  };

  const handleScout = async (playerId: number) => {
    if (loading) return;

    setLoading(true);
    setScoutResult(null);

    try {
      const response = await axios.post(`/api/scout/${playerId}/scout`);
      setScoutResult(response.data);

      if (response.data.success) {
        // 성공시 목록에서 제거
        setAvailablePlayers(prev => prev.filter(p => p.id !== playerId));
      }

      fetchScoutHistory();
    } catch (error: any) {
      setScoutResult({
        success: false,
        message: error.response?.data?.error || '스카우트에 실패했습니다'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (cost: number) => {
    if (cost >= 100000000) {
      return `${(cost / 100000000).toFixed(1)}억`;
    } else if (cost >= 10000) {
      return `${(cost / 10000).toFixed(0)}만`;
    }
    return cost.toLocaleString();
  };

  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = {
      'TOP': '#FF6B6B',
      'JUNGLE': '#4ECDC4',
      'MID': '#45B7D1',
      'ADC': '#96CEB4',
      'SUPPORT': '#DDA0DD'
    };
    return colors[position] || '#888';
  };

  return (
    <div className="scout-page">
      <h1 className="page-title">스카우트</h1>

      {scoutResult && (
        <div className={`scout-result ${scoutResult.success ? 'success' : 'failed'}`}>
          <p className="result-message">{scoutResult.message}</p>
          {scoutResult.dialogue && (
            <p className="result-dialogue">"{scoutResult.dialogue}"</p>
          )}
          <button onClick={() => setScoutResult(null)}>확인</button>
        </div>
      )}

      <div className="scout-filters">
        <select
          value={selectedPosition}
          onChange={(e) => setSelectedPosition(e.target.value)}
        >
          <option value="">전체 포지션</option>
          <option value="TOP">탑</option>
          <option value="JUNGLE">정글</option>
          <option value="MID">미드</option>
          <option value="ADC">원딜</option>
          <option value="SUPPORT">서포터</option>
        </select>
      </div>

      <div className="scout-content">
        <div className="available-players">
          <h2>스카우트 가능 선수 ({availablePlayers.length}명)</h2>

          {availablePlayers.length === 0 ? (
            <p className="no-players">스카우트 가능한 선수가 없습니다</p>
          ) : (
            <div className="players-grid">
              {availablePlayers.map(player => (
                <div key={player.id} className="player-card">
                  <div className="player-header">
                    {player.face_image ? (
                      <img src={player.face_image} alt={player.name} className="player-face" />
                    ) : (
                      <div className="player-face-placeholder">
                        {player.name.charAt(0)}
                      </div>
                    )}
                    <div className="player-info">
                      <h3>{player.name}</h3>
                      <span
                        className="position-badge"
                        style={{ backgroundColor: getPositionColor(player.position) }}
                      >
                        {player.position}
                      </span>
                    </div>
                  </div>

                  <div className="player-stats">
                    <div className="stat">
                      <span>멘탈</span>
                      <span>{player.mental}</span>
                    </div>
                    <div className="stat">
                      <span>팀파이트</span>
                      <span>{player.teamfight}</span>
                    </div>
                    <div className="stat">
                      <span>집중력</span>
                      <span>{player.focus}</span>
                    </div>
                    <div className="stat">
                      <span>라인전</span>
                      <span>{player.laning}</span>
                    </div>
                    <div className="stat overall">
                      <span>오버롤</span>
                      <span>{player.overall}</span>
                    </div>
                  </div>

                  <div className="scout-cost">
                    스카우트 비용: {formatCost(player.overall * 100)}
                  </div>

                  <button
                    className="scout-btn"
                    onClick={() => handleScout(player.id)}
                    disabled={loading}
                  >
                    {loading ? '스카우트 중...' : '스카우트'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="scout-history">
          <h2>스카우트 기록</h2>

          {scoutHistory.length === 0 ? (
            <p className="no-history">스카우트 기록이 없습니다</p>
          ) : (
            <div className="history-list">
              {scoutHistory.map(record => (
                <div key={record.id} className={`history-item ${record.result.toLowerCase()}`}>
                  <div className="history-header">
                    <span className="player-name">{record.name}</span>
                    <span
                      className="position-badge"
                      style={{ backgroundColor: getPositionColor(record.position) }}
                    >
                      {record.position}
                    </span>
                    <span className={`result-badge ${record.result.toLowerCase()}`}>
                      {record.result === 'SUCCESS' ? '성공' : '실패'}
                    </span>
                  </div>
                  <div className="history-cost">
                    비용: {formatCost(record.cost)}
                  </div>
                  {record.dialogue && (
                    <div className="history-dialogue">
                      "{record.dialogue}"
                    </div>
                  )}
                  <div className="history-date">
                    {new Date(record.created_at).toLocaleString('ko-KR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
