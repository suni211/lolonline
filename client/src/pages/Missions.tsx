import { useEffect, useState } from 'react';
import axios from 'axios';
import './Missions.css';

interface Mission {
  id: number;
  mission_type: string;
  title: string;
  description: string;
  reward_gold: number;
  reward_diamond: number;
  progress?: number;
  completed?: boolean;
  completed_at?: string;
}

export default function Missions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [attendanceDay, setAttendanceDay] = useState<number | null>(null);

  useEffect(() => {
    fetchMissions();
    fetchAttendance();
  }, []);

  const fetchMissions = async () => {
    try {
      const response = await axios.get('/api/missions');
      setMissions(response.data);
    } catch (error) {
      console.error('Failed to fetch missions:', error);
    }
  };

  const fetchAttendance = async () => {
    try {
      const response = await axios.get('/api/missions/attendance');
      if (response.data.day) {
        setAttendanceDay(response.data.day);
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    }
  };

  const handleClaim = async (missionId: number) => {
    try {
      await axios.post(`/api/missions/${missionId}/claim`);
      alert('보상 수령 완료!');
      fetchMissions();
    } catch (error: any) {
      alert(error.response?.data?.error || '보상 수령 실패');
    }
  };

  const handleAttendance = async () => {
    try {
      const response = await axios.get('/api/missions/attendance');
      if (response.data.already_claimed) {
        alert(`이미 출석했습니다. (연속 ${response.data.day}일)`);
      } else {
        alert(`출석 완료! 연속 ${response.data.day}일 (골드 +${response.data.reward_gold}, 다이아 +${response.data.reward_diamond})`);
        setAttendanceDay(response.data.day);
        window.location.reload();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || '출석 실패');
    }
  };

  const dailyMissions = missions.filter(m => m.mission_type === 'DAILY');
  const weeklyMissions = missions.filter(m => m.mission_type === 'WEEKLY');

  return (
    <div className="missions-page">
      <h1 className="page-title">미션</h1>

      <div className="attendance-section">
        <h2>출석 보상</h2>
        <div className="attendance-box">
          <p>연속 출석: {attendanceDay || 0}일</p>
          <button onClick={handleAttendance} className="btn-primary">
            출석하기
          </button>
        </div>
      </div>

      <div className="missions-sections">
        <div className="mission-section">
          <h2>일일 미션</h2>
          {dailyMissions.length > 0 ? (
            <div className="missions-list">
              {dailyMissions.map((mission) => (
                <div key={mission.id} className="mission-card">
                  <div className="mission-header">
                    <h3>{mission.title}</h3>
                    {mission.completed && (
                      <span className="completed-badge">완료</span>
                    )}
                  </div>
                  <p className="mission-description">{mission.description}</p>
                  <div className="mission-progress">
                    {mission.progress !== undefined && (
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${(mission.progress / 100) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="mission-rewards">
                    {mission.reward_gold > 0 && (
                      <span className="reward">골드: {mission.reward_gold.toLocaleString()}</span>
                    )}
                    {mission.reward_diamond > 0 && (
                      <span className="reward">다이아: {mission.reward_diamond}</span>
                    )}
                  </div>
                  {mission.completed && !mission.completed_at && (
                    <button
                      onClick={() => handleClaim(mission.id)}
                      className="btn-primary"
                    >
                      보상 수령
                    </button>
                  )}
                  {mission.completed_at && (
                    <p className="claimed">보상 수령 완료</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">일일 미션이 없습니다.</p>
          )}
        </div>

        <div className="mission-section">
          <h2>주간 미션</h2>
          {weeklyMissions.length > 0 ? (
            <div className="missions-list">
              {weeklyMissions.map((mission) => (
                <div key={mission.id} className="mission-card">
                  <div className="mission-header">
                    <h3>{mission.title}</h3>
                    {mission.completed && (
                      <span className="completed-badge">완료</span>
                    )}
                  </div>
                  <p className="mission-description">{mission.description}</p>
                  <div className="mission-progress">
                    {mission.progress !== undefined && (
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${(mission.progress / 100) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="mission-rewards">
                    {mission.reward_gold > 0 && (
                      <span className="reward">골드: {mission.reward_gold.toLocaleString()}</span>
                    )}
                    {mission.reward_diamond > 0 && (
                      <span className="reward">다이아: {mission.reward_diamond}</span>
                    )}
                  </div>
                  {mission.completed && !mission.completed_at && (
                    <button
                      onClick={() => handleClaim(mission.id)}
                      className="btn-primary"
                    >
                      보상 수령
                    </button>
                  )}
                  {mission.completed_at && (
                    <p className="claimed">보상 수령 완료</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">주간 미션이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

