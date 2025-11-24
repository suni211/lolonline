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

interface TeamInfo {
  fan_count: number;
  fan_morale: number;
  ticket_price: number;
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

// 큰 숫자 포맷 (억, 만 단위)
const formatCost = (cost: number): string => {
  if (cost >= 100000000) {
    return `${(cost / 100000000).toFixed(1)}억`;
  } else if (cost >= 10000) {
    return `${(cost / 10000).toFixed(0)}만`;
  }
  return cost.toLocaleString();
};

export default function Facilities() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [ticketPrice, setTicketPrice] = useState(1000);

  useEffect(() => {
    fetchFacilities();
    fetchTeamInfo();
  }, []);

  const fetchFacilities = async () => {
    try {
      const response = await axios.get('/api/facilities/my');
      setFacilities(response.data);
    } catch (error) {
      console.error('Failed to fetch facilities:', error);
    }
  };

  const fetchTeamInfo = async () => {
    try {
      const response = await axios.get('/api/teams');
      setTeamInfo({
        fan_count: response.data.fan_count || 1000,
        fan_morale: response.data.fan_morale || 50,
        ticket_price: response.data.ticket_price || 1000
      });
      setTicketPrice(response.data.ticket_price || 1000);
    } catch (error) {
      console.error('Failed to fetch team info:', error);
    }
  };

  const updateTicketPrice = async () => {
    try {
      setLoading(true);
      await axios.put('/api/teams/ticket-price', { ticket_price: ticketPrice });
      soundManager.playSound('upgrade_success');
      alert('입장료가 설정되었습니다');
      fetchTeamInfo();
    } catch (error: any) {
      alert(error.response?.data?.error || '입장료 설정 실패');
    } finally {
      setLoading(false);
    }
  };

  // 경기장 수용 인원 계산 (1레벨 300명, 10레벨 45000명)
  const getStadiumCapacity = (level: number): number => {
    if (level <= 0) return 0;
    return Math.floor(300 * Math.pow(1.75, level - 1));
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

  const stadiumLevel = facilities.find(f => f.facility_type === 'STADIUM')?.level || 0;
  const stadiumCapacity = getStadiumCapacity(stadiumLevel);

  return (
    <div className="facilities-page page-wrapper">
      <div className="page-header">
        <h1 className="page-title">구단 경영</h1>
      </div>

      {/* 팬 정보 및 입장료 설정 */}
      {teamInfo && (
        <div className="fan-management-section">
          <h2>팬 관리</h2>
          <div className="fan-info-grid">
            <div className="fan-info-card">
              <div className="fan-info-icon">👥</div>
              <div className="fan-info-content">
                <span className="fan-info-label">총 팬 수</span>
                <span className="fan-info-value">{teamInfo.fan_count.toLocaleString()}명</span>
              </div>
            </div>
            <div className="fan-info-card">
              <div className="fan-info-icon">❤️</div>
              <div className="fan-info-content">
                <span className="fan-info-label">팬 민심</span>
                <span className={`fan-info-value ${teamInfo.fan_morale >= 70 ? 'high' : teamInfo.fan_morale >= 40 ? 'medium' : 'low'}`}>
                  {teamInfo.fan_morale}%
                </span>
              </div>
              <div className="morale-bar">
                <div
                  className={`morale-fill ${teamInfo.fan_morale >= 70 ? 'high' : teamInfo.fan_morale >= 40 ? 'medium' : 'low'}`}
                  style={{ width: `${teamInfo.fan_morale}%` }}
                />
              </div>
            </div>
            <div className="fan-info-card">
              <div className="fan-info-icon">🏟️</div>
              <div className="fan-info-content">
                <span className="fan-info-label">경기장 수용 인원</span>
                <span className="fan-info-value">
                  {stadiumLevel > 0 ? `${stadiumCapacity.toLocaleString()}명` : '경기장 없음'}
                </span>
              </div>
            </div>
          </div>

          <div className="ticket-price-section">
            <h3>입장료 설정</h3>
            <p className="ticket-info">입장료가 높으면 수익이 증가하지만 관중이 줄어듭니다. 민심이 낮으면 관중이 더 줄어듭니다.</p>
            <div className="ticket-price-control">
              <input
                type="range"
                min="500"
                max="50000"
                step="500"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(Number(e.target.value))}
              />
              <div className="ticket-price-display">
                <span className="current-price">{ticketPrice.toLocaleString()}원</span>
                <button
                  onClick={updateTicketPrice}
                  disabled={loading || ticketPrice === teamInfo.ticket_price}
                  className="btn-primary"
                >
                  {loading ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
            <div className="ticket-price-guide">
              <span>500원 (저가)</span>
              <span>50,000원 (고가)</span>
            </div>
          </div>
        </div>
      )}

      <div className="facilities-grid">
        {Object.keys(facilityTypes).map((type) => {
          const facility = facilities.find(f => f.facility_type === type);
          const info = getFacilityInfo(type);
          const level = facility?.level || 0;
          // 기하급수적 비용: 100만 * 2^레벨
          const upgradeCost = 1000000 * Math.pow(2, level);
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
                    {level === 0 ? '건설' : '업그레이드'} ({formatCost(upgradeCost)} 골드)
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

