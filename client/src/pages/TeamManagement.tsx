import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './TeamManagement.css';

export default function TeamManagement() {
  const { team, refreshTeam } = useAuth();
  const [teamName, setTeamName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (team) {
      setTeamName(team.name);
      setAbbreviation(team.abbreviation || '');
      setLogoUrl(team.logo_url);
    }
  }, [team]);

  const handleUpdateTeam = async () => {
    try {
      await axios.put('/api/teams', {
        name: teamName,
        abbreviation: abbreviation || undefined
      });
      setMessage('팀 정보가 업데이트되었습니다.');
      refreshTeam();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '업데이트 실패');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('logo', file);

      const res = await axios.post('/api/teams/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setLogoUrl(res.data.logoUrl);
      setMessage('로고가 업로드되었습니다.');
      refreshTeam();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '로고 업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('로고를 삭제하시겠습니까?')) return;

    try {
      await axios.delete('/api/teams/logo');
      setLogoUrl(null);
      setMessage('로고가 삭제되었습니다.');
      refreshTeam();
    } catch (error: any) {
      setMessage(error.response?.data?.error || '로고 삭제 실패');
    }
  };

  return (
    <div className="team-management-page">
      <h1 className="page-title">팀 관리</h1>

      {message && (
        <div className={`message ${message.includes('실패') ? 'error' : 'success'}`}>
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      <div className="team-info-section">
        <h2>팀 정보</h2>
        <div className="team-info-box">
          <div className="logo-section">
            <label>팀 로고</label>
            <div className="logo-preview">
              {logoUrl ? (
                <img src={logoUrl} alt="팀 로고" />
              ) : (
                <div className="no-logo">로고 없음</div>
              )}
            </div>
            <div className="logo-actions">
              <label className="upload-btn">
                {uploading ? '업로드 중...' : '로고 선택'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                />
              </label>
              {logoUrl && (
                <button onClick={handleDeleteLogo} className="delete-btn">
                  삭제
                </button>
              )}
            </div>
          </div>

          <div className="info-item">
            <label>팀 이름</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="team-input"
            />
          </div>

          <div className="info-item">
            <label>팀 약자 (2-3자)</label>
            <input
              type="text"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="예: HLE, T1, GEN"
              maxLength={3}
              className="team-input abbreviation-input"
            />
          </div>
          {team && (
            <>
              <div className="info-item">
                <label>리그</label>
                <span>{team.league} LEAGUE</span>
              </div>
              <div className="info-item">
                <label>보유 원</label>
                <span>{team.gold.toLocaleString()}원</span>
              </div>
              <div className="info-item">
                <label>보유 에너지</label>
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

