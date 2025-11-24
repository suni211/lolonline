import { useState, useEffect } from 'react';
import axios from 'axios';
import './SecondTeam.css';

interface Academy {
  id: number;
  team_id: number;
  level: number;
  capacity: number;
  training_quality: number;
  scouting_range: number;
  players: YouthPlayer[];
}

interface YouthPlayer {
  id: number;
  name: string;
  position: string;
  age: number;
  potential: number;
  current_overall: number;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  training_progress: number;
  graduation_ready: boolean;
}

export default function SecondTeam() {
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<YouthPlayer | null>(null);

  useEffect(() => {
    fetchAcademy();
  }, []);

  const fetchAcademy = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/academy');
      setAcademy(res.data);
    } catch (error) {
      console.error('Failed to fetch academy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      setActionLoading(true);
      const res = await axios.post('/api/academy/upgrade');
      alert(`아카데미 레벨 ${res.data.newLevel} 업그레이드 완료`);
      fetchAcademy();
    } catch (error: any) {
      alert(error.response?.data?.error || '업그레이드 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScout = async () => {
    try {
      setActionLoading(true);
      const res = await axios.post('/api/academy/scout');
      alert(`${res.data.player.name} 선수 스카우트 완료! (잠재력: ${res.data.player.potential})`);
      fetchAcademy();
    } catch (error: any) {
      alert(error.response?.data?.error || '스카우트 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTrain = async (playerId: number) => {
    try {
      setActionLoading(true);
      const res = await axios.post(`/api/academy/train/${playerId}`);
      alert(`훈련 완료! 오버롤: ${res.data.newOverall}`);
      fetchAcademy();
    } catch (error: any) {
      alert(error.response?.data?.error || '훈련 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromote = async (playerId: number) => {
    if (!confirm('이 선수를 1군으로 승격시키겠습니까?')) return;

    try {
      setActionLoading(true);
      const res = await axios.post(`/api/academy/promote/${playerId}`);
      alert(res.data.message);
      setSelectedPlayer(null);
      fetchAcademy();
    } catch (error: any) {
      alert(error.response?.data?.error || '승격 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async (playerId: number) => {
    if (!confirm('이 선수를 방출하시겠습니까?')) return;

    try {
      setActionLoading(true);
      await axios.delete(`/api/academy/release/${playerId}`);
      alert('선수 방출 완료');
      setSelectedPlayer(null);
      fetchAcademy();
    } catch (error: any) {
      alert(error.response?.data?.error || '방출 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const getScoutingRangeName = (range: number) => {
    switch (range) {
      case 1: return '지역';
      case 2: return '전국';
      case 3: return '해외';
      default: return '-';
    }
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
    return <div className="second-team-page"><div className="loading">로딩 중...</div></div>;
  }

  return (
    <div className="second-team-page">
      <h1>2군 (유스 아카데미)</h1>

      {academy && (
        <>
          <div className="academy-info">
            <div className="info-card">
              <h3>아카데미 레벨</h3>
              <div className="value">{academy.level}</div>
            </div>
            <div className="info-card">
              <h3>수용 인원</h3>
              <div className="value">{academy.players.length} / {academy.capacity}</div>
            </div>
            <div className="info-card">
              <h3>훈련 품질</h3>
              <div className="value">{academy.training_quality}%</div>
            </div>
            <div className="info-card">
              <h3>스카우팅 범위</h3>
              <div className="value">{getScoutingRangeName(academy.scouting_range)}</div>
            </div>
          </div>

          <div className="academy-actions">
            <button onClick={handleUpgrade} disabled={actionLoading || academy.level >= 5}>
              아카데미 업그레이드
            </button>
            <button onClick={handleScout} disabled={actionLoading || academy.players.length >= academy.capacity}>
              유스 선수 스카우트
            </button>
          </div>

          <div className="youth-roster">
            <h2>유스 선수 명단</h2>
            {academy.players.length === 0 ? (
              <p className="empty">유스 선수가 없습니다. 스카우트를 진행하세요.</p>
            ) : (
              <div className="player-grid">
                {academy.players.map(player => (
                  <div
                    key={player.id}
                    className={`player-card ${player.graduation_ready ? 'ready' : ''}`}
                    onClick={() => setSelectedPlayer(player)}
                  >
                    <div className="position" style={{ color: getPositionColor(player.position) }}>
                      {player.position}
                    </div>
                    <div className="name">{player.name}</div>
                    <div className="stats">
                      <span>OVR {player.current_overall}</span>
                      <span>잠재력 {player.potential}</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="fill"
                        style={{ width: `${Math.min(100, player.training_progress)}%` }}
                      />
                    </div>
                    <div className="progress-text">{player.training_progress}%</div>
                    {player.graduation_ready && <div className="ready-badge">승격 가능</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedPlayer && (
            <div className="player-modal" onClick={() => setSelectedPlayer(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{selectedPlayer.name}</h2>
                <div className="player-details">
                  <div className="detail-row">
                    <span>포지션</span>
                    <span style={{ color: getPositionColor(selectedPlayer.position) }}>
                      {selectedPlayer.position}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>나이</span>
                    <span>{selectedPlayer.age}세</span>
                  </div>
                  <div className="detail-row">
                    <span>현재 오버롤</span>
                    <span>{selectedPlayer.current_overall}</span>
                  </div>
                  <div className="detail-row">
                    <span>잠재력</span>
                    <span>{selectedPlayer.potential}</span>
                  </div>
                  <div className="detail-row">
                    <span>멘탈</span>
                    <span>{selectedPlayer.mental}</span>
                  </div>
                  <div className="detail-row">
                    <span>팀파이트</span>
                    <span>{selectedPlayer.teamfight}</span>
                  </div>
                  <div className="detail-row">
                    <span>집중력</span>
                    <span>{selectedPlayer.focus}</span>
                  </div>
                  <div className="detail-row">
                    <span>라이닝</span>
                    <span>{selectedPlayer.laning}</span>
                  </div>
                  <div className="detail-row">
                    <span>훈련 진행도</span>
                    <span>{selectedPlayer.training_progress}%</span>
                  </div>
                </div>
                <div className="modal-actions">
                  <button onClick={() => handleTrain(selectedPlayer.id)} disabled={actionLoading}>
                    훈련
                  </button>
                  {selectedPlayer.graduation_ready && (
                    <button
                      className="promote"
                      onClick={() => handlePromote(selectedPlayer.id)}
                      disabled={actionLoading}
                    >
                      1군 승격
                    </button>
                  )}
                  <button
                    className="release"
                    onClick={() => handleRelease(selectedPlayer.id)}
                    disabled={actionLoading}
                  >
                    방출
                  </button>
                  <button className="close" onClick={() => setSelectedPlayer(null)}>
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
