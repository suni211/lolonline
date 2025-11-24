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

interface SearchCoach {
  id: number;
  name: string;
  nationality: string;
  role: 'HEAD_COACH' | 'ASSISTANT_COACH';
  scouting_ability: number;
  training_boost: number;
  owned_count: number;
}

export default function Coaches() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [searchResults, setSearchResults] = useState<SearchCoach[]>([]);
  const [showScout, setShowScout] = useState(false);
  const [scoutCost, setScoutCost] = useState<'gold' | 'diamond'>('gold');
  const [activeTab, setActiveTab] = useState<'my' | 'search'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRole, setSearchRole] = useState('');

  useEffect(() => {
    fetchCoaches();
  }, []);

  const fetchCoaches = async () => {
    try {
      const response = await axios.get('/api/coaches/my');
      setCoaches(response.data);
    } catch (error) {
      console.error('Failed to fetch coaches:', error);
    }
  };

  const handleScout = async () => {
    try {
      await axios.post('/api/coaches/scout', { cost_type: scoutCost });
      soundManager.playSound('click');
      alert('감독/코치 스카우팅 완료!');
      fetchCoaches();
    } catch (error: any) {
      alert(error.response?.data?.error || '스카우팅 실패');
    }
  };

  const handleSearch = async () => {
    try {
      const response = await axios.get('/api/coaches/search', {
        params: {
          name: searchQuery || undefined,
          role: searchRole || undefined
        }
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Failed to search coaches:', error);
    }
  };

  return (
    <div className="coaches-page">
      <div className="page-header">
        <h1 className="page-title">감독/코치 관리</h1>
        <div className="header-actions">
          <button onClick={() => setActiveTab('my')} className={activeTab === 'my' ? 'tab-active' : 'tab-btn'}>
            내 감독/코치
          </button>
          <button onClick={() => setActiveTab('search')} className={activeTab === 'search' ? 'tab-active' : 'tab-btn'}>
            감독/코치 검색
          </button>
          <button onClick={() => setShowScout(!showScout)} className="btn-primary">
            감독/코치 스카우팅
          </button>
        </div>
      </div>

      {showScout && (
        <div className="scout-modal">
          <div className="scout-content">
            <h3>감독/코치 스카우팅</h3>
            <div className="scout-options">
              <label>
                <input
                  type="radio"
                  value="gold"
                  checked={scoutCost === 'gold'}
                  onChange={(e) => setScoutCost(e.target.value as 'gold' | 'diamond')}
                />
                원 2,000
              </label>
              <label>
                <input
                  type="radio"
                  value="diamond"
                  checked={scoutCost === 'diamond'}
                  onChange={(e) => setScoutCost(e.target.value as 'gold' | 'diamond')}
                />
                다이아몬드 20
              </label>
            </div>
            <div className="scout-actions">
              <button onClick={handleScout} className="btn-primary">스카우팅</button>
              <button onClick={() => setShowScout(false)} className="btn-secondary">취소</button>
            </div>
          </div>
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

      {activeTab === 'search' && (
        <div className="search-section">
          <div className="search-filters">
            <input
              type="text"
              placeholder="감독/코치 이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-input"
            />
            <select
              value={searchRole}
              onChange={(e) => setSearchRole(e.target.value)}
              className="filter-select"
            >
              <option value="">모든 역할</option>
              <option value="HEAD_COACH">수석코치</option>
              <option value="ASSISTANT_COACH">코치</option>
            </select>
            <button onClick={handleSearch} className="btn-primary">
              검색
            </button>
          </div>

          <div className="coaches-grid">
            {searchResults.map((coach) => (
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
                    <span>소유 팀 수</span>
                    <span>{coach.owned_count}</span>
                  </div>
                </div>
              </div>
            ))}
            {searchResults.length === 0 && (
              <p className="empty-message">검색 결과가 없습니다. 검색 버튼을 눌러주세요.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

