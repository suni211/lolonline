import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import './LiveMatch.css';
import SummonersRiftMap, {
  ChampionPosition,
  ObjectiveState,
  Highlight,
  SPAWN_POSITIONS
} from '../components/SummonersRiftMap';

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
  vision_score: number;
  wards_placed: number;
  wards_destroyed: number;
  turret_kills: number;
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

  // 세트 정보
  const [currentSet, setCurrentSet] = useState(1);
  const [homeSetWins, setHomeSetWins] = useState(0);
  const [awaySetWins, setAwaySetWins] = useState(0);

  // 맵 관련 상태
  const [champions, setChampions] = useState<ChampionPosition[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveState>({
    dragon: { alive: false, type: 'INFERNAL' },
    baron: { alive: false },
    herald: { alive: false, taken: false },
    voidgrub: { alive: false, count: 6 },
    atakhan: { alive: false }
  });
  const [currentHighlight, setCurrentHighlight] = useState<Highlight | null>(null);
  const [showMap, setShowMap] = useState(false); // 하이라이트 때만 맵 표시

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

      // 오브젝트 상태 업데이트
      setObjectives(prev => ({
        ...prev,
        dragon: { ...prev.dragon, alive: data.dragon_alive },
        baron: { ...prev.baron, alive: data.baron_alive },
        herald: { ...prev.herald, alive: data.herald_alive }
      }));
    });

    // 이벤트 수신
    socket.on('match_event', (event) => {
      setEvents(prev => [...prev.slice(-50), event]); // 최근 50개만 유지
      detectHighlight(event);
    });

    // 경기 종료
    socket.on('match_finished', () => {
      setIsLive(false);
      fetchMatchData(); // 최종 데이터 갱신
    });

    // 경기 시작
    socket.on('match_started', () => {
      setIsLive(true);
      setEvents([]);
    });

    // 세트 종료
    socket.on('set_finished', (data) => {
      setHomeSetWins(data.home_set_wins);
      setAwaySetWins(data.away_set_wins);
      // 세트 종료 이벤트 추가
      setEvents(prev => [...prev, {
        type: 'SET_END',
        time: gameTime,
        description: `세트 ${data.set_number} 종료 - ${data.set_winner === 'home' ? '홈팀' : '어웨이팀'} 승리`,
        data: { team: data.set_winner }
      }]);
    });

    // 새 세트 시작
    socket.on('set_started', (data) => {
      setCurrentSet(data.set_number);
      setHomeSetWins(data.home_set_wins);
      setAwaySetWins(data.away_set_wins);
      setGameTime(0);
      setEvents(prev => [...prev, {
        type: 'SET_START',
        time: 0,
        description: `세트 ${data.set_number} 시작`,
        data: { team: 'neutral' }
      }]);
    });

    return () => {
      socket.emit('leave_match', matchId);
      socket.off('match_update');
      socket.off('match_event');
      socket.off('match_finished');
      socket.off('match_started');
      socket.off('set_finished');
      socket.off('set_started');
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

        // 세트 정보
        setCurrentSet(matchData.current_set || 1);
        setHomeSetWins(matchData.home_set_wins || 0);
        setAwaySetWins(matchData.away_set_wins || 0);
      }

      setIsLive(res.data.match.status === 'LIVE');

      // 챔피언 위치 초기화
      if (res.data.stats && res.data.stats.length > 0) {
        initializeChampionPositions(
          res.data.stats,
          res.data.match.home_team_name
        );
      }
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

  // 챔피언 위치 초기화
  const initializeChampionPositions = (stats: PlayerStats[], homeName: string) => {
    const positions: ChampionPosition[] = stats.map(player => {
      const isHome = player.team_name === homeName;
      const team = isHome ? 'blue' : 'red';
      const pos = player.position as keyof typeof SPAWN_POSITIONS.blue;
      const spawnPos = SPAWN_POSITIONS[team][pos] || { x: 50, y: 50 };

      return {
        playerId: player.id,
        playerName: player.player_name,
        position: player.position,
        team,
        x: spawnPos.x,
        y: spawnPos.y,
        isAlive: true
      };
    });
    setChampions(positions);
  };

  // 이벤트에서 하이라이트 감지
  const detectHighlight = (event: MatchEvent) => {
    let highlight: Highlight | null = null;
    let duration = 3000; // 기본 3초

    switch (event.type) {
      case 'KILL':
        // 킬 하이라이트
        highlight = {
          type: 'kill',
          x: 50,
          y: 50,
          description: `${event.data?.killer} → ${event.data?.victim}`
        };
        duration = 3000;
        break;

      case 'TEAMFIGHT':
        // 한타 - 끝날 때까지 표시
        highlight = {
          type: 'teamfight',
          x: 50,
          y: 50,
          description: 'TEAM FIGHT!'
        };
        duration = 10000; // 한타는 길게
        break;

      case 'DRAGON':
        highlight = {
          type: 'objective',
          x: 64.9,
          y: 68,
          description: `${event.data?.team === 'home' ? '블루' : '레드'} 드래곤`
        };
        setObjectives(prev => ({ ...prev, dragon: { alive: false } }));
        duration = 4000;
        break;

      case 'BARON':
        highlight = {
          type: 'objective',
          x: 36.6,
          y: 30.2,
          description: `${event.data?.team === 'home' ? '블루' : '레드'} 바론`
        };
        setObjectives(prev => ({ ...prev, baron: { alive: false } }));
        duration = 5000;
        break;

      case 'HERALD':
        highlight = {
          type: 'objective',
          x: 36.6,
          y: 30.2,
          description: `${event.data?.team === 'home' ? '블루' : '레드'} 전령`
        };
        setObjectives(prev => ({ ...prev, herald: { alive: false, taken: true } }));
        duration = 4000;
        break;

      case 'NEXUS_DESTROYED':
        // 게임 종료
        highlight = {
          type: 'ace',
          x: event.data?.team === 'away' ? 13.9 : 85.2,
          y: event.data?.team === 'away' ? 85.7 : 13.7,
          description: 'VICTORY!'
        };
        duration = 10000;
        break;
    }

    if (highlight) {
      setCurrentHighlight(highlight);
      setShowMap(true);
      setTimeout(() => {
        setCurrentHighlight(null);
        setShowMap(false);
      }, duration);
    }
  };

  const getNextDragonType = () => {
    const types = ['INFERNAL', 'OCEAN', 'CLOUD', 'MOUNTAIN', 'HEXTECH', 'CHEMTECH'];
    return types[Math.floor(Math.random() * types.length)];
  };

  // 포지션별 주요 활동 영역 정의
  const getLaneArea = (position: string, team: 'blue' | 'red') => {
    const areas = {
      blue: {
        TOP: { centerX: 14, centerY: 45, rangeX: 8, rangeY: 25 }, // 탑 라인
        JGL: { centerX: 35, centerY: 55, rangeX: 20, rangeY: 25 }, // 정글
        MID: { centerX: 40, centerY: 60, rangeX: 15, rangeY: 15 }, // 미드
        ADC: { centerX: 55, centerY: 88, rangeX: 20, rangeY: 8 }, // 봇 라인
        SUP: { centerX: 50, centerY: 85, rangeX: 20, rangeY: 10 }  // 서포터
      },
      red: {
        TOP: { centerX: 45, centerY: 12, rangeX: 25, rangeY: 8 },
        JGL: { centerX: 65, centerY: 45, rangeX: 20, rangeY: 25 },
        MID: { centerX: 60, centerY: 40, rangeX: 15, rangeY: 15 },
        ADC: { centerX: 88, centerY: 55, rangeX: 8, rangeY: 20 },
        SUP: { centerX: 85, centerY: 50, rangeX: 10, rangeY: 20 }
      }
    };
    return areas[team][position as keyof typeof areas.blue] || { centerX: 50, centerY: 50, rangeX: 30, rangeY: 30 };
  };

  // 챔피언 위치 업데이트 (포지션별 현실적 이동)
  useEffect(() => {
    if (!isLive || champions.length === 0) return;

    const interval = setInterval(() => {
      setChampions(prev => prev.map(champ => {
        if (!champ.isAlive) return champ;

        const area = getLaneArea(champ.position, champ.team);

        // 자신의 라인 영역 내에서 이동
        let targetX = area.centerX + (Math.random() - 0.5) * area.rangeX * 2;
        let targetY = area.centerY + (Math.random() - 0.5) * area.rangeY * 2;

        // 부드러운 이동 (현재 위치에서 목표 방향으로 조금씩)
        const moveSpeed = 2;
        const dx = (targetX - champ.x) * 0.1 + (Math.random() - 0.5) * moveSpeed;
        const dy = (targetY - champ.y) * 0.1 + (Math.random() - 0.5) * moveSpeed;

        return {
          ...champ,
          x: Math.max(5, Math.min(95, champ.x + dx)),
          y: Math.max(5, Math.min(95, champ.y + dy))
        };
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive, champions.length]);

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

  if (loading) {
    return <div className="live-match loading">로딩 중...</div>;
  }

  if (!match) {
    return <div className="live-match error">경기를 찾을 수 없습니다.</div>;
  }

  const homeStats = playerStats.filter(p => p.team_name && p.team_name === match.home_team_name);
  const awayStats = playerStats.filter(p => p.team_name && p.team_name === match.away_team_name);

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
          <div className="set-score">
            <span className="set-wins home-wins">{homeSetWins}</span>
            <span className="set-divider">-</span>
            <span className="set-wins away-wins">{awaySetWins}</span>
          </div>
          <div className="current-set">세트 {currentSet}</div>
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

      <div className="main-content with-map">
        {/* 왼쪽: 홈팀 선수 통계 */}
        <div className="team-stats home">
          <h3>{match.home_team_name}</h3>
          {homeStats.map(player => (
            <div key={player.id} className="player-stat-row">
              <div className="player-info">
                <span className="position">{player.position}</span>
                <span className="name">{player.player_name}</span>
              </div>
              <div className="player-details">
                <div className="stat-line">
                  <span className="kda">{player.kills}/{player.deaths}/{player.assists}</span>
                  <span className="cs">{player.cs} CS</span>
                </div>
                <div className="stat-line">
                  <span className="gold">{(player.gold_earned / 1000).toFixed(1)}k</span>
                  <span className="damage">{(player.damage_dealt / 1000).toFixed(1)}k</span>
                </div>
                <div className="stat-line">
                  <span className="vision">VS {player.vision_score || 0}</span>
                  <span className="wards">{player.wards_placed || 0}/{player.wards_destroyed || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 중앙: 맵 (하이라이트 때만 표시) */}
        {showMap ? (
          <div className="map-container highlight-active">
            <SummonersRiftMap
              champions={champions}
              objectives={objectives}
              blueTurrets={homeState?.turrets || {
                top: { t1: true, t2: true, t3: true, inhib: true },
                mid: { t1: true, t2: true, t3: true, inhib: true },
                bot: { t1: true, t2: true, t3: true, inhib: true },
                nexus: { twin1: true, twin2: true, nexus: true }
              }}
              redTurrets={awayState?.turrets || {
                top: { t1: true, t2: true, t3: true, inhib: true },
                mid: { t1: true, t2: true, t3: true, inhib: true },
                bot: { t1: true, t2: true, t3: true, inhib: true },
                nexus: { twin1: true, twin2: true, nexus: true }
              }}
              currentHighlight={currentHighlight}
              gameTime={gameTime}
            />
          </div>
        ) : (
          <div className="map-placeholder">
            <div className="placeholder-text">하이라이트 대기중...</div>
            <div className="game-progress">
              <span className="time">{formatTime(gameTime)}</span>
              <span className="kills">{homeState?.kills || 0} - {awayState?.kills || 0}</span>
            </div>
          </div>
        )}

        {/* 오른쪽: 어웨이팀 선수 통계 */}
        <div className="team-stats away">
          <h3>{match.away_team_name}</h3>
          {awayStats.map(player => (
            <div key={player.id} className="player-stat-row">
              <div className="player-info">
                <span className="position">{player.position}</span>
                <span className="name">{player.player_name}</span>
              </div>
              <div className="player-details">
                <div className="stat-line">
                  <span className="kda">{player.kills}/{player.deaths}/{player.assists}</span>
                  <span className="cs">{player.cs} CS</span>
                </div>
                <div className="stat-line">
                  <span className="gold">{(player.gold_earned / 1000).toFixed(1)}k</span>
                  <span className="damage">{(player.damage_dealt / 1000).toFixed(1)}k</span>
                </div>
                <div className="stat-line">
                  <span className="vision">VS {player.vision_score || 0}</span>
                  <span className="wards">{player.wards_placed || 0}/{player.wards_destroyed || 0}</span>
                </div>
              </div>
            </div>
          ))}
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
