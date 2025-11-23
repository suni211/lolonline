import { useEffect, useState } from 'react';
import axios from 'axios';
import './Strategy.css';

interface TeamTactics {
  id: number;
  team_id: number;
  teamfight_style: string;
  split_formation: string;
  aggression_level: string;
  priority_objective: string;
  early_game_strategy: string;
}

interface PositionTactics {
  id: number;
  team_id: number;
  position: string;
  playstyle: string;
  risk_level: string;
  priority_target: string;
}

export default function Strategy() {
  const [teamTactics, setTeamTactics] = useState<TeamTactics | null>(null);
  const [positionTactics, setPositionTactics] = useState<PositionTactics[]>([]);
  const [playstyleOptions, setPlaystyleOptions] = useState<Record<string, string[]>>({});
  const [playstyleNames, setPlaystyleNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTactics();
  }, []);

  const fetchTactics = async () => {
    try {
      const response = await axios.get('/api/tactics');
      setTeamTactics(response.data.teamTactics);
      setPositionTactics(response.data.positionTactics);
      setPlaystyleOptions(response.data.playstyleOptions);
      setPlaystyleNames(response.data.playstyleNames);
    } catch (error) {
      console.error('Failed to fetch tactics:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTeamTactics = async (field: string, value: string) => {
    setSaving(true);
    try {
      await axios.put('/api/tactics/team', { [field]: value });
      setTeamTactics(prev => prev ? { ...prev, [field]: value } : null);
    } catch (error: any) {
      alert(error.response?.data?.error || '전술 업데이트 실패');
    } finally {
      setSaving(false);
    }
  };

  const updatePositionTactics = async (position: string, field: string, value: string) => {
    setSaving(true);
    try {
      await axios.put(`/api/tactics/position/${position}`, { [field]: value });
      setPositionTactics(prev =>
        prev.map(pt =>
          pt.position === position ? { ...pt, [field]: value } : pt
        )
      );
    } catch (error: any) {
      alert(error.response?.data?.error || '포지션 전술 업데이트 실패');
    } finally {
      setSaving(false);
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'TOP': return '#ff6b6b';
      case 'JUNGLE': return '#51cf66';
      case 'MID': return '#339af0';
      case 'ADC': return '#ffd43b';
      case 'SUPPORT': return '#cc5de8';
      default: return '#868e96';
    }
  };

  const teamfightStyles = [
    { value: 'SAFE', label: '안전', desc: '리스크를 최소화하고 안정적으로 플레이' },
    { value: 'BURST', label: '폭발', desc: '한 명을 빠르게 처치하는 집중 공격' },
    { value: 'ORGANIC', label: '유동', desc: '상황에 따라 유연하게 대응' },
    { value: 'TACTICAL', label: '전술', desc: '계획된 연계기와 포지셔닝 중시' }
  ];

  const splitFormations = [
    { value: '1-3-1', label: '1-3-1', desc: '양쪽 사이드 스플릿 푸시' },
    { value: '1-4-0', label: '1-4-0', desc: '한 쪽 스플릿 + 4인 그룹' },
    { value: '0-5-0', label: '0-5-0', desc: '5인 그룹 이동' }
  ];

  const aggressionLevels = [
    { value: 'VERY_AGGRESSIVE', label: '매우 공격적', desc: '높은 리스크, 높은 보상' },
    { value: 'AGGRESSIVE', label: '공격적', desc: '적극적인 교전 추구' },
    { value: 'NORMAL', label: '보통', desc: '균형 잡힌 플레이' },
    { value: 'DEFENSIVE', label: '수비적', desc: '안전한 플레이 위주' },
    { value: 'VERY_DEFENSIVE', label: '매우 수비적', desc: '극도로 안전한 플레이' }
  ];

  const priorityObjectives = [
    { value: 'DRAGON', label: '드래곤', desc: '드래곤 오브젝트 우선' },
    { value: 'BARON', label: '바론', desc: '바론 오브젝트 우선' },
    { value: 'TOWER', label: '타워', desc: '타워 철거 우선' },
    { value: 'TEAMFIGHT', label: '한타', desc: '팀파이트 승리 우선' }
  ];

  const earlyStrategies = [
    { value: 'AGGRESSIVE', label: '공격적', desc: '초반 킬 압박과 인베이드' },
    { value: 'STANDARD', label: '표준', desc: '기본적인 레인전' },
    { value: 'SCALING', label: '스케일링', desc: '후반을 위한 안전한 파밍' }
  ];

  const riskLevels = [
    { value: 'HIGH', label: '높음' },
    { value: 'MEDIUM', label: '보통' },
    { value: 'LOW', label: '낮음' }
  ];

  const priorityTargets = [
    { value: 'CARRY', label: '캐리' },
    { value: 'TANK', label: '탱커' },
    { value: 'SUPPORT', label: '서포터' },
    { value: 'NEAREST', label: '가장 가까운 적' }
  ];

  if (loading) {
    return <div className="strategy-page"><p>로딩 중...</p></div>;
  }

  return (
    <div className="strategy-page">
      <h1 className="page-title">전략실</h1>
      {saving && <div className="saving-indicator">저장 중...</div>}

      <div className="strategy-sections">
        {/* 팀 전술 섹션 */}
        <div className="strategy-section">
          <h2>팀 전술</h2>

          <div className="tactic-group">
            <h3>한타 스타일</h3>
            <div className="tactic-options">
              {teamfightStyles.map(style => (
                <button
                  key={style.value}
                  className={`tactic-btn ${teamTactics?.teamfight_style === style.value ? 'active' : ''}`}
                  onClick={() => updateTeamTactics('teamfight_style', style.value)}
                  title={style.desc}
                >
                  <span className="btn-label">{style.label}</span>
                  <span className="btn-desc">{style.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tactic-group">
            <h3>스플릿 포메이션</h3>
            <div className="tactic-options">
              {splitFormations.map(formation => (
                <button
                  key={formation.value}
                  className={`tactic-btn ${teamTactics?.split_formation === formation.value ? 'active' : ''}`}
                  onClick={() => updateTeamTactics('split_formation', formation.value)}
                  title={formation.desc}
                >
                  <span className="btn-label">{formation.label}</span>
                  <span className="btn-desc">{formation.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tactic-group">
            <h3>공격 성향</h3>
            <div className="tactic-options aggression">
              {aggressionLevels.map(level => (
                <button
                  key={level.value}
                  className={`tactic-btn small ${teamTactics?.aggression_level === level.value ? 'active' : ''}`}
                  onClick={() => updateTeamTactics('aggression_level', level.value)}
                  title={level.desc}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tactic-group">
            <h3>우선 오브젝트</h3>
            <div className="tactic-options">
              {priorityObjectives.map(obj => (
                <button
                  key={obj.value}
                  className={`tactic-btn ${teamTactics?.priority_objective === obj.value ? 'active' : ''}`}
                  onClick={() => updateTeamTactics('priority_objective', obj.value)}
                  title={obj.desc}
                >
                  <span className="btn-label">{obj.label}</span>
                  <span className="btn-desc">{obj.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tactic-group">
            <h3>초반 전략</h3>
            <div className="tactic-options">
              {earlyStrategies.map(strategy => (
                <button
                  key={strategy.value}
                  className={`tactic-btn ${teamTactics?.early_game_strategy === strategy.value ? 'active' : ''}`}
                  onClick={() => updateTeamTactics('early_game_strategy', strategy.value)}
                  title={strategy.desc}
                >
                  <span className="btn-label">{strategy.label}</span>
                  <span className="btn-desc">{strategy.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 포지션별 전술 섹션 */}
        <div className="strategy-section">
          <h2>포지션별 전술</h2>

          {positionTactics.map(pt => (
            <div key={pt.position} className="position-tactic">
              <div
                className="position-header"
                style={{ borderColor: getPositionColor(pt.position) }}
              >
                <span
                  className="position-badge"
                  style={{ backgroundColor: getPositionColor(pt.position) }}
                >
                  {pt.position}
                </span>
              </div>

              <div className="position-settings">
                <div className="setting-group">
                  <label>플레이스타일</label>
                  <select
                    value={pt.playstyle}
                    onChange={(e) => updatePositionTactics(pt.position, 'playstyle', e.target.value)}
                    className="setting-select"
                  >
                    {playstyleOptions[pt.position]?.map(style => (
                      <option key={style} value={style}>
                        {playstyleNames[style] || style}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="setting-group">
                  <label>리스크 레벨</label>
                  <select
                    value={pt.risk_level}
                    onChange={(e) => updatePositionTactics(pt.position, 'risk_level', e.target.value)}
                    className="setting-select"
                  >
                    {riskLevels.map(level => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="setting-group">
                  <label>우선 타겟</label>
                  <select
                    value={pt.priority_target}
                    onChange={(e) => updatePositionTactics(pt.position, 'priority_target', e.target.value)}
                    className="setting-select"
                  >
                    {priorityTargets.map(target => (
                      <option key={target.value} value={target.value}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
