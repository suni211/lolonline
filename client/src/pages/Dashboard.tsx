import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

interface TeamStats {
  player_count: number;
  starter_count: number;
  total_overall: number;
}

interface LeagueInfo {
  id: number;
  name: string;
  region: string;
  season: number;
  status: string;
  team_rank?: number;
  total_teams?: number;
  wins?: number;
  losses?: number;
  points?: number;
}

export default function Dashboard() {
  const { team } = useAuth();
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);

  useEffect(() => {
    fetchDashboardData();

    // 실시간 날짜 업데이트 (1초마다)
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
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

      // 리그 정보
      try {
        const leagueRes = await axios.get('/api/leagues/my-standing');
        setLeagueInfo(leagueRes.data);
      } catch {
        // 리그에 참가하지 않은 경우
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    return date.toLocaleDateString('ko-KR', options);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="page-title">대시보드</h1>
        <div className="current-date">{formatDate(currentDate)}</div>
      </div>

      {/* 리그 정보 */}
      {leagueInfo && (
        <div className="league-banner">
          <div className="league-info">
            <h2>{leagueInfo.name}</h2>
            <span className="season-badge">시즌 {leagueInfo.season}</span>
          </div>
          <div className="league-stats">
            <div className="league-stat">
              <span className="label">순위</span>
              <span className="value">{leagueInfo.team_rank || '-'} / {leagueInfo.total_teams || '-'}</span>
            </div>
            <div className="league-stat">
              <span className="label">승</span>
              <span className="value">{leagueInfo.wins || 0}</span>
            </div>
            <div className="league-stat">
              <span className="label">패</span>
              <span className="value">{leagueInfo.losses || 0}</span>
            </div>
            <div className="league-stat">
              <span className="label">포인트</span>
              <span className="value">{leagueInfo.points || 0}</span>
            </div>
          </div>
        </div>
      )}

      {!leagueInfo && (
        <div className="no-league-banner">
          <p>현재 참가 중인 리그가 없습니다</p>
          <p className="sub-text">리그 시즌이 시작되면 자동으로 배정됩니다</p>
        </div>
      )}

      {team && (
        <div className="stats-grid">
          <div className="stat-card card-enter">
            <h3>팀 정보</h3>
            <p className="stat-value">{team.name}</p>
            <p className="stat-label">{team.league} LEAGUE</p>
          </div>
          <div className="stat-card card-enter-delay-1">
            <h3>보유 자금</h3>
            <p className="stat-value">{team.gold.toLocaleString()}원</p>
          </div>
          <div className="stat-card card-enter-delay-2">
            <h3>에너지</h3>
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

