import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Cup.css';

interface CupMatch {
  id: number;
  round: string;
  match_number: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  winner_team_id: number | null;
  winner_name: string | null;
  scheduled_at: string;
  status: string;
}

interface CupTournament {
  id: number;
  name: string;
  season: number;
  status: string;
  prize_pool: number;
  winner_team_id: number | null;
  winner_name: string | null;
  matches: CupMatch[];
}

const Cup: React.FC = () => {
  const { token } = useAuth();
  const [cup, setCup] = useState<CupTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRound, setSelectedRound] = useState<string>('all');

  useEffect(() => {
    fetchCup();
  }, [token]);

  const fetchCup = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cup/current?season=1', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCup(data);
      } else {
        setError('컵 대회 정보를 불러올 수 없습니다');
      }
    } catch (err) {
      setError('서버 연결 오류');
    } finally {
      setLoading(false);
    }
  };

  const getRoundName = (round: string) => {
    switch (round) {
      case 'ROUND_32': return '32강';
      case 'ROUND_16': return '16강';
      case 'QUARTER': return '8강';
      case 'SEMI': return '4강';
      case 'FINAL': return '결승';
      default: return round;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return <span className="status-badge scheduled">예정</span>;
      case 'IN_PROGRESS': return <span className="status-badge in-progress">진행중</span>;
      case 'COMPLETED': return <span className="status-badge completed">종료</span>;
      default: return null;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}월 ${day}일 ${hours}:${minutes}`;
  };

  const filteredMatches = cup?.matches.filter(match =>
    selectedRound === 'all' || match.round === selectedRound
  ) || [];

  const rounds = ['ROUND_32', 'ROUND_16', 'QUARTER', 'SEMI', 'FINAL'];

  if (loading) {
    return <div className="cup-page"><div className="loading">로딩 중...</div></div>;
  }

  if (error) {
    return <div className="cup-page"><div className="error">{error}</div></div>;
  }

  if (!cup) {
    return (
      <div className="cup-page">
        <h1>LPO 컵 대회</h1>
        <div className="no-cup">현재 진행 중인 컵 대회가 없습니다</div>
      </div>
    );
  }

  return (
    <div className="cup-page">
      <div className="cup-header">
        <h1>{cup.name}</h1>
        <div className="cup-info">
          <span className="prize">우승 상금: {(cup.prize_pool / 100000000).toFixed(1)}억</span>
          <span className="status">{getRoundName(cup.status)}</span>
        </div>
        {cup.winner_name && (
          <div className="cup-winner">
            우승: <strong>{cup.winner_name}</strong>
          </div>
        )}
      </div>

      <div className="round-filter">
        <button
          className={selectedRound === 'all' ? 'active' : ''}
          onClick={() => setSelectedRound('all')}
        >
          전체
        </button>
        {rounds.map(round => (
          <button
            key={round}
            className={selectedRound === round ? 'active' : ''}
            onClick={() => setSelectedRound(round)}
          >
            {getRoundName(round)}
          </button>
        ))}
      </div>

      <div className="matches-container">
        {rounds.map(round => {
          const roundMatches = filteredMatches.filter(m => m.round === round);
          if (roundMatches.length === 0) return null;

          return (
            <div key={round} className="round-section">
              <h2>{getRoundName(round)}</h2>
              <div className="matches-grid">
                {roundMatches.map(match => (
                  <div key={match.id} className={`match-card ${match.status.toLowerCase()}`}>
                    <div className="match-time">{formatDate(match.scheduled_at)}</div>
                    <div className="match-teams">
                      <div className={`team home ${match.winner_team_id === match.home_team_id ? 'winner' : ''}`}>
                        <span className="team-name">{match.home_team_name}</span>
                        <span className="score">{match.home_score}</span>
                      </div>
                      <div className="vs">VS</div>
                      <div className={`team away ${match.winner_team_id === match.away_team_id ? 'winner' : ''}`}>
                        <span className="score">{match.away_score}</span>
                        <span className="team-name">{match.away_team_name}</span>
                      </div>
                    </div>
                    {getStatusBadge(match.status)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Cup;
