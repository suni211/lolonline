import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './CreateTeam.css';

export default function CreateTeam() {
  const [teamName, setTeamName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [teamColor, setTeamColor] = useState('#1E3A8A');
  const [league, setLeague] = useState<'SOUTH' | 'NORTH'>('SOUTH');
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
        abbreviation: abbreviation.toUpperCase() || teamName.substring(0, 3).toUpperCase(),
        logo_url: logoUrl || null,
        team_color: teamColor,
        region: league
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
            <label htmlFor="abbreviation">팀 약자 (2-3자)</label>
            <input
              id="abbreviation"
              type="text"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="예: HLE, T1, GEN"
              maxLength={3}
              className="form-input"
            />
            <small style={{ color: '#888', fontSize: '0.8rem' }}>
              미입력 시 팀 이름 앞 3글자로 자동 생성
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="league">리그 선택 *</label>
            <select
              id="league"
              value={league}
              onChange={(e) => setLeague(e.target.value as 'SOUTH' | 'NORTH')}
              className="form-input"
            >
              <option value="SOUTH">LPO SOUTH (남부 리그)</option>
              <option value="NORTH">LPO NORTH (북부 리그)</option>
            </select>
            <small style={{ color: '#888', fontSize: '0.8rem' }}>
              시즌 종료 시 각 리그 상위 4팀이 WORLDS에 진출합니다.
            </small>
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

