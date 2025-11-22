import { useState, useEffect } from 'react';
import axios from 'axios';
import './Tactics.css';

interface Tactic {
  id: number;
  name: string;
  description: string;
  early_game: string;
  mid_game: string;
  late_game: string;
  teamfight_style: string;
  is_active: boolean;
}

interface PositionTactic {
  position: string;
  playstyle: string;
  priority: string;
}

export default function Tactics() {
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [selectedTactic, setSelectedTactic] = useState<Tactic | null>(null);
  const [positionTactics, setPositionTactics] = useState<PositionTactic[]>([]);
  const [loading, setLoading] = useState(false);
  void loading; // 로딩 상태 표시에 사용 예정
  const [message, setMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [newTactic, setNewTactic] = useState({
    name: '',
    description: '',
    early_game: 'balanced',
    mid_game: 'balanced',
    late_game: 'balanced',
    teamfight_style: 'engage'
  });

  const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
  const playstyles = [
    { value: 'aggressive', label: '공격적' },
    { value: 'passive', label: '수비적' },
    { value: 'roaming', label: '로밍' },
    { value: 'farming', label: '파밍' }
  ];
  const priorities = [
    { value: 'carry', label: '캐리' },
    { value: 'support', label: '서포트' },
    { value: 'tank', label: '탱커' },
    { value: 'utility', label: '유틸' }
  ];
  const gamePhases = [
    { value: 'aggressive', label: '공격적' },
    { value: 'passive', label: '수비적' },
    { value: 'balanced', label: '균형' }
  ];
  const teamfightStyles = [
    { value: 'engage', label: '돌격' },
    { value: 'disengage', label: '회피' },
    { value: 'poke', label: '견제' },
    { value: 'protect', label: '보호' }
  ];

  useEffect(() => {
    fetchTactics();
  }, []);

  const fetchTactics = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/tactics');
      setTactics(res.data);
    } catch (error) {
      console.error('Failed to fetch tactics:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectTactic = async (tactic: Tactic) => {
    setSelectedTactic(tactic);
    try {
      const res = await axios.get(`/api/tactics/${tactic.id}/positions`);
      setPositionTactics(res.data);
    } catch (error) {
      // 기본값 설정
      setPositionTactics(positions.map(pos => ({
        position: pos,
        playstyle: 'balanced',
        priority: 'utility'
      })));
    }
  };

  const createTactic = async () => {
    if (!newTactic.name) {
      setMessage('전술 이름을 입력하세요');
      return;
    }

    try {
      await axios.post('/api/tactics', newTactic);
      setMessage('전술이 생성되었습니다');
      setIsCreating(false);
      setNewTactic({
        name: '',
        description: '',
        early_game: 'balanced',
        mid_game: 'balanced',
        late_game: 'balanced',
        teamfight_style: 'engage'
      });
      fetchTactics();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '전술 생성 실패');
    }
  };

  const updatePositionTactic = async (position: string, field: string, value: string) => {
    if (!selectedTactic) return;

    const updated = positionTactics.map(pt =>
      pt.position === position ? { ...pt, [field]: value } : pt
    );
    setPositionTactics(updated);

    try {
      await axios.put(`/api/tactics/${selectedTactic.id}/positions`, {
        position,
        [field]: value
      });
    } catch (error) {
      console.error('Failed to update position tactic:', error);
    }
  };

  const activateTactic = async (tacticId: number) => {
    try {
      await axios.post(`/api/tactics/${tacticId}/activate`);
      setMessage('전술이 활성화되었습니다');
      fetchTactics();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '전술 활성화 실패');
    }
  };

  const deleteTactic = async (tacticId: number) => {
    if (!confirm('이 전술을 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`/api/tactics/${tacticId}`);
      setMessage('전술이 삭제되었습니다');
      if (selectedTactic?.id === tacticId) {
        setSelectedTactic(null);
      }
      fetchTactics();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '전술 삭제 실패');
    }
  };

  return (
    <div className="tactics-page">
      <h1>전략/전술 설정</h1>

      {message && (
        <div className={`message ${message.includes('실패') ? 'error' : 'success'}`}>
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      <div className="tactics-layout">
        <div className="tactics-list">
          <div className="list-header">
            <h2>내 전술</h2>
            <button onClick={() => setIsCreating(true)}>+ 새 전술</button>
          </div>

          {tactics.length === 0 ? (
            <div className="empty">전술이 없습니다</div>
          ) : (
            tactics.map(tactic => (
              <div
                key={tactic.id}
                className={`tactic-item ${selectedTactic?.id === tactic.id ? 'selected' : ''} ${tactic.is_active ? 'active' : ''}`}
                onClick={() => selectTactic(tactic)}
              >
                <div className="tactic-name">
                  {tactic.name}
                  {tactic.is_active && <span className="active-badge">활성</span>}
                </div>
                <div className="tactic-summary">
                  {tactic.early_game === 'aggressive' ? '공격' : tactic.early_game === 'passive' ? '수비' : '균형'} →{' '}
                  {tactic.mid_game === 'aggressive' ? '공격' : tactic.mid_game === 'passive' ? '수비' : '균형'} →{' '}
                  {tactic.late_game === 'aggressive' ? '공격' : tactic.late_game === 'passive' ? '수비' : '균형'}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="tactic-details">
          {isCreating ? (
            <div className="create-form">
              <h2>새 전술 만들기</h2>
              <div className="form-group">
                <label>전술 이름</label>
                <input
                  type="text"
                  value={newTactic.name}
                  onChange={(e) => setNewTactic({ ...newTactic, name: e.target.value })}
                  placeholder="예: 초반 공격 전술"
                />
              </div>
              <div className="form-group">
                <label>설명</label>
                <textarea
                  value={newTactic.description}
                  onChange={(e) => setNewTactic({ ...newTactic, description: e.target.value })}
                  placeholder="전술에 대한 설명"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>초반 (1-15분)</label>
                  <select
                    value={newTactic.early_game}
                    onChange={(e) => setNewTactic({ ...newTactic, early_game: e.target.value })}
                  >
                    {gamePhases.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>중반 (15-30분)</label>
                  <select
                    value={newTactic.mid_game}
                    onChange={(e) => setNewTactic({ ...newTactic, mid_game: e.target.value })}
                  >
                    {gamePhases.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>후반 (30분+)</label>
                  <select
                    value={newTactic.late_game}
                    onChange={(e) => setNewTactic({ ...newTactic, late_game: e.target.value })}
                  >
                    {gamePhases.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>한타 스타일</label>
                <select
                  value={newTactic.teamfight_style}
                  onChange={(e) => setNewTactic({ ...newTactic, teamfight_style: e.target.value })}
                >
                  {teamfightStyles.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button onClick={createTactic} className="primary">생성</button>
                <button onClick={() => setIsCreating(false)} className="secondary">취소</button>
              </div>
            </div>
          ) : selectedTactic ? (
            <>
              <div className="detail-header">
                <h2>{selectedTactic.name}</h2>
                <div className="detail-actions">
                  {!selectedTactic.is_active && (
                    <button onClick={() => activateTactic(selectedTactic.id)} className="primary">
                      활성화
                    </button>
                  )}
                  <button onClick={() => deleteTactic(selectedTactic.id)} className="danger">
                    삭제
                  </button>
                </div>
              </div>

              {selectedTactic.description && (
                <p className="tactic-description">{selectedTactic.description}</p>
              )}

              <div className="phase-overview">
                <h3>게임 페이즈별 전략</h3>
                <div className="phases">
                  <div className="phase">
                    <span className="phase-label">초반</span>
                    <span className={`phase-value ${selectedTactic.early_game}`}>
                      {gamePhases.find(p => p.value === selectedTactic.early_game)?.label}
                    </span>
                  </div>
                  <div className="phase-arrow">→</div>
                  <div className="phase">
                    <span className="phase-label">중반</span>
                    <span className={`phase-value ${selectedTactic.mid_game}`}>
                      {gamePhases.find(p => p.value === selectedTactic.mid_game)?.label}
                    </span>
                  </div>
                  <div className="phase-arrow">→</div>
                  <div className="phase">
                    <span className="phase-label">후반</span>
                    <span className={`phase-value ${selectedTactic.late_game}`}>
                      {gamePhases.find(p => p.value === selectedTactic.late_game)?.label}
                    </span>
                  </div>
                </div>
                <div className="teamfight-style">
                  <span>한타 스타일:</span>
                  <strong>{teamfightStyles.find(s => s.value === selectedTactic.teamfight_style)?.label}</strong>
                </div>
              </div>

              <div className="position-tactics">
                <h3>포지션별 전술</h3>
                <table>
                  <thead>
                    <tr>
                      <th>포지션</th>
                      <th>플레이스타일</th>
                      <th>역할</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(pos => {
                      const pt = positionTactics.find(p => p.position === pos) || {
                        position: pos,
                        playstyle: 'balanced',
                        priority: 'utility'
                      };
                      return (
                        <tr key={pos}>
                          <td>{pos}</td>
                          <td>
                            <select
                              value={pt.playstyle}
                              onChange={(e) => updatePositionTactic(pos, 'playstyle', e.target.value)}
                            >
                              {playstyles.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={pt.priority}
                              onChange={(e) => updatePositionTactic(pos, 'priority', e.target.value)}
                            >
                              {priorities.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>왼쪽에서 전술을 선택하거나 새 전술을 만드세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
