import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './TeamManagement.css';

export default function TeamManagement() {
  const { team } = useAuth();
  const [teamName, setTeamName] = useState('');

  useEffect(() => {
    if (team) {
      setTeamName(team.name);
    }
  }, [team]);

  const handleUpdateTeam = async () => {
    try {
      await axios.put('/api/teams', { name: teamName });
      alert('팀 정보가 업데이트되었습니다.');
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.error || '업데이트 실패');
    }
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
    </div>
  );
}

