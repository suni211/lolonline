import { useState, useEffect } from 'react';
import axios from 'axios';
import './Tactics.css';

interface TeamTactics {
  id: number;
  team_id: number;
  teamfight_style: string;
  split_formation: string;
  aggression_level: string;
  priority_objective: string;
  early_game_strategy: string;
}

interface PositionTactic {
  id: number;
  team_id: number;
  position: string;
  playstyle: string;
  risk_level: string;
  priority_target: string;
}

interface TacticStats {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  recentResults: string[];
  aggressionStats: Record<string, { wins: number; total: number }>;
  strategyStats: Record<string, { wins: number; total: number }>;
  objectiveStats: Record<string, { wins: number; total: number }>;
}

export default function Tactics() {
  const [teamTactics, setTeamTactics] = useState<TeamTactics | null>(null);
  const [positionTactics, setPositionTactics] = useState<PositionTactic[]>([]);
  const [playstyleOptions, setPlaystyleOptions] = useState<Record<string, string[]>>({});
  const [playstyleNames, setPlaystyleNames] = useState<Record<string, string>>({});
  const [tacticStats, setTacticStats] = useState<TacticStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // 한글 라벨
  const labels = {
    teamfight_style: {
      FIGHT_FIRST: '싸움 후 오브젝트',
      OBJECTIVE_FIRST: '오브젝트 후 싸움'
    },
    split_formation: {
      '1-3-1': '1-3-1',
      '1-4-0': '1-4-0',
      '0-5-0': '0-5-0 (뭉쳐서)'
    },
    aggression_level: {
      VERY_AGGRESSIVE: '매우 공격적',
      AGGRESSIVE: '공격적',
      NORMAL: '보통',
      DEFENSIVE: '수비적',
      VERY_DEFENSIVE: '매우 수비적'
    },
    priority_objective: {
      DRAGON: '드래곤',
      BARON: '바론',
      TOWER: '타워',
      TEAMFIGHT: '한타'
    },
    early_game_strategy: {
      AGGRESSIVE: '공격적',
      STANDARD: '표준',
      SCALING: '스케일링'
    },
    risk_level: {
      HIGH: '높음',
      MEDIUM: '보통',
      LOW: '낮음'
    },
    priority_target: {
      CARRY: '캐리',
      TANK: '탱커',
      SUPPORT: '서포터',
      NEAREST: '가까운 적'
    }
  };

  const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
  const positionNames: Record<string, string> = {
    TOP: '탑',
    JUNGLE: '정글',
    MID: '미드',
    ADC: '원딜',
    SUPPORT: '서폿'
  };

  useEffect(() => {
    fetchTactics();
    fetchTacticStats();
  }, []);

  const fetchTactics = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/tactics');
      setTeamTactics(res.data.teamTactics);
      setPositionTactics(res.data.positionTactics);
      setPlaystyleOptions(res.data.playstyleOptions);
      setPlaystyleNames(res.data.playstyleNames);
    } catch (error) {
      console.error('Failed to fetch tactics:', error);
      setMessage('전술을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const fetchTacticStats = async () => {
    try {
      const res = await axios.get('/api/tactics/stats');
      setTacticStats(res.data);
    } catch (error) {
      console.error('Failed to fetch tactic stats:', error);
    }
  };

  const getWinRate = (wins: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  const updateTeamTactics = async (field: string, value: string) => {
    if (!teamTactics) return;

    setTeamTactics({ ...teamTactics, [field]: value });

    try {
      setSaving(true);
      await axios.put('/api/tactics/team', { [field]: value });
      setMessage('팀 전술이 저장되었습니다');
      setTimeout(() => setMessage(''), 2000);
    } catch (error: any) {
      setMessage(error.response?.data?.error || '저장 실패');
      fetchTactics(); // 롤백
    } finally {
      setSaving(false);
    }
  };

  const updatePositionTactic = async (position: string, field: string, value: string) => {
    const updated = positionTactics.map(pt =>
      pt.position === position ? { ...pt, [field]: value } : pt
    );
    setPositionTactics(updated);

    try {
      setSaving(true);
      await axios.put(`/api/tactics/position/${position}`, { [field]: value });
      setMessage(`${positionNames[position]} 전술이 저장되었습니다`);
      setTimeout(() => setMessage(''), 2000);
    } catch (error: any) {
      setMessage(error.response?.data?.error || '저장 실패');
      fetchTactics(); // 롤백
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="tactics-page">
        <h1>전술 설정</h1>
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="tactics-page">
      <h1>전술 설정</h1>

      {message && (
        <div className={`message ${message.includes('실패') ? 'error' : 'success'}`}>
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {saving && <div className="saving-indicator">저장 중...</div>}

      {/* 승률 통계 섹션 */}
      {tacticStats && (
        <div className="stats-section">
          <h2>전술 통계</h2>

          <div className="stats-overview">
            <div className="stat-box">
              <span className="stat-label">총 경기</span>
              <span className="stat-value">{tacticStats.totalMatches}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">승리</span>
              <span className="stat-value wins">{tacticStats.wins}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">패배</span>
              <span className="stat-value losses">{tacticStats.losses}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">승률</span>
              <span className="stat-value winrate">{tacticStats.winRate}%</span>
            </div>
          </div>

          <div className="recent-results">
            <h3>최근 경기</h3>
            <div className="result-badges">
              {tacticStats.recentResults.map((result, idx) => (
                <span key={idx} className={`result-badge ${result === 'W' ? 'win' : 'loss'}`}>
                  {result}
                </span>
              ))}
            </div>
          </div>

          <div className="stats-graphs">
            <div className="graph-section">
              <h3>공격 성향별 승률</h3>
              <div className="bar-chart">
                {Object.entries(tacticStats.aggressionStats).map(([key, stat]) => (
                  <div key={key} className="bar-item">
                    <span className="bar-label">{labels.aggression_level[key as keyof typeof labels.aggression_level]}</span>
                    <div className="bar-container">
                      <div
                        className="bar-fill"
                        style={{ width: `${getWinRate(stat.wins, stat.total)}%` }}
                      />
                      <span className="bar-value">{getWinRate(stat.wins, stat.total)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="graph-section">
              <h3>초반 전략별 승률</h3>
              <div className="bar-chart">
                {Object.entries(tacticStats.strategyStats).map(([key, stat]) => (
                  <div key={key} className="bar-item">
                    <span className="bar-label">{labels.early_game_strategy[key as keyof typeof labels.early_game_strategy]}</span>
                    <div className="bar-container">
                      <div
                        className="bar-fill strategy"
                        style={{ width: `${getWinRate(stat.wins, stat.total)}%` }}
                      />
                      <span className="bar-value">{getWinRate(stat.wins, stat.total)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="graph-section">
              <h3>우선 오브젝트별 승률</h3>
              <div className="bar-chart">
                {Object.entries(tacticStats.objectiveStats).map(([key, stat]) => (
                  <div key={key} className="bar-item">
                    <span className="bar-label">{labels.priority_objective[key as keyof typeof labels.priority_objective]}</span>
                    <div className="bar-container">
                      <div
                        className="bar-fill objective"
                        style={{ width: `${getWinRate(stat.wins, stat.total)}%` }}
                      />
                      <span className="bar-value">{getWinRate(stat.wins, stat.total)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tactics-container">
        {/* 팀 전술 섹션 */}
        <section className="team-tactics-section">
          <h2>팀 전술</h2>

          <div className="tactic-group">
            <h3>한타 스타일</h3>
            <p className="tactic-desc">팀 싸움 시 전체적인 접근 방식</p>
            <div className="button-group">
              {Object.entries(labels.teamfight_style).map(([value, label]) => (
                <button
                  key={value}
                  className={teamTactics?.teamfight_style === value ? 'active' : ''}
                  onClick={() => updateTeamTactics('teamfight_style', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="tactic-group">
            <h3>스플릿 포메이션</h3>
            <p className="tactic-desc">맵 분할 운영 방식</p>
            <div className="button-group">
              {Object.entries(labels.split_formation).map(([value, label]) => (
                <button
                  key={value}
                  className={teamTactics?.split_formation === value ? 'active' : ''}
                  onClick={() => updateTeamTactics('split_formation', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="tactic-group">
            <h3>공격 성향</h3>
            <p className="tactic-desc">경기 중 실시간 조절 가능</p>
            <div className="aggression-slider">
              {Object.entries(labels.aggression_level).map(([value, label]) => (
                <button
                  key={value}
                  className={`aggression-btn ${teamTactics?.aggression_level === value ? 'active' : ''} ${value.toLowerCase().replace('_', '-')}`}
                  onClick={() => updateTeamTactics('aggression_level', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="tactic-group">
            <h3>우선순위 오브젝트</h3>
            <p className="tactic-desc">우선적으로 노리는 목표</p>
            <div className="button-group">
              {Object.entries(labels.priority_objective).map(([value, label]) => (
                <button
                  key={value}
                  className={teamTactics?.priority_objective === value ? 'active' : ''}
                  onClick={() => updateTeamTactics('priority_objective', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="tactic-group">
            <h3>초반 전략</h3>
            <p className="tactic-desc">게임 초반 운영 방침</p>
            <div className="button-group">
              {Object.entries(labels.early_game_strategy).map(([value, label]) => (
                <button
                  key={value}
                  className={teamTactics?.early_game_strategy === value ? 'active' : ''}
                  onClick={() => updateTeamTactics('early_game_strategy', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 포지션별 전술 섹션 */}
        <section className="position-tactics-section">
          <h2>포지션별 전술</h2>

          {positions.map(pos => {
            const pt = positionTactics.find(p => p.position === pos);
            const options = playstyleOptions[pos] || [];

            return (
              <div key={pos} className="position-tactic-card">
                <h3 className={`position-title ${pos.toLowerCase()}`}>
                  {positionNames[pos]}
                </h3>

                <div className="position-settings">
                  <div className="setting-group">
                    <label>플레이스타일</label>
                    <div className="button-group small">
                      {options.map(style => (
                        <button
                          key={style}
                          className={pt?.playstyle === style ? 'active' : ''}
                          onClick={() => updatePositionTactic(pos, 'playstyle', style)}
                        >
                          {playstyleNames[style] || style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="setting-row">
                    <div className="setting-group">
                      <label>리스크</label>
                      <select
                        value={pt?.risk_level || 'MEDIUM'}
                        onChange={(e) => updatePositionTactic(pos, 'risk_level', e.target.value)}
                      >
                        {Object.entries(labels.risk_level).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="setting-group">
                      <label>우선 타겟</label>
                      <select
                        value={pt?.priority_target || 'NEAREST'}
                        onChange={(e) => updatePositionTactic(pos, 'priority_target', e.target.value)}
                      >
                        {Object.entries(labels.priority_target).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
