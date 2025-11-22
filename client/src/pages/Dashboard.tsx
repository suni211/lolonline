import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

interface TeamStats {
  player_count: number;
  starter_count: number;
  total_overall: number;
}

export default function Dashboard() {
  const { team } = useAuth();
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 팀 정보
      const teamRes = await axios.get('/api/teams');
      setTeamStats(teamRes.data);

      // 최근 경기
      const matchesRes = await axios.get('/api/matches?status=FINISHED&limit=5');
      setRecentMatches(matchesRes.data);

      // 예정된 경기
      const upcomingRes = await axios.get('/api/matches?status=SCHEDULED&limit=5');
      setUpcomingMatches(upcomingRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  return (
    <div className="dashboard">
      <h1 className="page-title">대시보드</h1>
      
      {team && (
        <div className="stats-grid">
          <div className="stat-card card-enter">
            <h3>팀 정보</h3>
            <p className="stat-value">{team.name}</p>
            <p className="stat-label">{team.league} LEAGUE</p>
          </div>
          <div className="stat-card card-enter-delay-1">
            <h3>보유 골드</h3>
            <p className="stat-value">{team.gold.toLocaleString()}</p>
          </div>
          <div className="stat-card card-enter-delay-2">
            <h3>보유 다이아몬드</h3>
            <p className="stat-value">{team.diamond}</p>
          </div>
          {teamStats && (
            <>
              <div className="stat-card card-enter-delay-3">
                <h3>보유 선수</h3>
                <p className="stat-value">{teamStats.player_count} / 23</p>
              </div>
              <div className="stat-card card-enter-delay-1">
                <h3>스타터</h3>
                <p className="stat-value">{teamStats.starter_count} / 5</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="dashboard-sections">
        <div className="section">
          <h2>예정된 경기</h2>
          {upcomingMatches.length > 0 ? (
            <div className="match-list">
              {upcomingMatches.map((match) => (
                <div key={match.id} className="match-item">
                  <span>{match.home_team_name} vs {match.away_team_name}</span>
                  <span className="match-time">
                    {new Date(match.scheduled_at).toLocaleString('ko-KR')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">예정된 경기가 없습니다.</p>
          )}
        </div>

        <div className="section">
          <h2>최근 경기 결과</h2>
          {recentMatches.length > 0 ? (
            <div className="match-list">
              {recentMatches.map((match) => (
                <div key={match.id} className="match-item">
                  <span>
                    {match.home_team_name} {match.home_score} - {match.away_score} {match.away_team_name}
                  </span>
                  <span className="match-time">
                    {new Date(match.finished_at).toLocaleString('ko-KR')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">최근 경기 결과가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

