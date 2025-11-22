import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './CreateTeam.css';

// 프리셋 색상
const presetColors = [
  { name: '블루', color: '#1E3A8A' },
  { name: '레드', color: '#DC2626' },
  { name: '그린', color: '#16A34A' },
  { name: '퍼플', color: '#7C3AED' },
  { name: '오렌지', color: '#EA580C' },
  { name: '핑크', color: '#DB2777' },
  { name: '시안', color: '#0891B2' },
  { name: '골드', color: '#CA8A04' },
];

export default function CreateTeam() {
  const [teamName, setTeamName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [teamColor, setTeamColor] = useState('#1E3A8A');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { fetchUserInfo } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!teamName.trim()) {
      setError('팀 이름을 입력해주세요');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post('/api/teams/create', {
        name: teamName,
        logo_url: logoUrl || null,
        team_color: teamColor
      });

      // 새로운 토큰이 있으면 저장
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }

      // 사용자 정보 다시 가져오기
      await fetchUserInfo();
      
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || '팀 생성에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-team-container">
      <div className="create-team-box">
        <h1 className="create-team-title">팀 생성</h1>
        <p className="create-team-subtitle">당신만의 팀을 만들어보세요!</p>
        
        <form onSubmit={handleSubmit} className="create-team-form">
          <div className="form-group">
            <label htmlFor="teamName">팀 이름 *</label>
            <input
              id="teamName"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="팀 이름을 입력하세요"
              maxLength={50}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>리그 배정</label>
            <div className="league-info-box">
              <div className="league-name">LPO 2 LEAGUE</div>
              <div className="league-desc">
                모든 신규 팀은 LPO 2 LEAGUE (3부 리그)에서 시작합니다.
                <br />시즌 종료 시 상위 2팀이 LPO 1 LEAGUE로 승격됩니다.
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="teamColor">팀 색깔</label>
            <div className="color-picker-container">
              <input
                id="teamColor"
                type="color"
                value={teamColor}
                onChange={(e) => setTeamColor(e.target.value)}
                className="color-picker"
              />
              <input
                type="text"
                value={teamColor}
                onChange={(e) => setTeamColor(e.target.value)}
                placeholder="#1E3A8A"
                className="color-input"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
            <div 
              className="color-preview" 
              style={{ backgroundColor: teamColor }}
            >
              색깔 미리보기
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="logoUrl">로고 URL (선택)</label>
            <input
              id="logoUrl"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="form-input"
            />
            {logoUrl && (
              <div className="logo-preview">
                <img src={logoUrl} alt="로고 미리보기" onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }} />
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="create-team-button"
            disabled={loading || !teamName.trim()}
          >
            {loading ? '생성 중...' : '팀 생성하기'}
          </button>
        </form>
      </div>
    </div>
  );
}

