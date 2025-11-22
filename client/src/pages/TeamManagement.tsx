import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './TeamManagement.css';

interface Facility {
  id: number;
  facility_type: string;
  level: number;
}

export default function TeamManagement() {
  const { team } = useAuth();
  const [teamName, setTeamName] = useState('');
  const [facilities, setFacilities] = useState<Facility[]>([]);

  useEffect(() => {
    if (team) {
      setTeamName(team.name);
      fetchFacilities();
    }
  }, [team]);

  const fetchFacilities = async () => {
    try {
      const response = await axios.get('/api/teams');
      if (response.data.facilities) {
        setFacilities(response.data.facilities);
      }
    } catch (error) {
      console.error('Failed to fetch facilities:', error);
    }
  };

  const handleUpdateTeam = async () => {
    try {
      await axios.put('/api/teams', { name: teamName });
      alert('팀 정보가 업데이트되었습니다.');
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.error || '업데이트 실패');
    }
  };

  const handleUpgradeFacility = async (facilityType: string) => {
    if (!confirm('시설을 업그레이드하시겠습니까?')) return;

    try {
      await axios.post('/api/teams/facilities/upgrade', { facility_type: facilityType });
      alert('시설 업그레이드 완료!');
      fetchFacilities();
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.error || '업그레이드 실패');
    }
  };

  const getFacilityLevel = (type: string) => {
    const facility = facilities.find(f => f.facility_type === type);
    return facility ? facility.level : 0;
  };

  const getUpgradeCost = (level: number) => {
    return (level + 1) * 10000;
  };

  return (
    <div className="team-management-page">
      <h1 className="page-title">팀 관리</h1>

      <div className="team-info-section">
        <h2>팀 정보</h2>
        <div className="team-info-box">
          <div className="info-item">
            <label>팀 이름</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="team-input"
            />
          </div>
          {team && (
            <>
              <div className="info-item">
                <label>리그</label>
                <span>{team.league} LEAGUE</span>
              </div>
              <div className="info-item">
                <label>보유 골드</label>
                <span>{team.gold.toLocaleString()}</span>
              </div>
              <div className="info-item">
                <label>보유 다이아몬드</label>
                <span>{team.diamond}</span>
              </div>
            </>
          )}
          <button onClick={handleUpdateTeam} className="btn-primary">
            팀 정보 저장
          </button>
        </div>
      </div>

      <div className="facilities-section">
        <h2>팀 시설</h2>
        <div className="facilities-grid">
          <div className="facility-card">
            <h3>훈련 시설</h3>
            <p className="facility-level">레벨 {getFacilityLevel('TRAINING')}</p>
            <p className="facility-effect">훈련 효과 증가</p>
            <p className="upgrade-cost">
              다음 레벨 업그레이드: {getUpgradeCost(getFacilityLevel('TRAINING')).toLocaleString()} 골드
            </p>
            <button
              onClick={() => handleUpgradeFacility('TRAINING')}
              className="btn-primary"
              disabled={team ? team.gold < getUpgradeCost(getFacilityLevel('TRAINING')) : true}
            >
              업그레이드
            </button>
          </div>

          <div className="facility-card">
            <h3>의료 시설</h3>
            <p className="facility-level">레벨 {getFacilityLevel('MEDICAL')}</p>
            <p className="facility-effect">부상 회복 속도 증가</p>
            <p className="upgrade-cost">
              다음 레벨 업그레이드: {getUpgradeCost(getFacilityLevel('MEDICAL')).toLocaleString()} 골드
            </p>
            <button
              onClick={() => handleUpgradeFacility('MEDICAL')}
              className="btn-primary"
              disabled={team ? team.gold < getUpgradeCost(getFacilityLevel('MEDICAL')) : true}
            >
              업그레이드
            </button>
          </div>

          <div className="facility-card">
            <h3>스카우팅 시설</h3>
            <p className="facility-level">레벨 {getFacilityLevel('SCOUTING')}</p>
            <p className="facility-effect">스카우팅 정보 증가</p>
            <p className="upgrade-cost">
              다음 레벨 업그레이드: {getUpgradeCost(getFacilityLevel('SCOUTING')).toLocaleString()} 골드
            </p>
            <button
              onClick={() => handleUpgradeFacility('SCOUTING')}
              className="btn-primary"
              disabled={team ? team.gold < getUpgradeCost(getFacilityLevel('SCOUTING')) : true}
            >
              업그레이드
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

