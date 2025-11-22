import { useEffect, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import './Matches.css';

// 날짜 포맷 헬퍼 함수
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  // MySQL datetime 형식 처리
  const normalized = dateString.replace(' ', 'T');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

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

interface MatchStat {
  id: number;
  player_id: number;
  player_name: string;
  position: string;
  team_name: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold_earned: number;
  damage_dealt: number;
  damage_taken: number;
  vision_score: number;
  wards_placed: number;
  wards_destroyed: number;
  turret_kills: number;
  first_blood: boolean;
}

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [matchStats, setMatchStats] = useState<MatchStat[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameTime, setGameTime] = useState(0);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'live' | 'finished'>('all');
  const [showStats, setShowStats] = useState(false);
  const [aggressionLevel, setAggressionLevel] = useState('NORMAL');
  const [isMyMatch, setIsMyMatch] = useState(false);

  const aggressionLabels: Record<string, string> = {
    VERY_AGGRESSIVE: '매우 공격적',
    AGGRESSIVE: '공격적',
    NORMAL: '보통',
    DEFENSIVE: '수비적',
    VERY_DEFENSIVE: '매우 수비적'
  };

  useEffect(() => {
    fetchMatches();
    // 프로덕션에서는 현재 도메인 사용, 개발에서는 localhost
    const socketUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : window.location.origin;
    const newSocket = io(socketUrl);
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
      setMatchStats(response.data.stats || []);
      setGameTime(0);
      setShowStats(response.data.match.status === 'FINISHED');

      // 내 팀 경기인지 확인 및 전술 로드
      try {
        const tacticsRes = await axios.get('/api/tactics');
        if (tacticsRes.data.teamTactics) {
          setAggressionLevel(tacticsRes.data.teamTactics.aggression_level || 'NORMAL');
          // 경기에 내 팀이 참여하는지 확인
          const myTeamId = tacticsRes.data.teamTactics.team_id;
          const match = response.data.match;
          setIsMyMatch(match.home_team_id === myTeamId || match.away_team_id === myTeamId);
        }
      } catch {
        setIsMyMatch(false);
      }
    } catch (error) {
      console.error('Failed to fetch match details:', error);
    }
  };

  const changeAggression = async (level: string) => {
    if (!selectedMatch || selectedMatch.status !== 'LIVE') return;

    try {
      await axios.post(`/api/tactics/match/${selectedMatch.id}/aggression`, {
        aggression_level: level,
        game_time: gameTime
      });
      setAggressionLevel(level);
    } catch (error) {
      console.error('Failed to change aggression:', error);
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
                    {formatDate(match.scheduled_at)}
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

            {selectedMatch.status === 'LIVE' && isMyMatch && (
              <div className="aggression-control">
                <h4>공격 성향 조절</h4>
                <div className="aggression-buttons">
                  {Object.entries(aggressionLabels).map(([value, label]) => (
                    <button
                      key={value}
                      className={`aggression-btn ${aggressionLevel === value ? 'active' : ''} ${value.toLowerCase().replace('_', '-')}`}
                      onClick={() => changeAggression(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="match-tabs">
              <button 
                className={!showStats ? 'tab-active' : ''}
                onClick={() => setShowStats(false)}
              >
                이벤트
              </button>
              <button 
                className={showStats ? 'tab-active' : ''}
                onClick={() => setShowStats(true)}
              >
                통계
              </button>
            </div>

            {!showStats ? (
              <div className="match-events">
                <h3>경기 이벤트</h3>
                <div className="events-list">
                  {matchEvents.map((event, idx) => (
                    <div key={idx} className={`event-item ${event.type.toLowerCase()}`}>
                      <span className="event-time">{formatTime(event.time)}</span>
                      <span className="event-description">
                        {event.data?.killer_name && (
                          <span className="event-killer">{event.data.killer_name}</span>
                        )}
                        {event.description}
                        {event.data?.victim_name && (
                          <span className="event-victim"> → {event.data.victim_name}</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {matchEvents.length === 0 && (
                    <p className="empty-events">이벤트가 없습니다.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="match-stats">
                <h3>경기 통계</h3>
                {matchStats.length === 0 ? (
                  <div className="empty-stats">
                    <p>경기 통계가 아직 없습니다.</p>
                  </div>
                ) : (
                  <div className="stats-table-container">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>선수</th>
                          <th>포지션</th>
                          <th>K</th>
                          <th>D</th>
                          <th>A</th>
                          <th>KDA</th>
                          <th>CS</th>
                          <th>골드</th>
                          <th>딜량</th>
                          <th>받은딜</th>
                          <th>비전</th>
                          <th>와드</th>
                          <th>타워</th>
                          <th>FB</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchStats.map((stat, index) => {
                          const kda = stat.deaths === 0 
                            ? (stat.kills + stat.assists).toFixed(1)
                            : ((stat.kills + stat.assists) / stat.deaths).toFixed(2);
                          const kdaValue = parseFloat(kda);
                          const kdaClass = kdaValue >= 3 ? 'kda-excellent' : kdaValue >= 2 ? 'kda-good' : kdaValue >= 1 ? 'kda-average' : 'kda-poor';
                          return (
                            <tr 
                              key={stat.id} 
                              className={`${stat.first_blood ? 'first-blood' : ''} stat-row-${index}`}
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                              <td className="player-name">
                                <span className="player-name-text">{stat.player_name}</span>
                                <span className="team-name-badge">{stat.team_name}</span>
                              </td>
                              <td className="position">
                                <span className={`position-badge ${stat.position}`}>{stat.position}</span>
                              </td>
                              <td className="kills">{stat.kills}</td>
                              <td className="deaths">{stat.deaths}</td>
                              <td className="assists">{stat.assists}</td>
                              <td className={`kda ${kdaClass}`}>{kda}</td>
                              <td className="cs">{stat.cs.toLocaleString()}</td>
                              <td className="gold">{stat.gold_earned.toLocaleString()}</td>
                              <td className="damage">{stat.damage_dealt.toLocaleString()}</td>
                              <td className="damage-taken">{stat.damage_taken.toLocaleString()}</td>
                              <td className="vision">{stat.vision_score}</td>
                              <td className="wards">{stat.wards_placed}/{stat.wards_destroyed}</td>
                              <td className="turrets">{stat.turret_kills}</td>
                              <td className="fb">{stat.first_blood ? '✓' : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

