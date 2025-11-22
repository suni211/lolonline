import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import './Matches.css';

interface Match {
  id: number;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  status: string;
  scheduled_at: string;
  started_at?: string;
  finished_at?: string;
  match_type: string;
}

interface MatchEvent {
  type: string;
  time: number;
  description: string;
  data: any;
}

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameTime, setGameTime] = useState(0);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'live' | 'finished'>('all');

  useEffect(() => {
    fetchMatches();
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('match_started', (data) => {
      if (selectedMatch && data.match_id === selectedMatch.id) {
        setSelectedMatch({ ...selectedMatch, status: 'LIVE' });
      }
    });

    newSocket.on('match_update', (data) => {
      if (selectedMatch && data.match_id === selectedMatch.id) {
        setGameTime(data.game_time);
        setSelectedMatch({
          ...selectedMatch,
          home_score: data.home_score,
          away_score: data.away_score
        });
      }
    });

    newSocket.on('match_event', (event) => {
      if (selectedMatch && event.match_id === selectedMatch.id) {
        setMatchEvents(prev => [...prev, event]);
      }
    });

    newSocket.on('match_finished', (data) => {
      if (selectedMatch && data.match_id === selectedMatch.id) {
        setSelectedMatch({
          ...selectedMatch,
          status: 'FINISHED',
          home_score: data.home_score,
          away_score: data.away_score
        });
        fetchMatches();
      }
    });

    return () => {
      newSocket.close();
    };
  }, [selectedMatch]);

  useEffect(() => {
    if (socket && selectedMatch) {
      socket.emit('subscribe_match', selectedMatch.id);
      return () => {
        socket.emit('unsubscribe_match', selectedMatch.id);
      };
    }
  }, [socket, selectedMatch]);

  const fetchMatches = async () => {
    try {
      const response = await axios.get('/api/matches');
      setMatches(response.data);
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    }
  };

  const watchMatch = async (matchId: number) => {
    try {
      const response = await axios.get(`/api/matches/${matchId}`);
      setSelectedMatch(response.data.match);
      setMatchEvents(response.data.events || []);
      setGameTime(0);
    } catch (error) {
      console.error('Failed to fetch match details:', error);
    }
  };

  const filteredMatches = matches.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter.toUpperCase();
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="matches-page">
      <h1 className="page-title">경기</h1>

      <div className="match-filters">
        <button
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'filter-active' : ''}
        >
          전체
        </button>
        <button
          onClick={() => setFilter('scheduled')}
          className={filter === 'scheduled' ? 'filter-active' : ''}
        >
          예정
        </button>
        <button
          onClick={() => setFilter('live')}
          className={filter === 'live' ? 'filter-active' : ''}
        >
          진행중
        </button>
        <button
          onClick={() => setFilter('finished')}
          className={filter === 'finished' ? 'filter-active' : ''}
        >
          종료
        </button>
      </div>

      <div className="matches-container">
        <div className="matches-list">
          <h2>경기 목록</h2>
          {filteredMatches.map((match) => (
            <div
              key={match.id}
              className={`match-item ${match.status.toLowerCase()} ${selectedMatch?.id === match.id ? 'selected' : ''}`}
              onClick={() => watchMatch(match.id)}
            >
              <div className="match-teams">
                <span className={match.home_score > match.away_score ? 'winner' : ''}>
                  {match.home_team_name}
                </span>
                <span className="vs">vs</span>
                <span className={match.away_score > match.home_score ? 'winner' : ''}>
                  {match.away_team_name}
                </span>
              </div>
              <div className="match-score">
                {match.status === 'FINISHED' && (
                  <span>{match.home_score} - {match.away_score}</span>
                )}
                {match.status === 'LIVE' && (
                  <span className="live-indicator">LIVE</span>
                )}
                {match.status === 'SCHEDULED' && (
                  <span className="scheduled-time">
                    {new Date(match.scheduled_at).toLocaleString('ko-KR')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {selectedMatch && (
          <div className="match-viewer">
            <h2>경기 관전</h2>
            <div className="match-header">
              <div className="team-info">
                <h3>{selectedMatch.home_team_name}</h3>
                <div className="score">{selectedMatch.home_score}</div>
              </div>
              <div className="vs-divider">VS</div>
              <div className="team-info">
                <h3>{selectedMatch.away_team_name}</h3>
                <div className="score">{selectedMatch.away_score}</div>
              </div>
            </div>

            {selectedMatch.status === 'LIVE' && (
              <div className="game-time">
                경기 시간: {formatTime(gameTime)}
              </div>
            )}

            <div className="match-events">
              <h3>경기 이벤트</h3>
              <div className="events-list">
                {matchEvents.map((event, idx) => (
                  <div key={idx} className={`event-item ${event.type.toLowerCase()}`}>
                    <span className="event-time">{formatTime(event.time)}</span>
                    <span className="event-description">{event.description}</span>
                  </div>
                ))}
                {matchEvents.length === 0 && (
                  <p className="empty-events">이벤트가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

