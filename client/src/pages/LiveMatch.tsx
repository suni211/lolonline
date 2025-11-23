import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import './LiveMatch.css';

interface TurretState {
  top: { t1: boolean; t2: boolean; t3: boolean; inhib: boolean };
  mid: { t1: boolean; t2: boolean; t3: boolean; inhib: boolean };
  bot: { t1: boolean; t2: boolean; t3: boolean; inhib: boolean };
  nexus: { twin1: boolean; twin2: boolean; nexus: boolean };
}

interface TeamState {
  kills: number;
  gold: number;
  dragons: string[];
  barons: number;
  heralds: number;
  turrets: TurretState;
}

interface MatchEvent {
  type: string;
  time: number;
  description: string;
  data: any;
}

interface PlayerStats {
  id: number;
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
}

interface MatchData {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  status: string;
  match_type: string;
}

export default function LiveMatch() {
  const { matchId } = useParams<{ matchId: string }>();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [match, setMatch] = useState<MatchData | null>(null);
  const [gameTime, setGameTime] = useState(0);
  const [homeState, setHomeState] = useState<TeamState | null>(null);
  const [awayState, setAwayState] = useState<TeamState | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const eventLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMatchData();

    // Socket.io 연결
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [matchId]);

  useEffect(() => {
    if (!socket || !matchId) return;

    // 경기 룸 참가
    socket.emit('join_match', matchId);

    // 실시간 업데이트 수신
    socket.on('match_update', (data) => {
      setGameTime(data.game_time);
      setHomeState(data.home);
      setAwayState(data.away);
      setIsLive(true);
    });

    // 이벤트 수신
    socket.on('match_event', (event) => {
      setEvents(prev => [...prev.slice(-50), event]); // 최근 50개만 유지
    });

    // 경기 종료
    socket.on('match_finished', (data) => {
      setIsLive(false);
      fetchMatchData(); // 최종 데이터 갱신
    });

    // 경기 시작
    socket.on('match_started', (data) => {
      setIsLive(true);
      setEvents([]);
    });

    return () => {
      socket.emit('leave_match', matchId);
      socket.off('match_update');
      socket.off('match_event');
      socket.off('match_finished');
      socket.off('match_started');
    };
  }, [socket, matchId]);

  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events]);

  // 주기적으로 선수 통계 갱신
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      fetchPlayerStats();
    }, 3000);

    return () => clearInterval(interval);
  }, [isLive, matchId]);

  const fetchMatchData = async () => {
    try {
      const res = await axios.get(`/api/matches/${matchId}`);
      setMatch(res.data.match);
      setEvents(res.data.events || []);
      setPlayerStats(res.data.stats || []);

      // match_data 파싱
      if (res.data.match.match_data) {
        const matchData = typeof res.data.match.match_data === 'string'
          ? JSON.parse(res.data.match.match_data)
          : res.data.match.match_data;

        setGameTime(matchData.game_time || 0);
        setHomeState(matchData.home || null);
        setAwayState(matchData.away || null);
      }

      setIsLive(res.data.match.status === 'LIVE');
    } catch (error) {
      console.error('Failed to fetch match:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayerStats = async () => {
    try {
      const res = await axios.get(`/api/matches/${matchId}`);
      setPlayerStats(res.data.stats || []);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatGold = (gold: number) => {
    if (gold >= 1000) {
      return `${(gold / 1000).toFixed(1)}k`;
    }
    return gold.toString();
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'KILL': return '⚔️';
      case 'DRAGON': return '🐉';
      case 'BARON': return '👿';
      case 'HERALD': return '👁️';
      case 'TURRET': return '🗼';
      case 'INHIBITOR': return '💎';
      case 'NEXUS_TURRET': return '🏰';
      case 'NEXUS_DESTROYED': return '🏆';
      case 'TEAMFIGHT': return '⚡';
      case 'GANK': return '🎯';
      default: return '📢';
    }
  };

  const renderTurrets = (turrets: TurretState, team: 'home' | 'away') => {
    const lanes = ['top', 'mid', 'bot'] as const;
    return (
      <div className={`turrets-display ${team}`}>
        {lanes.map(lane => (
          <div key={lane} className="lane-turrets">
            <span className="lane-name">{lane.toUpperCase()}</span>
            <div className="turret-icons">
              <span className={`turret ${turrets[lane].t1 ? 'alive' : 'dead'}`}>T1</span>
              <span className={`turret ${turrets[lane].t2 ? 'alive' : 'dead'}`}>T2</span>
              <span className={`turret ${turrets[lane].t3 ? 'alive' : 'dead'}`}>T3</span>
              <span className={`inhib ${turrets[lane].inhib ? 'alive' : 'dead'}`}>억</span>
            </div>
          </div>
        ))}
        <div className="nexus-turrets">
          <span className="lane-name">NEXUS</span>
          <div className="turret-icons">
            <span className={`turret ${turrets.nexus.twin1 ? 'alive' : 'dead'}`}>쌍1</span>
            <span className={`turret ${turrets.nexus.twin2 ? 'alive' : 'dead'}`}>쌍2</span>
            <span className={`nexus ${turrets.nexus.nexus ? 'alive' : 'dead'}`}>넥</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="live-match loading">로딩 중...</div>;
  }

  if (!match) {
    return <div className="live-match error">경기를 찾을 수 없습니다.</div>;
  }

  const homeStats = playerStats.filter(p => p.team_name === match.home_team_name);
  const awayStats = playerStats.filter(p => p.team_name === match.away_team_name);

  return (
    <div className="live-match">
      {/* 상단 스코어보드 */}
      <div className="scoreboard">
        <div className="team home-team">
          {match.home_team_logo && (
            <img src={match.home_team_logo} alt="" className="team-logo" />
          )}
          <div className="team-name">{match.home_team_name}</div>
          <div className="team-score">{homeState?.kills || 0}</div>
        </div>

        <div className="match-info">
          <div className={`status ${isLive ? 'live' : ''}`}>
            {isLive ? 'LIVE' : match.status}
          </div>
          <div className="game-time">{formatTime(gameTime)}</div>
          <div className="gold-diff">
            {homeState && awayState && (
              <span className={homeState.gold > awayState.gold ? 'home-lead' : 'away-lead'}>
                {formatGold(Math.abs(homeState.gold - awayState.gold))} 골드 차
              </span>
            )}
          </div>
        </div>

        <div className="team away-team">
          <div className="team-score">{awayState?.kills || 0}</div>
          <div className="team-name">{match.away_team_name}</div>
          {match.away_team_logo && (
            <img src={match.away_team_logo} alt="" className="team-logo" />
          )}
        </div>
      </div>

      {/* 오브젝트 현황 */}
      {homeState && awayState && (
        <div className="objectives-bar">
          <div className="team-objectives home">
            <span className="obj dragons">🐉 {homeState.dragons.length}</span>
            <span className="obj barons">👿 {homeState.barons}</span>
            <span className="obj heralds">👁️ {homeState.heralds}</span>
            <span className="obj gold">💰 {formatGold(homeState.gold)}</span>
          </div>
          <div className="team-objectives away">
            <span className="obj gold">💰 {formatGold(awayState.gold)}</span>
            <span className="obj heralds">👁️ {awayState.heralds}</span>
            <span className="obj barons">👿 {awayState.barons}</span>
            <span className="obj dragons">🐉 {awayState.dragons.length}</span>
          </div>
        </div>
      )}

      <div className="main-content">
        {/* 왼쪽: 홈팀 선수 통계 */}
        <div className="team-stats home">
          <h3>{match.home_team_name}</h3>
          {homeStats.map(player => (
            <div key={player.id} className="player-stat-row">
              <div className="player-info">
                <span className="position">{player.position}</span>
                <span className="name">{player.player_name}</span>
              </div>
              <div className="kda">
                {player.kills}/{player.deaths}/{player.assists}
              </div>
              <div className="cs">{player.cs} CS</div>
              <div className="damage">{(player.damage_dealt / 1000).toFixed(1)}k</div>
            </div>
          ))}
          {homeState && renderTurrets(homeState.turrets, 'home')}
        </div>

        {/* 중앙: 이벤트 로그 */}
        <div className="event-log" ref={eventLogRef}>
          <h3>경기 진행</h3>
          <div className="events-list">
            {events.length === 0 ? (
              <div className="no-events">
                {isLive ? '경기 시작 대기 중...' : '이벤트가 없습니다'}
              </div>
            ) : (
              events.map((event, idx) => (
                <div key={idx} className={`event ${event.data?.team || 'neutral'}`}>
                  <span className="event-icon">{getEventIcon(event.type)}</span>
                  <span className="event-time">[{formatTime(event.time)}]</span>
                  <span className="event-desc">{event.description}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 오른쪽: 어웨이팀 선수 통계 */}
        <div className="team-stats away">
          <h3>{match.away_team_name}</h3>
          {awayStats.map(player => (
            <div key={player.id} className="player-stat-row">
              <div className="player-info">
                <span className="position">{player.position}</span>
                <span className="name">{player.player_name}</span>
              </div>
              <div className="kda">
                {player.kills}/{player.deaths}/{player.assists}
              </div>
              <div className="cs">{player.cs} CS</div>
              <div className="damage">{(player.damage_dealt / 1000).toFixed(1)}k</div>
            </div>
          ))}
          {awayState && renderTurrets(awayState.turrets, 'away')}
        </div>
      </div>

      {/* 드래곤 현황 */}
      {homeState && awayState && (homeState.dragons.length > 0 || awayState.dragons.length > 0) && (
        <div className="dragons-display">
          <div className="dragons home-dragons">
            {homeState.dragons.map((dragon, idx) => (
              <span key={idx} className="dragon-icon" title={dragon}>🐉</span>
            ))}
          </div>
          <div className="dragons away-dragons">
            {awayState.dragons.map((dragon, idx) => (
              <span key={idx} className="dragon-icon" title={dragon}>🐉</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
