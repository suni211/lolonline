import { useState, useEffect } from 'react';
import axios from 'axios';
import './Admin.css';

interface League {
  id: number;
  name: string;
  region: string;
  season: number;
  status: string;
  team_count?: number;
}

interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  team_name?: string;
  created_at: string;
}

interface Team {
  id: number;
  name: string;
  league: string;
}

interface Player {
  id: number;
  name: string;
  position: string;
  face_image: string | null;
  overall: number;
  team_name: string | null;
}

export default function Admin() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'leagues' | 'users' | 'players'>('leagues');
  const [uploadingPlayerId, setUploadingPlayerId] = useState<number | null>(null);

  // 시즌 생성 폼
  const [newSeason, setNewSeason] = useState({
    season: 1,
    eastName: 'EAST 리그',
    westName: 'WEST 리그'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leaguesRes, usersRes, teamsRes, playersRes] = await Promise.all([
        axios.get('/api/leagues'),
        axios.get('/api/admin/users'),
        axios.get('/api/admin/teams'),
        axios.get('/api/admin/players')
      ]);
      setLeagues(leaguesRes.data);
      setUsers(usersRes.data);
      setTeams(teamsRes.data);
      setPlayers(playersRes.data);
    } catch (error: any) {
      setMessage(error.response?.data?.error || '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (playerId: number, file: File) => {
    try {
      setUploadingPlayerId(playerId);
      const formData = new FormData();
      formData.append('image', file);

      await axios.post(`/api/admin/players/${playerId}/face`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage('이미지 업로드 완료');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '이미지 업로드 실패');
    } finally {
      setUploadingPlayerId(null);
    }
  };

  const deleteImage = async (playerId: number) => {
    if (!confirm('이미지를 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`/api/admin/players/${playerId}/face`);
      setMessage('이미지 삭제 완료');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '이미지 삭제 실패');
    }
  };

  const createSeason = async () => {
    try {
      setLoading(true);
      await axios.post('/api/admin/leagues/create-season', newSeason);
      setMessage(`시즌 ${newSeason.season} 생성 완료`);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '시즌 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const registerTeamToLeague = async (leagueId: number, teamId: number) => {
    try {
      await axios.post(`/api/admin/leagues/${leagueId}/register-team`, { teamId });
      setMessage('팀 등록 완료');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '팀 등록 실패');
    }
  };

  const startLeague = async (leagueId: number) => {
    try {
      setLoading(true);
      const res = await axios.post(`/api/admin/leagues/${leagueId}/start`);
      setMessage(`리그 시작! ${res.data.matchCount}경기 스케줄 생성`);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '리그 시작 실패');
    } finally {
      setLoading(false);
    }
  };

  const resetUser = async (userId: number) => {
    if (!confirm('정말 이 유저를 초기화하시겠습니까?')) return;
    try {
      await axios.post(`/api/admin/users/${userId}/reset`);
      setMessage('유저 초기화 완료');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '유저 초기화 실패');
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('정말 이 유저를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      await axios.delete(`/api/admin/users/${userId}`);
      setMessage('유저 삭제 완료');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '유저 삭제 실패');
    }
  };

  const autoAssignTeams = async () => {
    try {
      setLoading(true);
      // EAST와 WEST 리그에 팀 자동 배정
      const eastLeague = leagues.find(l => l.region === 'EAST' && l.status === 'UPCOMING');
      const westLeague = leagues.find(l => l.region === 'WEST' && l.status === 'UPCOMING');

      if (!eastLeague || !westLeague) {
        setMessage('UPCOMING 상태의 EAST/WEST 리그가 필요합니다');
        return;
      }

      const eastTeams = teams.filter(t => t.league === 'EAST');
      const westTeams = teams.filter(t => t.league === 'WEST');

      for (const team of eastTeams) {
        await axios.post(`/api/admin/leagues/${eastLeague.id}/register-team`, { teamId: team.id });
      }
      for (const team of westTeams) {
        await axios.post(`/api/admin/leagues/${westLeague.id}/register-team`, { teamId: team.id });
      }

      setMessage(`EAST ${eastTeams.length}팀, WEST ${westTeams.length}팀 배정 완료`);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '자동 배정 실패');
    } finally {
      setLoading(false);
    }
  };

  const resetGameTime = () => {
    localStorage.removeItem('gameStartTime');
    setMessage('게임 시간이 초기화되었습니다. 페이지를 새로고침하세요.');
  };

  return (
    <div className="admin-page">
      <h1>어드민 관리</h1>

      {message && (
        <div className={`message ${message.includes('실패') ? 'error' : 'success'}`}>
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      <div className="admin-tabs">
        <button
          className={activeTab === 'leagues' ? 'active' : ''}
          onClick={() => setActiveTab('leagues')}
        >
          리그 관리
        </button>
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          유저 관리
        </button>
        <button
          className={activeTab === 'players' ? 'active' : ''}
          onClick={() => setActiveTab('players')}
        >
          선수 이미지
        </button>
      </div>

      {activeTab === 'leagues' && (
        <div className="admin-section">
          <h2>시즌 생성</h2>
          <div className="form-row">
            <div className="form-group">
              <label>시즌</label>
              <input
                type="number"
                value={newSeason.season}
                onChange={(e) => setNewSeason({ ...newSeason, season: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>EAST 리그명</label>
              <input
                type="text"
                value={newSeason.eastName}
                onChange={(e) => setNewSeason({ ...newSeason, eastName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>WEST 리그명</label>
              <input
                type="text"
                value={newSeason.westName}
                onChange={(e) => setNewSeason({ ...newSeason, westName: e.target.value })}
              />
            </div>
            <button onClick={createSeason} disabled={loading}>
              시즌 생성
            </button>
          </div>

          <div className="action-buttons">
            <button onClick={autoAssignTeams} disabled={loading}>
              팀 자동 배정
            </button>
            <button onClick={resetGameTime} className="secondary">
              게임 시간 초기화
            </button>
          </div>

          <h2>리그 목록</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>지역</th>
                <th>시즌</th>
                <th>상태</th>
                <th>팀 수</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {leagues.map((league) => (
                <tr key={league.id}>
                  <td>{league.id}</td>
                  <td>{league.name}</td>
                  <td>{league.region}</td>
                  <td>{league.season}</td>
                  <td>
                    <span className={`status-badge ${league.status.toLowerCase()}`}>
                      {league.status}
                    </span>
                  </td>
                  <td>{league.team_count || 0}</td>
                  <td>
                    {league.status === 'UPCOMING' && (
                      <button onClick={() => startLeague(league.id)} disabled={loading}>
                        리그 시작
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>팀 목록</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>팀명</th>
                <th>리그</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td>{team.id}</td>
                  <td>{team.name}</td>
                  <td>{team.league}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-section">
          <h2>유저 목록</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>사용자명</th>
                <th>이메일</th>
                <th>팀명</th>
                <th>어드민</th>
                <th>가입일</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{user.team_name || '-'}</td>
                  <td>{user.is_admin ? '✓' : ''}</td>
                  <td>{new Date(user.created_at).toLocaleDateString('ko-KR')}</td>
                  <td>
                    <button onClick={() => resetUser(user.id)} className="warning">
                      초기화
                    </button>
                    <button onClick={() => deleteUser(user.id)} className="danger">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'players' && (
        <div className="admin-section">
          <h2>선수 얼굴 이미지 관리</h2>
          <div className="players-grid">
            {players.map((player) => (
              <div key={player.id} className="player-card">
                <div className="player-image">
                  {player.face_image ? (
                    <img src={player.face_image} alt={player.name} />
                  ) : (
                    <div className="no-image">이미지 없음</div>
                  )}
                </div>
                <div className="player-info">
                  <div className="player-name">{player.name}</div>
                  <div className="player-details">
                    {player.position} | OVR {player.overall}
                  </div>
                  {player.team_name && (
                    <div className="player-team">{player.team_name}</div>
                  )}
                </div>
                <div className="player-actions">
                  <label className="upload-btn">
                    {uploadingPlayerId === player.id ? '업로드 중...' : '이미지 선택'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(player.id, file);
                      }}
                      disabled={uploadingPlayerId === player.id}
                    />
                  </label>
                  {player.face_image && (
                    <button
                      onClick={() => deleteImage(player.id)}
                      className="danger"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
