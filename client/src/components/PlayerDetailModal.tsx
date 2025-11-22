import { useState } from 'react';
import axios from 'axios';
import { soundManager } from '../utils/soundManager';
import './PlayerDetailModal.css';

interface Player {
  id: number;
  name: string;
  position: string;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  level: number;
  exp: number;
  exp_to_next: number;
  stat_points: number;
  player_condition: number;
  uniform_level: number;
  injury_status: string;
  injury_recovery_days: number;
}

interface PlayerDetailModalProps {
  player: Player;
  onClose: () => void;
  onUpdate: () => void;
}

export default function PlayerDetailModal({ player, onClose, onUpdate }: PlayerDetailModalProps) {
  const [statAllocation, setStatAllocation] = useState({
    mental: 0,
    teamfight: 0,
    focus: 0,
    laning: 0
  });
  const [showLevelUp, setShowLevelUp] = useState(false);

  const canLevelUp = player.exp >= player.exp_to_next;

  const handleLevelUp = async () => {
    const total = statAllocation.mental + statAllocation.teamfight + statAllocation.focus + statAllocation.laning;
    if (total === 0) {
      alert('스탯을 분배해주세요.');
      return;
    }
    if (total > player.stat_points) {
      alert('스탯 포인트가 부족합니다.');
      return;
    }

    try {
      await axios.post(`/api/players/${player.id}/levelup`, { stat_allocation: statAllocation });
      soundManager.playSound('upgrade_success');
      alert('레벨업 완료!');
      setStatAllocation({ mental: 0, teamfight: 0, focus: 0, laning: 0 });
      setShowLevelUp(false);
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || '레벨업 실패');
    }
  };

  const handleStatUpdate = async () => {
    const total = statAllocation.mental + statAllocation.teamfight + statAllocation.focus + statAllocation.laning;
    if (total === 0) {
      alert('스탯을 분배해주세요.');
      return;
    }
    if (total > player.stat_points) {
      alert('스탯 포인트가 부족합니다.');
      return;
    }

    try {
      await axios.post(`/api/players/${player.id}/stats`, {
        mental: player.mental + statAllocation.mental,
        teamfight: player.teamfight + statAllocation.teamfight,
        focus: player.focus + statAllocation.focus,
        laning: player.laning + statAllocation.laning
      });
      soundManager.playSound('click');
      alert('스탯 업데이트 완료!');
      setStatAllocation({ mental: 0, teamfight: 0, focus: 0, laning: 0 });
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || '스탯 업데이트 실패');
    }
  };

  const handleUniformUpgrade = async () => {
    if (!confirm('유니폼을 강화하시겠습니까?')) return;

    try {
      const response = await axios.post(`/api/players/${player.id}/uniform/upgrade`);
      if (response.data.success) {
        soundManager.playSound('upgrade_success');
        alert(response.data.message);
      } else {
        soundManager.playSound('upgrade_fail');
        alert(response.data.message);
      }
      onUpdate();
    } catch (error: any) {
      soundManager.playSound('upgrade_fail');
      alert(error.response?.data?.error || '강화 실패');
    }
  };

  const remainingPoints = player.stat_points - 
    (statAllocation.mental + statAllocation.teamfight + statAllocation.focus + statAllocation.laning);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{player.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="player-info-section">
            <div className="info-row">
              <span>포지션:</span>
              <span className={`position-badge ${player.position}`}>{player.position}</span>
            </div>
            <div className="info-row">
              <span>레벨:</span>
              <span>{player.level}</span>
            </div>
            <div className="info-row">
              <span>경험치:</span>
              <span>{player.exp} / {player.exp_to_next}</span>
            </div>
            <div className="info-row">
              <span>스탯 포인트:</span>
              <span>{player.stat_points}</span>
            </div>
            <div className="info-row">
              <span>컨디션:</span>
              <span>{player.player_condition}%</span>
            </div>
            <div className="info-row">
              <span>유니폼 강화:</span>
              <span>+{player.uniform_level} / 10</span>
            </div>
            {player.injury_status !== 'NONE' && (
              <div className="info-row injury-row">
                <span>부상 상태:</span>
                <span className="injury-badge">
                  {player.injury_status === 'MINOR' ? '경미' : 
                   player.injury_status === 'MODERATE' ? '중상' : '중증'} 
                  ({player.injury_recovery_days}일 남음)
                </span>
              </div>
            )}
          </div>

          <div className="stats-section">
            <h3>현재 스탯</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span>멘탈:</span>
                <span>{player.mental} / 300</span>
              </div>
              <div className="stat-item">
                <span>한타력:</span>
                <span>{player.teamfight} / 300</span>
              </div>
              <div className="stat-item">
                <span>집중력:</span>
                <span>{player.focus} / 300</span>
              </div>
              <div className="stat-item">
                <span>라인전:</span>
                <span>{player.laning} / 300</span>
              </div>
            </div>
          </div>

          {player.stat_points > 0 && (
            <div className="stat-allocation-section">
              <h3>스탯 분배</h3>
              <div className="allocation-inputs">
                <div className="allocation-item">
                  <label>멘탈:</label>
                  <input
                    type="number"
                    min="0"
                    max={Math.min(300 - player.mental, remainingPoints + statAllocation.mental)}
                    value={statAllocation.mental}
                    onChange={(e) => setStatAllocation({ ...statAllocation, mental: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="allocation-item">
                  <label>한타력:</label>
                  <input
                    type="number"
                    min="0"
                    max={Math.min(300 - player.teamfight, remainingPoints + statAllocation.teamfight)}
                    value={statAllocation.teamfight}
                    onChange={(e) => setStatAllocation({ ...statAllocation, teamfight: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="allocation-item">
                  <label>집중력:</label>
                  <input
                    type="number"
                    min="0"
                    max={Math.min(300 - player.focus, remainingPoints + statAllocation.focus)}
                    value={statAllocation.focus}
                    onChange={(e) => setStatAllocation({ ...statAllocation, focus: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="allocation-item">
                  <label>라인전:</label>
                  <input
                    type="number"
                    min="0"
                    max={Math.min(300 - player.laning, remainingPoints + statAllocation.laning)}
                    value={statAllocation.laning}
                    onChange={(e) => setStatAllocation({ ...statAllocation, laning: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <p className="remaining-points">남은 포인트: {remainingPoints}</p>
              <div className="stat-actions">
                <button onClick={handleStatUpdate} className="btn-primary">
                  스탯 적용
                </button>
              </div>
            </div>
          )}

          <div className="actions-section">
            {canLevelUp && (
              <button onClick={() => setShowLevelUp(!showLevelUp)} className="btn-primary">
                레벨업 ({player.stat_points + 5} 포인트 획득)
              </button>
            )}
            {showLevelUp && canLevelUp && (
              <div className="levelup-section">
                <p>레벨업 시 스탯 포인트 5개를 추가로 획득합니다.</p>
                <button onClick={handleLevelUp} className="btn-primary">
                  레벨업 실행
                </button>
              </div>
            )}
            {player.uniform_level < 10 && (
              <button onClick={handleUniformUpgrade} className="btn-primary">
                유니폼 강화 (비용: {(player.uniform_level + 1) * 5000} 골드)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

