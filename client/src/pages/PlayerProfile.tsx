import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './PlayerProfile.css';

interface PlayerInfo {
  id: number;
  name: string;
  position: string;
  nationality: string;
  team: string;
  league: string;
  face_image: string;
  overall: number;
}

interface CardStats {
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
}

interface PersonalityInfo {
  type: string;
  name: string;
  description: string;
}

interface CareerStats {
  total_games: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  total_damage: number;
  avg_dpm: number;
  kda: number;
}

interface Rankings {
  damage_rank: number;
  kills_rank: number;
  kda_rank: number;
  dpm_rank: number;
  total_players: number;
}

interface ProfileData {
  player: PlayerInfo;
  stats: CardStats | null;
  personality: PersonalityInfo | null;
  salary: number;
  career_stats: CareerStats;
  rankings: Rankings;
}

export default function PlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, [playerId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/transfer/player/${playerId}`);
      setProfile(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '프로필을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'TOP': return '#ff6b6b';
      case 'JUNGLE': return '#51cf66';
      case 'MID': return '#339af0';
      case 'ADC': return '#ffd43b';
      case 'SUPPORT': return '#cc5de8';
      default: return '#868e96';
    }
  };

  const getOvrColor = (ovr: number) => {
    if (ovr >= 90) return '#ffd700';
    if (ovr >= 80) return '#c0c0c0';
    if (ovr >= 70) return '#cd7f32';
    return '#868e96';
  };

  const getRankBadge = (rank: number, total: number) => {
    const percentage = (rank / total) * 100;
    if (percentage <= 1) return { color: '#ffd700', label: 'S' };
    if (percentage <= 5) return { color: '#ff6b6b', label: 'A+' };
    if (percentage <= 10) return { color: '#ff922b', label: 'A' };
    if (percentage <= 25) return { color: '#51cf66', label: 'B+' };
    if (percentage <= 50) return { color: '#339af0', label: 'B' };
    return { color: '#868e96', label: 'C' };
  };

  if (loading) {
    return (
      <div className="player-profile-page page-wrapper">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="player-profile-page page-wrapper">
        <div className="error">
          <p>{error || '프로필을 찾을 수 없습니다.'}</p>
          <button onClick={() => navigate(-1)}>돌아가기</button>
        </div>
      </div>
    );
  }

  const { player, stats, personality, salary, career_stats, rankings } = profile;

  return (
    <div className="player-profile-page page-wrapper">
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← 돌아가기
      </button>

      <div className="profile-header">
        <div className="player-image">
          {player.face_image ? (
            <img src={player.face_image} alt={player.name} />
          ) : (
            <div className="placeholder-image">?</div>
          )}
        </div>
        <div className="player-main-info">
          <h1 className="player-name">{player.name}</h1>
          <div className="player-meta">
            <span
              className="position-badge"
              style={{ backgroundColor: getPositionColor(player.position) }}
            >
              {player.position}
            </span>
            <span
              className="ovr-badge"
              style={{ color: getOvrColor(player.overall) }}
            >
              OVR {player.overall}
            </span>
          </div>
          <div className="player-details">
            <span>{player.team}</span>
            <span>{player.league}</span>
            <span>{player.nationality}</span>
          </div>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-section">
          <h2>연봉</h2>
          <div className="salary-display">
            {salary.toLocaleString()}원
          </div>
        </div>

        {stats && (
          <div className="profile-section">
            <h2>스탯</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">멘탈</span>
                <div className="stat-bar">
                  <div
                    className="stat-fill"
                    style={{ width: `${stats.mental}%`, backgroundColor: '#ff6b6b' }}
                  />
                </div>
                <span className="stat-value">{stats.mental}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">팀파이트</span>
                <div className="stat-bar">
                  <div
                    className="stat-fill"
                    style={{ width: `${stats.teamfight}%`, backgroundColor: '#51cf66' }}
                  />
                </div>
                <span className="stat-value">{stats.teamfight}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">집중력</span>
                <div className="stat-bar">
                  <div
                    className="stat-fill"
                    style={{ width: `${stats.focus}%`, backgroundColor: '#339af0' }}
                  />
                </div>
                <span className="stat-value">{stats.focus}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">라인전</span>
                <div className="stat-bar">
                  <div
                    className="stat-fill"
                    style={{ width: `${stats.laning}%`, backgroundColor: '#ffd43b' }}
                  />
                </div>
                <span className="stat-value">{stats.laning}</span>
              </div>
            </div>
          </div>
        )}

        {personality && (
          <div className="profile-section">
            <h2>성격</h2>
            <div className="personality-info">
              <span className="personality-type">{personality.name}</span>
              <p className="personality-desc">{personality.description}</p>
            </div>
          </div>
        )}

        <div className="profile-section">
          <h2>통산 기록</h2>
          <div className="career-stats">
            <div className="career-stat">
              <span className="stat-label">경기 수</span>
              <span className="stat-value">{career_stats.total_games}</span>
            </div>
            <div className="career-stat">
              <span className="stat-label">킬</span>
              <span className="stat-value">{career_stats.total_kills}</span>
            </div>
            <div className="career-stat">
              <span className="stat-label">데스</span>
              <span className="stat-value">{career_stats.total_deaths}</span>
            </div>
            <div className="career-stat">
              <span className="stat-label">어시스트</span>
              <span className="stat-value">{career_stats.total_assists}</span>
            </div>
            <div className="career-stat">
              <span className="stat-label">총 딜량</span>
              <span className="stat-value">{career_stats.total_damage.toLocaleString()}</span>
            </div>
            <div className="career-stat">
              <span className="stat-label">평균 DPM</span>
              <span className="stat-value">{career_stats.avg_dpm.toFixed(0)}</span>
            </div>
            <div className="career-stat highlight">
              <span className="stat-label">KDA</span>
              <span className="stat-value">{career_stats.kda.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {rankings.total_players > 0 && (
          <div className="profile-section">
            <h2>순위 ({rankings.total_players}명 중)</h2>
            <div className="rankings-grid">
              <div className="ranking-item">
                <span className="ranking-label">딜량 순위</span>
                <div className="ranking-value">
                  <span
                    className="rank-badge"
                    style={{ backgroundColor: getRankBadge(rankings.damage_rank, rankings.total_players).color }}
                  >
                    {getRankBadge(rankings.damage_rank, rankings.total_players).label}
                  </span>
                  <span className="rank-number">{rankings.damage_rank}위</span>
                </div>
              </div>
              <div className="ranking-item">
                <span className="ranking-label">킬 순위</span>
                <div className="ranking-value">
                  <span
                    className="rank-badge"
                    style={{ backgroundColor: getRankBadge(rankings.kills_rank, rankings.total_players).color }}
                  >
                    {getRankBadge(rankings.kills_rank, rankings.total_players).label}
                  </span>
                  <span className="rank-number">{rankings.kills_rank}위</span>
                </div>
              </div>
              <div className="ranking-item">
                <span className="ranking-label">KDA 순위</span>
                <div className="ranking-value">
                  <span
                    className="rank-badge"
                    style={{ backgroundColor: getRankBadge(rankings.kda_rank, rankings.total_players).color }}
                  >
                    {getRankBadge(rankings.kda_rank, rankings.total_players).label}
                  </span>
                  <span className="rank-number">{rankings.kda_rank}위</span>
                </div>
              </div>
              <div className="ranking-item">
                <span className="ranking-label">DPM 순위</span>
                <div className="ranking-value">
                  <span
                    className="rank-badge"
                    style={{ backgroundColor: getRankBadge(rankings.dpm_rank, rankings.total_players).color }}
                  >
                    {getRankBadge(rankings.dpm_rank, rankings.total_players).label}
                  </span>
                  <span className="rank-number">{rankings.dpm_rank}위</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
