import { useState, useEffect } from 'react';
import axios from 'axios';
import RhythmGameNoteEditor from '../components/RhythmGameNoteEditor';
import './Admin.css';

interface League {
  id: number;
  name: string;
  region: string;
  season: number;
  status: string;
  team_count?: number;
  current_month?: number;
  trophy_image?: string | null;
}

interface LPOStatus {
  initialized: boolean;
  leagues: League[];
  totalTeams: number;
  aiTeams: number;
  playerTeams: number;
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
  is_ai?: boolean;
}

interface Player {
  id: number;
  name: string;
  position: string;
  face_image: string | null;
  overall: number;
  team_name: string | null;
}

interface CupTournament {
  id: number;
  name: string;
  season: number;
  status: string;
  trophy_image: string | null;
  winner_name: string | null;
}

export default function Admin() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'leagues' | 'users' | 'players' | 'rhythmGame'>('leagues');
  const [uploadingPlayerId, setUploadingPlayerId] = useState<number | null>(null);
  const [lpoStatus, setLpoStatus] = useState<LPOStatus | null>(null);
  const [statAdjustment, setStatAdjustment] = useState<number>(-20);
  const [cupSeason, setCupSeason] = useState<number>(1);
  const [cups, setCups] = useState<CupTournament[]>([]);
  const [uploadingCupId, setUploadingCupId] = useState<number | null>(null);
  const [uploadingLeagueId, setUploadingLeagueId] = useState<number | null>(null);
  const [testHomeTeam, setTestHomeTeam] = useState<number | null>(null);
  const [testAwayTeam, setTestAwayTeam] = useState<number | null>(null);
  const [goldAmount, setGoldAmount] = useState<number>(10000000);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leaguesRes, usersRes, teamsRes, playersRes, lpoStatusRes, cupsRes] = await Promise.all([
        axios.get('/api/leagues'),
        axios.get('/api/admin/users'),
        axios.get('/api/admin/teams'),
        axios.get('/api/admin/players'),
        axios.get('/api/admin/lpo/status').catch(() => ({ data: null })),
        axios.get('/api/admin/cups').catch(() => ({ data: [] }))
      ]);
      setLeagues(leaguesRes.data);
      setUsers(usersRes.data);
      setTeams(teamsRes.data);
      setPlayers(playersRes.data);
      setLpoStatus(lpoStatusRes.data);
      setCups(cupsRes.data);
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

  const initializeLPO = async () => {
    if (!confirm('LPO 리그를 초기화하시겠습니까? 이 작업은 기존 리그 데이터를 덮어씁니다.')) return;
    try {
      setLoading(true);
      await axios.post('/api/admin/lpo/initialize');
      setMessage('LPO 리그 초기화 완료! 3개 티어 리그와 32개 AI 팀이 생성되었습니다.');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'LPO 초기화 실패');
    } finally {
      setLoading(false);
    }
  };

  const clearAICards = async () => {
    if (!confirm('AI 팀의 모든 카드를 삭제하시겠습니까? 실제 선수들이 FA 상태가 됩니다.')) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/admin/ai-teams/clear-cards');
      setMessage(res.data.message);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'AI 팀 카드 삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  const resetFAMarket = async () => {
    if (!confirm('FA 시장을 완전 초기화하시겠습니까? DB 스키마 수정 및 AI 팀 카드 삭제가 수행됩니다.')) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/admin/fa-market/reset');
      setMessage(res.data.message);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'FA 시장 초기화 실패');
    } finally {
      setLoading(false);
    }
  };

  const clearAllCards = async () => {
    if (!confirm('모든 선수 카드를 삭제하시겠습니까? 유저 팀 선수도 모두 FA가 됩니다!')) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/admin/fa-market/clear-all');
      setMessage(res.data.message);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '전체 카드 삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  const generateAICards = async () => {
    if (!confirm('모든 AI 팀에 가상 선수를 생성하시겠습니까?')) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/admin/ai-teams/generate-cards');
      setMessage(res.data.message);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'AI 팀 카드 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const syncRoster = async () => {
    if (!confirm('2025 시즌 선수 데이터를 DB에 동기화하시겠습니까?')) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/admin/players/sync-roster');
      setMessage(`선수 동기화 완료: 총 ${res.data.total}명 (신규 ${res.data.inserted}, 업데이트 ${res.data.updated})`);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '선수 동기화 실패');
    } finally {
      setLoading(false);
    }
  };

  const startNextSeason = async () => {
    if (!confirm('다음 시즌을 시작하시겠습니까? 승강 결과가 반영됩니다.')) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/admin/lpo/next-season');
      setMessage(`시즌 ${res.data.newSeason} 시작! 승강 처리 완료.`);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '다음 시즌 시작 실패');
    } finally {
      setLoading(false);
    }
  };

  const _registerTeamToLeague = async (leagueId: number, teamId: number) => {
    try {
      await axios.post(`/api/admin/leagues/${leagueId}/register-team`, { teamId });
      setMessage('팀 등록 완료');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '팀 등록 실패');
    }
  };
  // 나중에 개별 팀 등록 UI에서 사용할 수 있도록 보관
  void _registerTeamToLeague;

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

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'SOUTH': return 'LPO SOUTH';
      case 'NORTH': return 'LPO NORTH';
      default: return tier;
    }
  };

  const resetGameTime = () => {
    localStorage.removeItem('gameStartTime');
    setMessage('게임 시간이 초기화되었습니다. 페이지를 새로고침하세요.');
  };

  const adjustPlayerStats = async () => {
    if (!confirm(`모든 선수의 스탯을 ${statAdjustment > 0 ? '+' : ''}${statAdjustment} 조정하시겠습니까?`)) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/admin/players/adjust-stats', { adjustment: statAdjustment });
      setMessage(res.data.message);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '스탯 조정 실패');
    } finally {
      setLoading(false);
    }
  };

  const createCupTournament = async () => {
    if (!confirm(`시즌 ${cupSeason} 컵 대회를 생성하시겠습니까?`)) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/admin/cup/create', { season: cupSeason });
      setMessage(res.data.message);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '컵 대회 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const deleteCup = async (cupId: number, cupName: string) => {
    if (!confirm(`정말로 "${cupName}"을(를) 삭제하시겠습니까? 모든 경기 데이터가 삭제됩니다.`)) return;
    try {
      setLoading(true);
      const res = await axios.delete(`/api/admin/cup/${cupId}`);
      setMessage(res.data.message);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '컵 대회 삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleTrophyUpload = async (cupId: number, file: File) => {
    try {
      setUploadingCupId(cupId);
      const formData = new FormData();
      formData.append('image', file);

      await axios.post(`/api/admin/cup/${cupId}/trophy`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage('트로피 이미지 업로드 완료');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '트로피 이미지 업로드 실패');
    } finally {
      setUploadingCupId(null);
    }
  };

  const deleteTrophy = async (cupId: number) => {
    if (!confirm('트로피 이미지를 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`/api/admin/cup/${cupId}/trophy`);
      setMessage('트로피 이미지 삭제 완료');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '트로피 이미지 삭제 실패');
    }
  };

  const handleLeagueTrophyUpload = async (leagueId: number, file: File) => {
    try {
      setUploadingLeagueId(leagueId);
      const formData = new FormData();
      formData.append('image', file);

      await axios.post(`/api/admin/league/${leagueId}/trophy`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage('리그 트로피 이미지 업로드 완료');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '리그 트로피 이미지 업로드 실패');
    } finally {
      setUploadingLeagueId(null);
    }
  };

  const deleteLeagueTrophy = async (leagueId: number) => {
    if (!confirm('리그 트로피 이미지를 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`/api/admin/league/${leagueId}/trophy`);
      setMessage('리그 트로피 이미지 삭제 완료');
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '리그 트로피 이미지 삭제 실패');
    }
  };

  const createTestMatch = async () => {
    if (!testHomeTeam || !testAwayTeam) {
      setMessage('홈팀과 어웨이팀을 선택해주세요');
      return;
    }
    if (testHomeTeam === testAwayTeam) {
      setMessage('같은 팀끼리는 경기할 수 없습니다');
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post('/api/admin/test-match', {
        homeTeamId: testHomeTeam,
        awayTeamId: testAwayTeam
      });
      setMessage(`테스트 경기가 생성되었습니다. 경기 ID: ${res.data.matchId}`);
      // 경기 페이지로 이동
      window.open(`/live/${res.data.matchId}`, '_blank');
    } catch (error: any) {
      setMessage(error.response?.data?.error || '테스트 경기 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const addGoldToAllTeams = async () => {
    if (!confirm(`모든 유저 팀에 ${goldAmount.toLocaleString()} 원를 지급하시겠습니까?`)) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/admin/teams/add-gold-all', { amount: goldAmount });
      setMessage(res.data.message);
      fetchData();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '원 지급 실패');
    } finally {
      setLoading(false);
    }
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
        <button
          className={activeTab === 'rhythmGame' ? 'active' : ''}
          onClick={() => setActiveTab('rhythmGame')}
        >
          🎵 리듬게임 설정
        </button>
      </div>

      {activeTab === 'leagues' && (
        <div className="admin-section">
          <h2>LPO 리그 관리</h2>

          {lpoStatus && (
            <div className="lpo-status-box">
              <h3>LPO 상태</h3>
              <div className="status-info">
                <p><strong>초기화:</strong> {lpoStatus.initialized ? '완료' : '미완료'}</p>
                <p><strong>전체 팀:</strong> {lpoStatus.totalTeams}개</p>
                <p><strong>AI 팀:</strong> {lpoStatus.aiTeams}개</p>
                <p><strong>플레이어 팀:</strong> {lpoStatus.playerTeams}개</p>
              </div>
            </div>
          )}

          <div className="action-buttons">
            {!lpoStatus?.initialized && (
              <button onClick={initializeLPO} disabled={loading} className="primary">
                LPO 리그 초기화
              </button>
            )}
            {lpoStatus?.initialized && (
              <button onClick={startNextSeason} disabled={loading} className="primary">
                다음 시즌 시작
              </button>
            )}
            <button onClick={resetFAMarket} disabled={loading} className="danger">
              FA 시장 초기화 (AI만)
            </button>
            <button onClick={clearAllCards} disabled={loading} className="danger">
              전체 카드 삭제
            </button>
            <button onClick={clearAICards} disabled={loading} className="warning">
              AI 팀 카드 삭제
            </button>
            <button onClick={generateAICards} disabled={loading} className="primary">
              AI 가상선수 생성
            </button>
            <button onClick={syncRoster} disabled={loading} className="primary">
              2025 선수 DB 동기화
            </button>
            <button onClick={resetGameTime} className="secondary">
              게임 시간 초기화
            </button>
          </div>

          <div className="stat-adjustment-section">
            <h3>선수 스탯 일괄 조정</h3>
            <div className="stat-adjustment-controls">
              <input
                type="number"
                value={statAdjustment}
                onChange={(e) => setStatAdjustment(parseInt(e.target.value) || 0)}
                min="-50"
                max="50"
              />
              <button onClick={adjustPlayerStats} disabled={loading} className="warning">
                전체 선수 스탯 조정
              </button>
            </div>
            <p className="hint">음수: 스탯 감소, 양수: 스탯 증가 (모든 pro_players, player_cards, players에 적용)</p>
          </div>

          <div className="cup-creation-section">
            <h3>컵 대회 생성</h3>
            <div className="cup-creation-controls">
              <label>시즌:</label>
              <input
                type="number"
                value={cupSeason}
                onChange={(e) => setCupSeason(parseInt(e.target.value) || 1)}
                min="1"
              />
              <button onClick={createCupTournament} disabled={loading} className="primary">
                컵 대회 생성
              </button>
            </div>
          </div>

          <div className="test-match-section">
            <h3>테스트 경기</h3>
            <p className="hint">맵 시스템을 테스트하기 위한 친선 경기를 생성합니다.</p>
            <div className="test-match-controls">
              <div className="team-select">
                <label>홈팀:</label>
                <select
                  value={testHomeTeam || ''}
                  onChange={(e) => setTestHomeTeam(parseInt(e.target.value) || null)}
                >
                  <option value="">팀 선택</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.is_ai ? '(AI)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <span className="vs-text">VS</span>
              <div className="team-select">
                <label>어웨이팀:</label>
                <select
                  value={testAwayTeam || ''}
                  onChange={(e) => setTestAwayTeam(parseInt(e.target.value) || null)}
                >
                  <option value="">팀 선택</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.is_ai ? '(AI)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={createTestMatch}
                disabled={loading || !testHomeTeam || !testAwayTeam}
                className="primary"
              >
                테스트 경기 시작
              </button>
            </div>
          </div>

          <div className="gold-section">
            <h3>원 지급</h3>
            <div className="gold-controls">
              <input
                type="number"
                value={goldAmount}
                onChange={(e) => setGoldAmount(parseInt(e.target.value) || 0)}
                min="0"
                step="1000000"
              />
              <button onClick={addGoldToAllTeams} disabled={loading} className="primary">
                모든 유저 팀에 지급
              </button>
            </div>
            <p className="hint">입력한 금액을 모든 유저 팀에 일괄 지급합니다.</p>
          </div>

          {cups.length > 0 && (
            <div className="trophy-management-section">
              <h3>트로피 이미지 관리</h3>
              <div className="cups-trophy-grid">
                {cups.map(cup => (
                  <div key={cup.id} className="cup-trophy-card">
                    <div className="cup-trophy-image">
                      {cup.trophy_image ? (
                        <img src={cup.trophy_image} alt="Trophy" />
                      ) : (
                        <div className="no-trophy">이미지 없음</div>
                      )}
                    </div>
                    <div className="cup-trophy-info">
                      <div className="cup-name">{cup.name}</div>
                      <div className="cup-status">{cup.status}</div>
                      {cup.winner_name && <div className="cup-winner">우승: {cup.winner_name}</div>}
                    </div>
                    <div className="cup-trophy-actions">
                      <label className="upload-btn">
                        {uploadingCupId === cup.id ? '업로드 중...' : '트로피 선택'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleTrophyUpload(cup.id, file);
                          }}
                          disabled={uploadingCupId === cup.id}
                        />
                      </label>
                      {cup.trophy_image && (
                        <button onClick={() => deleteTrophy(cup.id)} className="danger">
                          이미지삭제
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => deleteCup(cup.id, cup.name)}
                      className="danger"
                      style={{ marginTop: '0.5rem', width: '100%' }}
                      disabled={loading}
                    >
                      컵 대회 삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {leagues.filter(l => l.name.includes('LPO')).length > 0 && (
            <div className="trophy-management-section league-trophy">
              <h3>리그 트로피 이미지 관리</h3>
              <div className="cups-trophy-grid">
                {leagues.filter(l => l.name.includes('LPO')).map(league => (
                  <div key={league.id} className="cup-trophy-card">
                    <div className="cup-trophy-image">
                      {league.trophy_image ? (
                        <img src={league.trophy_image} alt="Trophy" />
                      ) : (
                        <div className="no-trophy">이미지 없음</div>
                      )}
                    </div>
                    <div className="cup-trophy-info">
                      <div className="cup-name">{league.name}</div>
                      <div className="cup-status">시즌 {league.season}</div>
                    </div>
                    <div className="cup-trophy-actions">
                      <label className="upload-btn">
                        {uploadingLeagueId === league.id ? '업로드 중...' : '트로피 선택'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLeagueTrophyUpload(league.id, file);
                          }}
                          disabled={uploadingLeagueId === league.id}
                        />
                      </label>
                      {league.trophy_image && (
                        <button onClick={() => deleteLeagueTrophy(league.id)} className="danger">
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2>리그 목록</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>티어</th>
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
                  <td>{getTierName(league.region)}</td>
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
                <th>티어</th>
                <th>유형</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className={team.is_ai ? 'ai-team-row' : ''}>
                  <td>{team.id}</td>
                  <td>{team.name}</td>
                  <td>{getTierName(team.league)}</td>
                  <td>{team.is_ai ? <span className="ai-badge">AI</span> : <span className="player-badge">플레이어</span>}</td>
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

      {activeTab === 'rhythmGame' && (
        <div className="admin-section">
          <RhythmGameNoteEditor />
        </div>
      )}
    </div>
  );
}
