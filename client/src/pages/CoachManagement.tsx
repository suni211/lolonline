import { useState, useEffect } from 'react';
import axios from 'axios';
import './CoachManagement.css';

interface Coach {
  id: number;
  name: string;
  nationality: string;
  coach_type: string;
  skill_level: number;
  salary: number;
  experience_years: number;
  specialty: string;
  is_hired?: number;
}

interface TeamCoach {
  id: number;
  coach_id: number;
  name: string;
  nationality: string;
  coach_type: string;
  skill_level: number;
  specialty: string;
  contract_start: string;
  contract_end: string;
  monthly_salary: number;
}

interface CoachEffects {
  trainingBonus: number;
  mentalBonus: number;
  strategyBonus: number;
  physicalBonus: number;
  analysisBonus: number;
  healingBonus: number;
  overallBonus: number;
}

export default function CoachManagement() {
  const [availableCoaches, setAvailableCoaches] = useState<Coach[]>([]);
  const [teamCoaches, setTeamCoaches] = useState<TeamCoach[]>([]);
  const [effects, setEffects] = useState<CoachEffects | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [availableRes, teamRes, effectsRes] = await Promise.all([
        axios.get('/api/coaches/available'),
        axios.get('/api/coaches/contracts'),
        axios.get('/api/coaches/effects')
      ]);
      setAvailableCoaches(availableRes.data);
      setTeamCoaches(teamRes.data);
      setEffects(effectsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHire = async (coachId: number) => {
    try {
      setActionLoading(true);
      const res = await axios.post('/api/coaches/hire', { coachId, contractMonths: 12 });
      alert(res.data.message);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || '고용 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFire = async (teamCoachId: number) => {
    if (!confirm('정말 해고하시겠습니까? 위약금이 발생할 수 있습니다.')) return;

    try {
      setActionLoading(true);
      const res = await axios.post('/api/coaches/fire', { teamCoachId });
      alert(res.data.message);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || '해고 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const getCoachTypeName = (type: string) => {
    switch (type) {
      case 'HEAD': return '감독';
      case 'STRATEGY': return '전략 코치';
      case 'MENTAL': return '멘탈 코치';
      case 'PHYSICAL': return '피지컬 코치';
      case 'ANALYST': return '분석가';
      case 'DOCTOR': return '팀 닥터';
      default: return type;
    }
  };

  const getCoachTypeColor = (type: string) => {
    switch (type) {
      case 'HEAD': return '#f9ca24';
      case 'STRATEGY': return '#4a9eff';
      case 'MENTAL': return '#a29bfe';
      case 'PHYSICAL': return '#ff6b6b';
      case 'ANALYST': return '#4ecdc4';
      case 'DOCTOR': return '#81ecec';
      default: return '#888';
    }
  };

  if (loading) {
    return <div className="coach-management-page"><div className="loading">로딩 중...</div></div>;
  }

  return (
    <div className="coach-management-page">
      <h1>코칭 스태프</h1>

      {effects && (
        <div className="effects-section">
          <h2>코치 효과</h2>
          <div className="effects-grid">
            <div className="effect-item">
              <span>훈련 보너스</span>
              <span>+{effects.trainingBonus}%</span>
            </div>
            <div className="effect-item">
              <span>멘탈 보너스</span>
              <span>+{effects.mentalBonus}%</span>
            </div>
            <div className="effect-item">
              <span>전략 보너스</span>
              <span>+{effects.strategyBonus}%</span>
            </div>
            <div className="effect-item">
              <span>피지컬 보너스</span>
              <span>+{effects.physicalBonus}%</span>
            </div>
            <div className="effect-item">
              <span>분석 보너스</span>
              <span>+{effects.analysisBonus}%</span>
            </div>
            <div className="effect-item">
              <span>회복 보너스</span>
              <span>+{effects.healingBonus}%</span>
            </div>
            <div className="effect-item overall">
              <span>전체 보너스</span>
              <span>+{effects.overallBonus}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="team-coaches-section">
        <h2>현재 코칭 스태프</h2>
        {teamCoaches.length === 0 ? (
          <p className="empty">고용된 코치가 없습니다</p>
        ) : (
          <div className="coach-list">
            {teamCoaches.map(coach => (
              <div key={coach.id} className="coach-card hired">
                <div className="coach-type" style={{ color: getCoachTypeColor(coach.coach_type) }}>
                  {getCoachTypeName(coach.coach_type)}
                </div>
                <div className="coach-name">{coach.name}</div>
                <div className="coach-info">
                  <span>능력: {coach.skill_level}</span>
                  <span>{coach.nationality}</span>
                </div>
                <div className="coach-specialty">{coach.specialty}</div>
                <div className="contract-info">
                  <span>월급: {coach.monthly_salary.toLocaleString()}</span>
                  <span>만료: {new Date(coach.contract_end).toLocaleDateString()}</span>
                </div>
                <button
                  className="fire-btn"
                  onClick={() => handleFire(coach.id)}
                  disabled={actionLoading}
                >
                  해고
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="available-coaches-section">
        <h2>고용 가능한 코치</h2>
        {availableCoaches.length === 0 ? (
          <p className="empty">고용 가능한 코치가 없습니다</p>
        ) : (
          <div className="coach-list">
            {availableCoaches.map(coach => (
              <div key={coach.id} className="coach-card">
                <div className="coach-type" style={{ color: getCoachTypeColor(coach.coach_type) }}>
                  {getCoachTypeName(coach.coach_type)}
                </div>
                <div className="coach-name">{coach.name}</div>
                <div className="coach-info">
                  <span>능력: {coach.skill_level}</span>
                  <span>{coach.nationality}</span>
                </div>
                <div className="coach-specialty">{coach.specialty}</div>
                <div className="coach-salary">
                  월급: {coach.salary.toLocaleString()}
                </div>
                <button
                  className="hire-btn"
                  onClick={() => handleHire(coach.id)}
                  disabled={actionLoading || !!coach.is_hired}
                >
                  {coach.is_hired ? '이미 고용됨' : '고용'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
