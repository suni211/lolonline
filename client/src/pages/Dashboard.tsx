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
  const [gameDate, setGameDate] = useState({ year: 2025, month: 1 });
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());

  // 6시간(실제) = 1달(게임)
  const REAL_HOURS_PER_GAME_MONTH = 6;
  const MS_PER_GAME_MONTH = REAL_HOURS_PER_GAME_MONTH * 60 * 60 * 1000;

  // 게임 시작 시간 초기화
  useEffect(() => {
    const savedStartTime = localStorage.getItem('gameStartTime');
    if (savedStartTime) {
      setGameStartTime(parseInt(savedStartTime));
    } else {
      const now = Date.now();
      localStorage.setItem('gameStartTime', now.toString());
      setGameStartTime(now);
    }
  }, []);

  const calculateGameDate = () => {
    const now = Date.now();
    const elapsed = now - gameStartTime;
    const totalMonths = Math.floor(elapsed / MS_PER_GAME_MONTH);

    const year = 2025 + Math.floor(totalMonths / 12);
    const month = (totalMonths % 12) + 1;

    return { year, month };
  };

  useEffect(() => {
    fetchDashboardData();

    // 게임 날짜 업데이트 (1분마다 체크)
    setGameDate(calculateGameDate());
    const timer = setInterval(() => {
      setGameDate(calculateGameDate());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 팀 정보
      const teamRes = await axios.get('/api/teams');
      setTeamStats(teamRes.data);

      // 최근 경기
      const matchesRes = await axios.get('/api/leagues/all-matches/recent');
      setRecentMatches(matchesRes.data);

      // 예정된 경기
      const upcomingRes = await axios.get('/api/leagues/all-matches/upcoming');
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

  const getMonthName = (month: number) => {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    return months[month - 1];
  };

  const getTimeUntilNextMonth = () => {
    const now = Date.now();
    const elapsed = now - gameStartTime;
    const currentMonthProgress = elapsed % MS_PER_GAME_MONTH;
    const remaining = MS_PER_GAME_MONTH - currentMonthProgress;
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}시간 ${minutes}분`;
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="page-title">대시보드</h1>
        <div className="game-time">
          <div className="game-date">{gameDate.year}년 {getMonthName(gameDate.month)}</div>
          <div className="next-month">다음 달까지 {getTimeUntilNextMonth()}</div>
        </div>
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
                <p className="stat-value">{teamStats.player_count} / 10</p>
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
                  <div className="match-teams">
                    <span className="team-with-logo">
                      {match.home_team_logo && <img src={match.home_team_logo} alt="" className="team-logo-small" />}
                      {match.home_team_name}
                    </span>
                    <span className="vs">vs</span>
                    <span className="team-with-logo">
                      {match.away_team_logo && <img src={match.away_team_logo} alt="" className="team-logo-small" />}
                      {match.away_team_name}
                    </span>
                  </div>
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
                  <div className="match-teams">
                    <span className="team-with-logo">
                      {match.home_team_logo && <img src={match.home_team_logo} alt="" className="team-logo-small" />}
                      {match.home_team_name}
                    </span>
                    <span className="match-score">{match.home_score} - {match.away_score}</span>
                    <span className="team-with-logo">
                      {match.away_team_logo && <img src={match.away_team_logo} alt="" className="team-logo-small" />}
                      {match.away_team_name}
                    </span>
                  </div>
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

