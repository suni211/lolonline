import { useState, useEffect } from 'react';
import axios from 'axios';
import { soundManager } from '../utils/soundManager';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, XAxis, YAxis, Tooltip, Area, AreaChart } from 'recharts';
import './PlayerDetailModal.css';

interface Player {
  id: number;
  name: string;
  nationality: string;
  position: string;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  leadership?: number;
  adaptability?: number;
  consistency?: number;
  work_ethic?: number;
  level: number;
  exp: number;
  exp_to_next: number;
  stat_points: number;
  player_condition: number;
  uniform_level: number;
  injury_status: string;
  injury_recovery_days: number;
  personality?: string;
}

const getPersonalityLabel = (personality: string): string => {
  switch (personality) {
    case 'LEADER': return '리더';
    case 'LONER': return '독불장군';
    case 'TEAMPLAYER': return '팀플레이어';
    case 'HOTHEAD': return '열혈한';
    case 'CALM': return '침착한';
    case 'GREEDY': return '욕심쟁이';
    case 'HUMBLE': return '겸손한';
    case 'PRANKSTER': return '장난꾸러기';
    default: return personality;
  }
};

const getPersonalityDescription = (personality: string): string => {
  switch (personality) {
    case 'LEADER': return '팀을 이끌며 중요한 경기에서 강함';
    case 'LONER': return '혼자 있는 것을 좋아하며 팀 이적에 소극적';
    case 'TEAMPLAYER': return '팀을 위해 양보하며 이적에 적극적';
    case 'HOTHEAD': return '쉽게 흥분하며 갈등을 일으킬 수 있음';
    case 'CALM': return '차분하고 합리적인 협상 가능';
    case 'GREEDY': return '높은 연봉을 요구하며 협상이 어려움';
    case 'HUMBLE': return '낮은 연봉도 수락하며 수락률 높음';
    case 'PRANKSTER': return '팀 분위기를 밝게 하지만 사고칠 수 있음';
    default: return '';
  }
};

interface PlayerDetailModalProps {
  player: Player;
  onClose: () => void;
  onUpdate: () => void;
}

interface ConditionHistory {
  condition_value: number;
  recorded_at: string;
}

export default function PlayerDetailModal({ player, onClose, onUpdate }: PlayerDetailModalProps) {
  const [statAllocation, setStatAllocation] = useState({
    mental: 0,
    teamfight: 0,
    focus: 0,
    laning: 0
  });
  const [conditionHistory, setConditionHistory] = useState<ConditionHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'condition' | 'abilities'>('stats');

  useEffect(() => {
    fetchConditionHistory();
  }, [player.id]);

  const fetchConditionHistory = async () => {
    try {
      const response = await axios.get(`/api/players/${player.id}/condition-history`);
      setConditionHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch condition history:', error);
    }
  };

  // 능력치 레이더 차트 데이터
  const abilityData = [
    { stat: '멘탈', value: player.mental, max: 300 },
    { stat: '한타력', value: player.teamfight, max: 300 },
    { stat: '집중력', value: player.focus, max: 300 },
    { stat: '라인전', value: player.laning, max: 300 },
    { stat: '리더십', value: player.leadership || 50, max: 300 },
    { stat: '적응력', value: player.adaptability || 50, max: 300 },
    { stat: '일관성', value: player.consistency || 50, max: 300 },
    { stat: '노력', value: player.work_ethic || 50, max: 300 },
  ];

  const radarData = abilityData.map(item => ({
    subject: item.stat,
    A: item.value,
    fullMark: 300
  }));

  // 컨디션 그래프 데이터
  const conditionChartData = conditionHistory.map(item => ({
    date: new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    condition: item.condition_value
  }));

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
          {/* 탭 메뉴 */}
          <div className="player-tabs">
            <button
              type="button"
              className={activeTab === 'stats' ? 'tab-active' : 'tab-btn'}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab('stats'); }}
            >
              스탯
            </button>
            <button
              type="button"
              className={activeTab === 'abilities' ? 'tab-active' : 'tab-btn'}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab('abilities'); }}
            >
              능력치
            </button>
            <button
              type="button"
              className={activeTab === 'condition' ? 'tab-active' : 'tab-btn'}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab('condition'); }}
            >
              컨디션
            </button>
          </div>

          <div className="player-info-section">
            <div className="info-row">
              <span>포지션:</span>
              <span className={`position-badge ${player.position}`}>{player.position}</span>
            </div>
            <div className="info-row">
              <span>성격:</span>
              <span className="personality-badge" title={getPersonalityDescription(player.personality || 'CALM')}>
                {getPersonalityLabel(player.personality || 'CALM')}
              </span>
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

          {/* 스탯 탭 */}
          {activeTab === 'stats' && (
            <>
              <div className="stats-section">
                <h3>직접 올릴 수 있는 스탯</h3>
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

              <div className="stats-section">
                <h3>개인의지 스탯 (자동 성장)</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span>리더십:</span>
                    <span>{player.leadership || 50} / 300</span>
                  </div>
                  <div className="stat-item">
                    <span>적응력:</span>
                    <span>{player.adaptability || 50} / 300</span>
                  </div>
                  <div className="stat-item">
                    <span>일관성:</span>
                    <span>{player.consistency || 50} / 300</span>
                  </div>
                  <div className="stat-item">
                    <span>노력:</span>
                    <span>{player.work_ethic || 50} / 300</span>
                  </div>
                </div>
                <p className="stat-note">※ 개인의지 스탯은 선수의 노력(work_ethic)에 따라 자동으로 성장합니다.</p>
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
                {player.uniform_level < 10 && (
                  <button onClick={handleUniformUpgrade} className="btn-primary">
                    유니폼 강화 (비용: {(500000 * Math.pow(2, player.uniform_level)).toLocaleString()} 원)
                  </button>
                )}
              </div>
            </>
          )}

          {/* 능력치 탭 */}
          {activeTab === 'abilities' && (
            <div className="abilities-section">
              <h3>능력치 레이더 차트</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#fff', fontSize: 10 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 300]} tick={{ fill: '#fff', fontSize: 8 }} />
                    <Radar
                      name="능력치"
                      dataKey="A"
                      stroke="#60a5fa"
                      fill="#60a5fa"
                      fillOpacity={0.6}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="ability-details">
                {abilityData.map((item, index) => (
                  <div key={index} className="ability-item">
                    <span className="ability-label">{item.stat}:</span>
                    <div className="ability-bar">
                      <div 
                        className="ability-fill" 
                        style={{ width: `${(item.value / item.max) * 100}%` }}
                      />
                    </div>
                    <span className="ability-value">{item.value} / {item.max}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 컨디션 탭 */}
          {activeTab === 'condition' && (
            <div className="condition-section">
              <h3>최근 컨디션 변화</h3>
              {conditionChartData.length > 0 ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={conditionChartData}>
                      <defs>
                        <linearGradient id="colorCondition" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: '#fff', fontSize: 8 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#fff', fontSize: 8 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #1e3a8a', color: '#fff', fontSize: 10 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="condition"
                        stroke="#60a5fa"
                        fillOpacity={1}
                        fill="url(#colorCondition)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="empty-message">컨디션 기록이 없습니다.</p>
              )}
              <div className="condition-info">
                <p>현재 컨디션: <strong>{player.player_condition}%</strong></p>
                <p className="info-note">컨디션은 경기, 훈련, 휴식에 따라 변화합니다.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
