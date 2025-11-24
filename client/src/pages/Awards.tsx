import { useState, useEffect } from 'react';
import axios from 'axios';
import './Awards.css';

interface Award {
  id: number;
  season: number;
  award_type: string;
  player_name: string;
  team_name: string;
  stats_value: number;
  prize_gold: number;
  created_at: string;
}

interface AwardStats {
  teamStats: Array<{
    id: number;
    name: string;
    award_count: number;
    total_prize: number;
  }>;
  playerStats: Array<{
    name: string;
    award_count: number;
    total_prize: number;
  }>;
}

export default function Awards() {
  const [activeTab, setActiveTab] = useState<'season' | 'team' | 'stats'>('season');
  const [seasonAwards, setSeasonAwards] = useState<Award[]>([]);
  const [teamAwards, setTeamAwards] = useState<Award[]>([]);
  const [stats, setStats] = useState<AwardStats | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedSeason]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [seasonRes, teamRes, statsRes] = await Promise.all([
        axios.get(`/api/awards/season/${selectedSeason}`),
        axios.get('/api/awards/team'),
        axios.get('/api/awards/stats')
      ]);
      setSeasonAwards(seasonRes.data);
      setTeamAwards(teamRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAwardTypeName = (type: string) => {
    switch (type) {
      case 'MVP': return 'MVP';
      case 'ROOKIE': return '신인왕';
      case 'TOP_SCORER': return '득점왕';
      case 'ASSIST_KING': return '어시스트왕';
      case 'BEST_SUPPORT': return '베스트 서포터';
      case 'BEST_JUNGLER': return '베스트 정글러';
      default: return type;
    }
  };

  const getAwardColor = (type: string) => {
    switch (type) {
      case 'MVP': return '#f9ca24';
      case 'ROOKIE': return '#4ecdc4';
      case 'TOP_SCORER': return '#ff6b6b';
      case 'ASSIST_KING': return '#a29bfe';
      case 'BEST_SUPPORT': return '#81ecec';
      case 'BEST_JUNGLER': return '#55efc4';
      default: return '#888';
    }
  };

  if (loading) {
    return <div className="awards-page"><div className="loading">로딩 중...</div></div>;
  }

  return (
    <div className="awards-page">
      <h1>시즌 어워드</h1>

      <div className="tabs">
        <button className={activeTab === 'season' ? 'active' : ''} onClick={() => setActiveTab('season')}>
          시즌별 어워드
        </button>
        <button className={activeTab === 'team' ? 'active' : ''} onClick={() => setActiveTab('team')}>
          내 팀 어워드
        </button>
        <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>
          전체 통계
        </button>
      </div>

      {activeTab === 'season' && (
        <div className="season-section">
          <div className="season-selector">
            <label>시즌 선택:</label>
            <select value={selectedSeason} onChange={e => setSelectedSeason(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map(s => (
                <option key={s} value={s}>시즌 {s}</option>
              ))}
            </select>
          </div>

          {seasonAwards.length === 0 ? (
            <p className="empty">해당 시즌 어워드 기록이 없습니다</p>
          ) : (
            <div className="award-grid">
              {seasonAwards.map(award => (
                <div key={award.id} className="award-card">
                  <div className="award-type" style={{ color: getAwardColor(award.award_type) }}>
                    {getAwardTypeName(award.award_type)}
                  </div>
                  <div className="player-name">{award.player_name}</div>
                  <div className="team-name">{award.team_name}</div>
                  <div className="prize">{award.prize_gold.toLocaleString()} 원</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="team-section">
          {teamAwards.length === 0 ? (
            <p className="empty">어워드 기록이 없습니다</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>시즌</th>
                  <th>어워드</th>
                  <th>선수</th>
                  <th>상금</th>
                </tr>
              </thead>
              <tbody>
                {teamAwards.map(award => (
                  <tr key={award.id}>
                    <td>시즌 {award.season}</td>
                    <td style={{ color: getAwardColor(award.award_type) }}>
                      {getAwardTypeName(award.award_type)}
                    </td>
                    <td>{award.player_name}</td>
                    <td>{award.prize_gold.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'stats' && stats && (
        <div className="stats-section">
          <div className="stats-group">
            <h2>팀별 어워드 순위</h2>
            {stats.teamStats.length === 0 ? (
              <p className="empty">데이터가 없습니다</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>팀</th>
                    <th>수상 횟수</th>
                    <th>총 상금</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.teamStats.map((team, i) => (
                    <tr key={team.id}>
                      <td>{i + 1}</td>
                      <td>{team.name}</td>
                      <td>{team.award_count}</td>
                      <td>{Number(team.total_prize).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="stats-group">
            <h2>선수별 어워드 순위</h2>
            {stats.playerStats.length === 0 ? (
              <p className="empty">데이터가 없습니다</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>선수</th>
                    <th>수상 횟수</th>
                    <th>총 상금</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.playerStats.map((player, i) => (
                    <tr key={player.name}>
                      <td>{i + 1}</td>
                      <td>{player.name}</td>
                      <td>{player.award_count}</td>
                      <td>{Number(player.total_prize).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
