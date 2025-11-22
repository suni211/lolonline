import { useState, useEffect } from 'react';
import axios from 'axios';
import './FriendlyMatch.css';

interface Opponent {
  id: number;
  name: string;
  league: string;
  logo_url: string;
  team_color: string;
  starter_count: number;
  avg_overall: number;
  is_ai?: boolean;
}

interface MatchHistory {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  status: string;
  scheduled_at: string;
  finished_at: string;
  home_team_name: string;
  away_team_name: string;
}

export default function FriendlyMatch() {
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<Opponent | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'opponents' | 'history'>('opponents');

  useEffect(() => {
    fetchOpponents();
    fetchHistory();
  }, []);

  const fetchOpponents = async () => {
    try {
      const res = await axios.get('/api/friendly-matches/available-teams');
      setOpponents(res.data);
    } catch (error) {
      console.error('Failed to fetch opponents:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/friendly-matches/history');
      setHistory(res.data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const createMatch = async () => {
    if (!selectedOpponent) {
      setMessage('상대 팀을 선택해주세요');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post('/api/friendly-matches/create', {
        opponent_team_id: selectedOpponent.id
      });
      setMessage(res.data.message);
      setSelectedOpponent(null);
      fetchHistory();
      setTimeout(() => setMessage(''), 5000);
    } catch (error: any) {
      setMessage(error.response?.data?.error || '친선전 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString.replace(' ', 'T'));
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="friendly-match-page">
      <h1>친선전</h1>

      {message && (
        <div className={`message ${message.includes('실패') || message.includes('없') ? 'error' : 'success'}`}>
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      <div className="tabs">
        <button
          className={activeTab === 'opponents' ? 'active' : ''}
          onClick={() => setActiveTab('opponents')}
        >
          상대 선택
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          경기 기록
        </button>
      </div>

      {activeTab === 'opponents' && (
        <div className="opponents-section">
          <div className="section-header">
            <h2>상대 팀 선택</h2>
            <p>AI 팀과 친선전을 통해 골드와 경험치를 획득하세요</p>
          </div>

          <div className="opponents-grid">
            {opponents.map(opponent => (
              <div
                key={opponent.id}
                className={`opponent-card ${selectedOpponent?.id === opponent.id ? 'selected' : ''}`}
                onClick={() => setSelectedOpponent(opponent)}
              >
                <div className="opponent-header">
                  <div
                    className="team-logo"
                    style={{ backgroundColor: opponent.team_color || '#333' }}
                  >
                    {opponent.logo_url ? (
                      <img src={opponent.logo_url} alt={opponent.name} />
                    ) : (
                      opponent.name.charAt(0)
                    )}
                  </div>
                  <div className="team-info">
                    <h3>{opponent.name}</h3>
                    <span className={`league-badge ${opponent.league?.toLowerCase()}`}>
                      {opponent.league}
                    </span>
                    {opponent.is_ai && <span className="ai-badge">AI</span>}
                  </div>
                </div>
                <div className="opponent-stats">
                  <div className="stat">
                    <span className="label">스타터</span>
                    <span className="value">{opponent.starter_count}/5</span>
                  </div>
                  <div className="stat">
                    <span className="label">평균 OVR</span>
                    <span className="value">{Math.round(opponent.avg_overall || 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedOpponent && (
            <div className="match-creation">
              <div className="selected-info">
                <span>선택된 상대:</span>
                <strong>{selectedOpponent.name}</strong>
              </div>
              <button
                onClick={createMatch}
                disabled={loading}
                className="create-btn"
              >
                {loading ? '생성 중...' : '친선전 시작'}
              </button>
            </div>
          )}

          <div className="rewards-info">
            <h3>보상 안내</h3>
            <ul>
              <li>승리: 50,000골드 + 킬당 5,000골드</li>
              <li>패배: 20,000골드</li>
              <li>무승부: 35,000골드</li>
              <li>경험치: 리그전의 50%</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section">
          <h2>친선전 기록</h2>
          {history.length === 0 ? (
            <p className="empty-message">친선전 기록이 없습니다.</p>
          ) : (
            <div className="history-list">
              {history.map(match => (
                <div key={match.id} className={`history-item ${match.status.toLowerCase()}`}>
                  <div className="match-teams">
                    <span>{match.home_team_name}</span>
                    <span className="score">
                      {match.status === 'FINISHED' ? (
                        `${match.home_score} - ${match.away_score}`
                      ) : match.status === 'LIVE' ? (
                        <span className="live">LIVE</span>
                      ) : (
                        '예정'
                      )}
                    </span>
                    <span>{match.away_team_name}</span>
                  </div>
                  <div className="match-time">
                    {match.status === 'FINISHED'
                      ? formatDate(match.finished_at)
                      : formatDate(match.scheduled_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
