import { useEffect, useState } from 'react';
import axios from 'axios';
import { soundManager } from '../utils/soundManager';
import { getNationalityFlag, getNationalityName } from '../utils/nationalityFlags';
import './Coaches.css';

interface Coach {
  id: number;
  name: string;
  nationality: string;
  role: 'HEAD_COACH' | 'ASSISTANT_COACH';
  scouting_ability: number;
  training_boost: number;
  salary: number;
  contract_expires_at: string | null;
  acquired_at: string;
}

interface AvailableCoach {
  id: number;
  name: string;
  nationality: string;
  coach_type: string;
  skill_level: number;
  specialty: string;
  salary: number;
  is_hired: number;
}

interface TeamCoach {
  id: number;
  coach_id: number;
  name: string;
  nationality: string;
  coach_type: string;
  skill_level: number;
  specialty: string;
  monthly_salary: number;
  contract_start: string;
  contract_end: string;
}

interface NegotiationResult {
  accepted: boolean;
  finalSalary?: number;
  minimumSalary?: number;
  message: string;
  coach: AvailableCoach;
}

export default function Coaches() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [availableCoaches, setAvailableCoaches] = useState<AvailableCoach[]>([]);
  const [teamCoaches, setTeamCoaches] = useState<TeamCoach[]>([]);
  const [activeTab, setActiveTab] = useState<'contracts' | 'available' | 'my'>('contracts');

  // 협상 관련 상태
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<AvailableCoach | null>(null);
  const [offeredSalary, setOfferedSalary] = useState(0);
  const [contractMonths, setContractMonths] = useState(12);
  const [negotiationResult, setNegotiationResult] = useState<NegotiationResult | null>(null);

  useEffect(() => {
    fetchCoaches();
    fetchAvailableCoaches();
    fetchTeamCoaches();
  }, []);

  const fetchCoaches = async () => {
    try {
      const response = await axios.get('/api/coaches/my');
      setCoaches(response.data);
    } catch (error) {
      console.error('Failed to fetch coaches:', error);
    }
  };

  const fetchAvailableCoaches = async () => {
    try {
      const response = await axios.get('/api/coaches/available');
      setAvailableCoaches(response.data);
    } catch (error) {
      console.error('Failed to fetch available coaches:', error);
    }
  };

  const fetchTeamCoaches = async () => {
    try {
      const response = await axios.get('/api/coaches/contracts');
      setTeamCoaches(response.data);
    } catch (error) {
      console.error('Failed to fetch team coaches:', error);
    }
  };

  const openNegotiation = (coach: AvailableCoach) => {
    setSelectedCoach(coach);
    setOfferedSalary(coach.salary);
    setContractMonths(12);
    setNegotiationResult(null);
    setShowNegotiation(true);
  };

  const handleNegotiate = async () => {
    if (!selectedCoach) return;

    try {
      const response = await axios.post('/api/coaches/negotiate', {
        coachId: selectedCoach.id,
        offeredSalary,
        contractMonths
      });
      setNegotiationResult(response.data);
      soundManager.playSound('click');
    } catch (error: any) {
      alert(error.response?.data?.error || '협상 실패');
    }
  };

  const handleHire = async () => {
    if (!selectedCoach || !negotiationResult?.accepted) return;

    try {
      await axios.post('/api/coaches/hire', {
        coachId: selectedCoach.id,
        contractMonths,
        negotiatedSalary: negotiationResult.finalSalary
      });
      soundManager.playSound('click');
      alert(`${selectedCoach.name} 코치를 고용했습니다!`);
      setShowNegotiation(false);
      setSelectedCoach(null);
      setNegotiationResult(null);
      fetchAvailableCoaches();
      fetchTeamCoaches();
    } catch (error: any) {
      alert(error.response?.data?.error || '고용 실패');
    }
  };

  const handleFireCoach = async (teamCoachId: number) => {
    if (!confirm('정말 이 코치를 해고하시겠습니까? 위약금이 발생할 수 있습니다.')) return;

    try {
      const response = await axios.post('/api/coaches/fire', { teamCoachId });
      soundManager.playSound('click');
      alert(response.data.message);
      fetchTeamCoaches();
    } catch (error: any) {
      alert(error.response?.data?.error || '해고 실패');
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

  return (
    <div className="coaches-page">
      <div className="page-header">
        <h1 className="page-title">감독/코치 관리</h1>
        <div className="header-actions">
          <button onClick={() => setActiveTab('contracts')} className={activeTab === 'contracts' ? 'tab-active' : 'tab-btn'}>
            계약 중
          </button>
          <button onClick={() => setActiveTab('available')} className={activeTab === 'available' ? 'tab-active' : 'tab-btn'}>
            고용 가능
          </button>
          <button onClick={() => setActiveTab('my')} className={activeTab === 'my' ? 'tab-active' : 'tab-btn'}>
            구 시스템
          </button>
        </div>
      </div>

      {/* 협상 모달 */}
      {showNegotiation && selectedCoach && (
        <div className="scout-modal">
          <div className="scout-content negotiation-modal">
            <h3>{selectedCoach.name} 코치 협상</h3>
            <div className="coach-info">
              <p><strong>타입:</strong> {getCoachTypeName(selectedCoach.coach_type)}</p>
              <p><strong>스킬:</strong> {selectedCoach.skill_level}</p>
              <p><strong>요구 급여:</strong> {selectedCoach.salary.toLocaleString()}원/월</p>
            </div>

            {!negotiationResult && (
              <div className="negotiation-form">
                <div className="form-group">
                  <label>제안 급여 (원/월)</label>
                  <input
                    type="number"
                    value={offeredSalary}
                    onChange={(e) => setOfferedSalary(Number(e.target.value))}
                    min={0}
                    step={10000}
                  />
                  <span className="hint">
                    {((offeredSalary / selectedCoach.salary) * 100).toFixed(0)}% 제안
                  </span>
                </div>
                <div className="form-group">
                  <label>계약 기간 (개월)</label>
                  <select value={contractMonths} onChange={(e) => setContractMonths(Number(e.target.value))}>
                    <option value={6}>6개월</option>
                    <option value={12}>12개월</option>
                    <option value={18}>18개월</option>
                    <option value={24}>24개월</option>
                  </select>
                </div>
              </div>
            )}

            {negotiationResult && (
              <div className={`negotiation-result ${negotiationResult.accepted ? 'accepted' : 'rejected'}`}>
                <p>{negotiationResult.message}</p>
                {negotiationResult.accepted && negotiationResult.finalSalary && (
                  <p><strong>최종 급여:</strong> {negotiationResult.finalSalary.toLocaleString()}원/월</p>
                )}
              </div>
            )}

            <div className="scout-actions">
              {!negotiationResult && (
                <button onClick={handleNegotiate} className="btn-primary">협상하기</button>
              )}
              {negotiationResult?.accepted && (
                <button onClick={handleHire} className="btn-primary">고용하기</button>
              )}
              {negotiationResult && !negotiationResult.accepted && (
                <button onClick={() => setNegotiationResult(null)} className="btn-primary">다시 협상</button>
              )}
              <button onClick={() => setShowNegotiation(false)} className="btn-secondary">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 계약 중 탭 */}
      {activeTab === 'contracts' && (
        <div className="coaches-grid">
          {teamCoaches.map((coach) => (
            <div key={coach.id} className="coach-card">
              <div className="coach-header">
                <h3>{coach.name}</h3>
                <span className={`role-badge ${coach.coach_type}`}>
                  {getCoachTypeName(coach.coach_type)}
                </span>
              </div>
              <div className="coach-stats">
                <div className="stat-row">
                  <span>스킬 레벨</span>
                  <span>{coach.skill_level}</span>
                </div>
                <div className="stat-row">
                  <span>월급</span>
                  <span>{coach.monthly_salary.toLocaleString()}원</span>
                </div>
                <div className="stat-row">
                  <span>계약 만료</span>
                  <span>{new Date(coach.contract_end).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => handleFireCoach(coach.id)} className="btn-secondary">
                해고
              </button>
            </div>
          ))}
          {teamCoaches.length === 0 && (
            <p className="empty-message">계약 중인 코치가 없습니다.</p>
          )}
        </div>
      )}

      {/* 고용 가능 탭 */}
      {activeTab === 'available' && (
        <div className="coaches-grid">
          {availableCoaches.filter(c => !c.is_hired).map((coach) => (
            <div key={coach.id} className="coach-card">
              <div className="coach-header">
                <h3>{coach.name}</h3>
                <span className={`role-badge ${coach.coach_type}`}>
                  {getCoachTypeName(coach.coach_type)}
                </span>
              </div>
              <div className="coach-stats">
                <div className="stat-row">
                  <span>스킬 레벨</span>
                  <span>{coach.skill_level}</span>
                </div>
                <div className="stat-row">
                  <span>요구 급여</span>
                  <span>{coach.salary.toLocaleString()}원/월</span>
                </div>
                {coach.specialty && (
                  <div className="stat-row">
                    <span>특기</span>
                    <span>{coach.specialty}</span>
                  </div>
                )}
              </div>
              <button onClick={() => openNegotiation(coach)} className="btn-primary">
                협상
              </button>
            </div>
          ))}
          {availableCoaches.filter(c => !c.is_hired).length === 0 && (
            <p className="empty-message">고용 가능한 코치가 없습니다.</p>
          )}
        </div>
      )}

      {activeTab === 'my' && (
        <div className="coaches-grid">
          {coaches.map((coach) => (
            <div key={coach.id} className="coach-card">
              <div className="coach-header">
                <h3>{coach.name}</h3>
                <div className="coach-meta">
                  <span className="nationality-flag" title={getNationalityName(coach.nationality || 'KR')}>
                    {getNationalityFlag(coach.nationality || 'KR')}
                  </span>
                  <span className={`role-badge ${coach.role}`}>
                    {coach.role === 'HEAD_COACH' ? '수석코치' : '코치'}
                  </span>
                </div>
              </div>
              <div className="coach-stats">
                <div className="stat-row">
                  <span>스카우팅 능력</span>
                  <span>{coach.scouting_ability} / 100</span>
                </div>
                <div className="stat-row">
                  <span>훈련 보너스</span>
                  <span>+{((coach.training_boost - 1) * 100).toFixed(1)}%</span>
                </div>
                <div className="stat-row">
                  <span>연봉</span>
                  <span>{coach.salary.toLocaleString()} 원</span>
                </div>
              </div>
            </div>
          ))}
          {coaches.length === 0 && (
            <p className="empty-message">보유한 감독/코치가 없습니다.</p>
          )}
        </div>
      )}

    </div>
  );
}

