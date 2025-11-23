import { useEffect, useState } from 'react';
import axios from 'axios';
import './Scout.css';

interface Scouter {
  id: number;
  name: string;
  star_rating: number;
  specialty: string | null;
  hired_at: string;
  pending_discoveries: number;
}

interface Discovery {
  id: number;
  pro_player_id: number;
  name: string;
  position: string;
  nationality: string;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  overall: number;
  face_image: string | null;
  scouter_name: string;
  scouter_star: number;
  discovered_at: string;
}

export default function Scout() {
  const [scouters, setScouters] = useState<Scouter[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [hireCost, setHireCost] = useState<number>(10000000);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    dialogue?: string;
  } | null>(null);

  useEffect(() => {
    fetchScouters();
    fetchDiscoveries();
  }, []);

  const fetchScouters = async () => {
    try {
      const response = await axios.get('/api/scout/scouters');
      setScouters(response.data);
    } catch (error) {
      console.error('Failed to fetch scouters:', error);
    }
  };

  const fetchDiscoveries = async () => {
    try {
      const response = await axios.get('/api/scout/discoveries');
      setDiscoveries(response.data);
    } catch (error) {
      console.error('Failed to fetch discoveries:', error);
    }
  };

  const hireScouter = async () => {
    if (loading) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await axios.post('/api/scout/hire-scouter', { cost: hireCost });
      setResult({
        success: true,
        message: response.data.message
      });
      fetchScouters();
    } catch (error: any) {
      setResult({
        success: false,
        message: error.response?.data?.error || '스카우터 영입에 실패했습니다'
      });
    } finally {
      setLoading(false);
    }
  };

  const fireScouter = async (scouterId: number) => {
    if (!confirm('정말 이 스카우터를 해고하시겠습니까?')) return;

    try {
      await axios.delete(`/api/scout/scouters/${scouterId}`);
      fetchScouters();
      fetchDiscoveries();
    } catch (error: any) {
      alert(error.response?.data?.error || '스카우터 해고에 실패했습니다');
    }
  };

  const discoverPlayer = async (scouterId: number) => {
    if (loading) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await axios.post(`/api/scout/scouters/${scouterId}/discover`);
      setResult({
        success: true,
        message: response.data.message
      });
      fetchScouters();
      fetchDiscoveries();
    } catch (error: any) {
      setResult({
        success: false,
        message: error.response?.data?.error || '선수 발굴에 실패했습니다'
      });
    } finally {
      setLoading(false);
    }
  };

  const signPlayer = async (discoveryId: number) => {
    if (loading) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await axios.post(`/api/scout/discoveries/${discoveryId}/sign`);
      setResult({
        success: true,
        message: response.data.message,
        dialogue: response.data.dialogue
      });
      fetchDiscoveries();
    } catch (error: any) {
      setResult({
        success: false,
        message: error.response?.data?.error || '선수 계약에 실패했습니다'
      });
    } finally {
      setLoading(false);
    }
  };

  const rejectDiscovery = async (discoveryId: number) => {
    if (!confirm('정말 이 선수를 거절하시겠습니까?')) return;

    try {
      await axios.delete(`/api/scout/discoveries/${discoveryId}`);
      fetchDiscoveries();
    } catch (error: any) {
      alert(error.response?.data?.error || '거절에 실패했습니다');
    }
  };

  const formatCost = (cost: number) => {
    if (cost >= 100000000) {
      return `${(cost / 100000000).toFixed(1)}억`;
    } else if (cost >= 10000) {
      return `${(cost / 10000).toFixed(0)}만`;
    }
    return cost.toLocaleString();
  };

  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = {
      'TOP': '#FF6B6B',
      'JUNGLE': '#4ECDC4',
      'MID': '#45B7D1',
      'ADC': '#96CEB4',
      'SUPPORT': '#DDA0DD'
    };
    return colors[position] || '#888';
  };

  const renderStars = (rating: number) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  return (
    <div className="scout-page">
      <h1 className="page-title">스카우트</h1>

      {result && (
        <div className={`scout-result ${result.success ? 'success' : 'failed'}`}>
          <p className="result-message">{result.message}</p>
          {result.dialogue && (
            <p className="result-dialogue">"{result.dialogue}"</p>
          )}
          <button onClick={() => setResult(null)}>확인</button>
        </div>
      )}

      <div className="scout-content">
        <div className="scouters-section">
          <h2>스카우터 영입</h2>
          <div className="hire-scouter-box">
            <p className="hire-description">
              골드를 투자하여 스카우터를 영입하세요.
              더 많이 투자할수록 높은 등급의 스카우터를 얻을 확률이 높아집니다.
            </p>
            <div className="hire-controls">
              <select
                value={hireCost}
                onChange={(e) => setHireCost(parseInt(e.target.value))}
              >
                <option value={1000000}>100만 골드 (1~2성 확률 높음)</option>
                <option value={5000000}>500만 골드 (2성 확률 높음)</option>
                <option value={10000000}>1000만 골드 (2~3성 확률 높음)</option>
                <option value={20000000}>2000만 골드 (3성 확률 높음)</option>
                <option value={50000000}>5000만 골드 (3~4성 확률 높음)</option>
                <option value={100000000}>1억 골드 (4~5성 확률 높음)</option>
              </select>
              <button
                className="hire-btn"
                onClick={hireScouter}
                disabled={loading}
              >
                {loading ? '영입 중...' : '스카우터 영입'}
              </button>
            </div>
          </div>

          <h2>보유 스카우터 ({scouters.length}명)</h2>
          {scouters.length === 0 ? (
            <p className="no-scouters">보유한 스카우터가 없습니다</p>
          ) : (
            <div className="scouters-list">
              {scouters.map(scouter => (
                <div key={scouter.id} className="scouter-card">
                  <div className="scouter-header">
                    <span className="scouter-name">{scouter.name}</span>
                    <span className={`star-rating star-${scouter.star_rating}`}>
                      {renderStars(scouter.star_rating)}
                    </span>
                  </div>
                  <div className="scouter-info">
                    {scouter.specialty ? (
                      <span className="specialty" style={{ color: getPositionColor(scouter.specialty) }}>
                        {scouter.specialty} 전문
                      </span>
                    ) : (
                      <span className="specialty">전체 포지션</span>
                    )}
                    {scouter.pending_discoveries > 0 && (
                      <span className="pending-badge">{scouter.pending_discoveries}명 발굴</span>
                    )}
                  </div>
                  <div className="scouter-actions">
                    <button
                      className="discover-btn"
                      onClick={() => discoverPlayer(scouter.id)}
                      disabled={loading}
                    >
                      선수 발굴
                    </button>
                    <button
                      className="fire-btn"
                      onClick={() => fireScouter(scouter.id)}
                    >
                      해고
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="discoveries-section">
          <h2>발굴된 선수 ({discoveries.length}명)</h2>
          {discoveries.length === 0 ? (
            <p className="no-discoveries">발굴된 선수가 없습니다. 스카우터를 통해 선수를 발굴하세요.</p>
          ) : (
            <div className="discoveries-list">
              {discoveries.map(discovery => (
                <div key={discovery.id} className="discovery-card">
                  <div className="player-header">
                    {discovery.face_image ? (
                      <img src={discovery.face_image} alt={discovery.name} className="player-face" />
                    ) : (
                      <div className="player-face-placeholder">
                        {discovery.name.charAt(0)}
                      </div>
                    )}
                    <div className="player-info">
                      <h3>{discovery.name}</h3>
                      <span
                        className="position-badge"
                        style={{ backgroundColor: getPositionColor(discovery.position) }}
                      >
                        {discovery.position}
                      </span>
                    </div>
                  </div>

                  <div className="player-stats">
                    <div className="stat">
                      <span>멘탈</span>
                      <span>{discovery.mental}</span>
                    </div>
                    <div className="stat">
                      <span>팀파이트</span>
                      <span>{discovery.teamfight}</span>
                    </div>
                    <div className="stat">
                      <span>집중력</span>
                      <span>{discovery.focus}</span>
                    </div>
                    <div className="stat">
                      <span>라인전</span>
                      <span>{discovery.laning}</span>
                    </div>
                    <div className="stat overall">
                      <span>오버롤</span>
                      <span>{discovery.overall}</span>
                    </div>
                  </div>

                  <div className="discovery-meta">
                    <span className="scouter-info">
                      {discovery.scouter_name} ({renderStars(discovery.scouter_star)})
                    </span>
                  </div>

                  <div className="sign-cost">
                    계약금: {formatCost(discovery.overall * 1000)}
                  </div>

                  <div className="discovery-actions">
                    <button
                      className="sign-btn"
                      onClick={() => signPlayer(discovery.id)}
                      disabled={loading}
                    >
                      계약
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => rejectDiscovery(discovery.id)}
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
