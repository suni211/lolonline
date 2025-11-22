import { useEffect, useState } from 'react';
import axios from 'axios';
import { soundManager } from '../utils/soundManager';
import './Facilities.css';

interface Facility {
  id: number;
  team_id: number;
  facility_type: string;
  level: number;
  revenue_per_hour: number;
  maintenance_cost: number;
}

const facilityTypes = {
  'TRAINING': { name: '훈련 시설', icon: '🏋️', description: '선수 훈련 효과 증가' },
  'MEDICAL': { name: '의료 시설', icon: '🏥', description: '컨디션 회복 속도 증가' },
  'SCOUTING': { name: '스카우팅 시설', icon: '🔍', description: '스카우팅 성공률 증가' },
  'STADIUM': { name: '구장', icon: '🏟️', description: '경기 수익 증가' },
  'MERCHANDISE': { name: '굿즈샵', icon: '🛍️', description: '시간당 수익 발생' },
  'RESTAURANT': { name: '식당', icon: '🍽️', description: '시간당 수익 발생' },
  'ACCOMMODATION': { name: '숙소', icon: '🏨', description: '시간당 수익 발생' },
  'MEDIA': { name: '미디어 센터', icon: '📺', description: '시간당 수익 발생' },
  'GAMING_HOUSE': { name: '게이밍 하우스', icon: '🏠', description: '선수 만족도 증가' },
  'BROADCAST_STUDIO': { name: '방송 스튜디오', icon: '🎬', description: '팬 수익 증가' },
  'FAN_ZONE': { name: '팬 존', icon: '🎪', description: '팬 이벤트 수익' },
  'ANALYTICS_CENTER': { name: '분석 센터', icon: '📊', description: '경기 분석 능력 증가' },
};

export default function Facilities() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      const response = await axios.get('/api/facilities/my');
      setFacilities(response.data);
    } catch (error) {
      console.error('Failed to fetch facilities:', error);
    }
  };

  const handleUpgrade = async (facilityType: string) => {
    if (!confirm('시설을 업그레이드하시겠습니까?')) return;

    setLoading(true);
    try {
      await axios.post(`/api/facilities/${facilityType}/upgrade`);
      soundManager.playSound('upgrade_success');
      alert('시설 업그레이드 완료!');
      fetchFacilities();
    } catch (error: any) {
      alert(error.response?.data?.error || '업그레이드 실패');
    } finally {
      setLoading(false);
    }
  };

  const getFacilityInfo = (type: string) => {
    return facilityTypes[type as keyof typeof facilityTypes] || { name: type, icon: '🏢', description: '' };
  };

  return (
    <div className="facilities-page">
      <div className="page-header">
        <h1 className="page-title">구단 경영</h1>
      </div>

      <div className="facilities-grid">
        {Object.keys(facilityTypes).map((type) => {
          const facility = facilities.find(f => f.facility_type === type);
          const info = getFacilityInfo(type);
          const level = facility?.level || 0;
          const upgradeCost = (level + 1) * 10000;
          const netRevenue = (facility?.revenue_per_hour || 0) - (facility?.maintenance_cost || 0);

          return (
            <div key={type} className="facility-card">
              <div className="facility-header">
                <div className="facility-icon">{info.icon}</div>
                <div>
                  <h3>{info.name}</h3>
                  <p className="facility-level">레벨 {level} / 10</p>
                </div>
              </div>

              {level > 0 && (
                <div className="facility-stats">
                  <div className="stat-row">
                    <span>시간당 수익</span>
                    <span className="revenue">+{facility?.revenue_per_hour.toLocaleString()} 골드</span>
                  </div>
                  <div className="stat-row">
                    <span>유지비</span>
                    <span className="cost">-{facility?.maintenance_cost.toLocaleString()} 골드</span>
                  </div>
                  <div className="stat-row net-revenue">
                    <span>순수익 (시간당)</span>
                    <span className={netRevenue >= 0 ? 'positive' : 'negative'}>
                      {netRevenue >= 0 ? '+' : ''}{netRevenue.toLocaleString()} 골드
                    </span>
                  </div>
                </div>
              )}

              {level === 0 && (
                <div className="facility-info">
                  <p>시설이 건설되지 않았습니다.</p>
                </div>
              )}

              <div className="facility-actions">
                {level < 10 ? (
                  <button
                    onClick={() => handleUpgrade(type)}
                    disabled={loading}
                    className="btn-primary"
                  >
                    {level === 0 ? '건설' : '업그레이드'} ({upgradeCost.toLocaleString()} 골드)
                  </button>
                ) : (
                  <button disabled className="btn-secondary">
                    최대 레벨
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="facility-info-section">
        <h3>시설 정보</h3>
        <ul>
          {Object.entries(facilityTypes).map(([type, info]) => (
            <li key={type}><strong>{info.name}</strong>: {info.description}</li>
          ))}
        </ul>
        <p className="info-note">※ 수익 시설은 매 시간마다 자동으로 수익을 생성합니다.</p>
      </div>
    </div>
  );
}

