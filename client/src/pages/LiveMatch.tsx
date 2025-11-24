import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
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

interface ChatMessage {
  type: 'user' | 'system';
  username: string;
  message: string;
  timestamp: number;
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
  const { user, team } = useAuth();
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

  // 채팅 관련 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [viewers, setViewers] = useState<string[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);

  // 세트 정보
  const [currentSet, setCurrentSet] = useState(1);
  const [homeSetWins, setHomeSetWins] = useState(0);
  const [awaySetWins, setAwaySetWins] = useState(0);

  // 경기 종료 후 집계
  const [showSummary, setShowSummary] = useState(false);
  const [isMyMatch, setIsMyMatch] = useState(false);

  // 맵 관련 상태
  const [champions, setChampions] = useState<ChampionPosition[]>([]);
  const [deadPlayerIds, setDeadPlayerIds] = useState<number[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveState>({
    dragon: { alive: false, type: 'INFERNAL' },
    baron: { alive: false },
    herald: { alive: false, taken: false },
    voidgrub: { alive: false, count: 6 },
    atakhan: { alive: false }
  });
  const [currentHighlight, setCurrentHighlight] = useState<Highlight | null>(null);

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

    // 경기 룸 참가 (채팅용)
    const username = team?.name || user?.username || `Guest_${socket.id?.slice(0, 4)}`;
    socket.emit('join_match', { matchId: parseInt(matchId), username });

    // 채팅 메시지 수신
    socket.on('chat_message', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-100), msg]);
    });

    // 접속자 목록 수신
    socket.on('viewers_update', (viewerList: string[]) => {
      setViewers(viewerList);
    });

    // 실시간 업데이트 수신
    socket.on('match_update', (data) => {
      setGameTime(data.game_time);
      setHomeState(data.home);
      setAwayState(data.away);
      setIsLive(true);

      // 선수 통계 실시간 업데이트
      if (data.player_stats && data.player_stats.length > 0) {
        setPlayerStats(data.player_stats);
      }

      // 오브젝트 상태 업데이트
      setObjectives(prev => ({
        ...prev,
        dragon: { ...prev.dragon, alive: data.dragon_alive },
        baron: { ...prev.baron, alive: data.baron_alive },
        herald: { ...prev.herald, alive: data.herald_alive }
      }));

      // 죽은 선수 ID 업데이트 - 즉시 반영
      if (data.dead_players) {
        const deadIds = data.dead_players.map((dp: any) => dp.playerId);
        setDeadPlayerIds(deadIds);
        // 챔피언 상태도 즉시 업데이트
        setChampions(prev => prev.map(champ => ({
          ...champ,
          isAlive: !deadIds.includes(champ.playerId)
        })));
      } else {
        // 죽은 선수가 없으면 모두 살아있음
        setDeadPlayerIds([]);
        setChampions(prev => prev.map(champ => ({
          ...champ,
          isAlive: true
        })));
      }
    });

    // 이벤트 수신
    socket.on('match_event', (event) => {
      setEvents(prev => [...prev.slice(-50), event]); // 최근 50개만 유지
      detectHighlight(event);
    });

    // 경기 종료
    socket.on('match_finished', (data) => {
      setIsLive(false);
      setHomeSetWins(data.home_score || 0);
      setAwaySetWins(data.away_score || 0);
      fetchMatchData(); // 최종 데이터 갱신
      // 내 경기라면 집계 표시
      if (isMyMatch) {
        setShowSummary(true);
      }
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
      // 킬/원 초기화
      setHomeState(prev => prev ? {
        ...prev,
        kills: 0,
        gold: 2500,
        dragons: [],
        barons: 0,
        heralds: 0
      } : null);
      setAwayState(prev => prev ? {
        ...prev,
        kills: 0,
        gold: 2500,
        dragons: [],
        barons: 0,
        heralds: 0
      } : null);
      // 선수 스탯 초기화
      setPlayerStats(prev => prev.map(p => ({
        ...p,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        gold_earned: 0,
        damage_dealt: 0,
        damage_taken: 0,
        vision_score: 0,
        wards_placed: 0,
        wards_destroyed: 0,
        turret_kills: 0
      })));
      setEvents(prev => [...prev, {
        type: 'SET_START',
        time: 0,
        description: `세트 ${data.set_number} 시작`,
        data: { team: 'neutral' }
      }]);
    });

    return () => {
      socket.emit('leave_match', parseInt(matchId));
      socket.off('match_update');
      socket.off('match_event');
      socket.off('match_finished');
      socket.off('match_started');
      socket.off('set_finished');
      socket.off('set_started');
      socket.off('chat_message');
      socket.off('viewers_update');
    };
  }, [socket, matchId, user, team]);

  // 채팅창 자동 스크롤
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // 채팅 전송
  const sendChat = () => {
    if (!socket || !matchId || !chatInput.trim()) return;
    socket.emit('send_chat', { matchId: parseInt(matchId), message: chatInput.trim() });
    setChatInput('');
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

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

      // 내 경기인지 확인
      if (team) {
        const myTeamId = team.id;
        const isMyGame = res.data.match.home_team_id === myTeamId ||
                         res.data.match.away_team_id === myTeamId;
        setIsMyMatch(isMyGame);
      }

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

  // 선수들을 특정 위치로 이동
  const moveChampionsToPosition = (x: number, y: number, team?: 'home' | 'away' | 'all') => {
    setChampions(prev => prev.map(champ => {
      if (team && team !== 'all') {
        const isTargetTeam = (team === 'home' && champ.team === 'blue') ||
                             (team === 'away' && champ.team === 'red');
        if (!isTargetTeam) return champ;
      }
      // 약간의 랜덤 오프셋으로 자연스럽게
      const offsetX = (Math.random() - 0.5) * 8;
      const offsetY = (Math.random() - 0.5) * 8;
      return {
        ...champ,
        x: Math.max(5, Math.min(95, x + offsetX)),
        y: Math.max(5, Math.min(95, y + offsetY))
      };
    }));
  };

  // 양팀이 대치하는 형태로 이동 (한타용) - 죽은 챔피언은 스폰 위치
  const moveChampionsToFight = (centerX: number, centerY: number) => {
    setChampions(prev => prev.map(champ => {
      // 죽은 챔피언은 스폰 위치에 있음
      if (!champ.isAlive) {
        const spawnPos = SPAWN_POSITIONS[champ.team][champ.position as keyof typeof SPAWN_POSITIONS.blue];
        return {
          ...champ,
          x: spawnPos?.x || (champ.team === 'blue' ? 8.1 : 92),
          y: spawnPos?.y || (champ.team === 'blue' ? 92.7 : 7.7)
        };
      }
      // 블루팀은 중심 기준 좌하단, 레드팀은 우상단
      const teamOffsetX = champ.team === 'blue' ? -6 : 6;
      const teamOffsetY = champ.team === 'blue' ? 4 : -4;
      const randomX = (Math.random() - 0.5) * 6;
      const randomY = (Math.random() - 0.5) * 6;
      return {
        ...champ,
        x: Math.max(5, Math.min(95, centerX + teamOffsetX + randomX)),
        y: Math.max(5, Math.min(95, centerY + teamOffsetY + randomY))
      };
    }));
  };

  // 이벤트에서 하이라이트 감지
  const detectHighlight = (event: MatchEvent) => {
    let highlight: Highlight | null = null;
    let duration = 5000; // 기본 5초로 단축

    switch (event.type) {
      case 'KILL':
        // 킬: 먼저 양팀이 붙어서 싸우는 모습을 보여줌
        const killX = 30 + Math.random() * 40;
        const killY = 30 + Math.random() * 40;
        moveChampionsToFight(killX, killY);

        highlight = {
          type: 'kill',
          x: killX,
          y: killY,
          description: `${event.data?.killer_name || event.data?.killer || '???'} → ${event.data?.victim_name || event.data?.victim || '???'}`
        };
        // 킬 발생 시 즉시 죽은 선수 처리
        if (event.data?.victim_id) {
          // 즉시 죽은 선수 목록에 추가
          setDeadPlayerIds(prev => [...prev, event.data.victim_id]);
          setChampions(prev => prev.map(champ =>
            champ.playerId === event.data.victim_id
              ? { ...champ, isAlive: false }
              : champ
          ));
        }
        duration = 5000;
        break;

      case 'TEAMFIGHT':
        // 한타: 양팀이 대치하는 형태로 (랜덤 위치)
        const teamfightX = 35 + Math.random() * 30;
        const teamfightY = 35 + Math.random() * 30;
        moveChampionsToFight(teamfightX, teamfightY);
        highlight = {
          type: 'teamfight',
          x: teamfightX,
          y: teamfightY,
          description: 'TEAM FIGHT!'
        };

        // 서버에서 전달받은 희생자 이름 사용
        const loserVictimNames: string[] = event.data?.loser_victims || [];
        const winnerVictimNames: string[] = event.data?.winner_victims || [];
        const winningTeam = event.data?.team === 'home' ? 'blue' : 'red';
        const losingTeam = winningTeam === 'blue' ? 'red' : 'blue';

        // 희생자 ID 찾기
        const victimIds: number[] = [];

        // 지는 팀 희생자
        loserVictimNames.forEach(name => {
          const victim = champions.find(c => c.playerName === name && c.team === losingTeam);
          if (victim) victimIds.push(victim.playerId);
        });

        // 이기는 팀 희생자
        winnerVictimNames.forEach(name => {
          const victim = champions.find(c => c.playerName === name && c.team === winningTeam);
          if (victim) victimIds.push(victim.playerId);
        });

        // 킬 로그 추가 (누가 죽었는지 명확히)
        if (loserVictimNames.length > 0) {
          setEvents(prev => [...prev.slice(-50), {
            type: 'KILL',
            time: gameTime,
            description: `${losingTeam === 'blue' ? '블루' : '레드'}팀 ${loserVictimNames.join(', ')} 처치!`,
            data: { victims: loserVictimNames }
          }]);
        }
        if (winnerVictimNames.length > 0) {
          setEvents(prev => [...prev.slice(-50), {
            type: 'KILL',
            time: gameTime,
            description: `${winningTeam === 'blue' ? '블루' : '레드'}팀 ${winnerVictimNames.join(', ')} 처치!`,
            data: { victims: winnerVictimNames }
          }]);
        }

        // 모든 희생자 즉시 죽음 처리
        setChampions(prev => prev.map(champ =>
          victimIds.includes(champ.playerId)
            ? { ...champ, isAlive: false }
            : champ
        ));

        // 부활 처리 - 리스폰 시간 동안 불리함 반영
        const tfGameMinutes = gameTime / 60;
        const tfEstimatedLevel = Math.min(18, Math.floor(1 + tfGameMinutes * 0.6));
        const tfRespawnTime = 6 + (tfEstimatedLevel - 1) * (54 / 17);

        // 한타는 7초 정도 하이라이트
        duration = 7000;

        setTimeout(() => {
          setChampions(prev => prev.map(champ =>
            victimIds.includes(champ.playerId)
              ? { ...champ, isAlive: true }
              : champ
          ));
        }, tfRespawnTime * 1000);
        break;

      case 'DRAGON':
        // 드래곤: 양팀 모두 드래곤 위치에서 한타
        moveChampionsToFight(64.9, 68);
        highlight = {
          type: 'objective',
          x: 64.9,
          y: 68,
          description: `${event.data?.team === 'home' ? '블루' : '레드'} 드래곤`
        };
        setObjectives(prev => ({ ...prev, dragon: { alive: false } }));
        duration = 5000;
        break;

      case 'BARON':
        // 바론: 양팀 모두 바론 위치에서 한타
        moveChampionsToFight(36.6, 30.2);
        highlight = {
          type: 'objective',
          x: 36.6,
          y: 30.2,
          description: `${event.data?.team === 'home' ? '블루' : '레드'} 바론`
        };
        setObjectives(prev => ({ ...prev, baron: { alive: false } }));
        duration = 40000;
        break;

      case 'HERALD':
        // 전령: 양팀 모두 전령 위치에서 한타
        moveChampionsToFight(36.6, 30.2);
        highlight = {
          type: 'objective',
          x: 36.6,
          y: 30.2,
          description: `${event.data?.team === 'home' ? '블루' : '레드'} 전령`
        };
        setObjectives(prev => ({ ...prev, herald: { alive: false, taken: true } }));
        duration = 5000;
        break;

      case 'TURRET':
      case 'INHIBITOR':
      case 'NEXUS_TURRET':
        // 포탑/억제기: 실제 맵 위치로 이동
        // 공격하는 팀 기준으로 위치 결정 (적 타워 근처)
        const attackingTeam = event.data?.team;
        const turretPositions: {[key: string]: {blue: {x: number, y: number}, red: {x: number, y: number}}} = {
          'top': {
            // 블루팀이 공격 -> 레드 탑 타워 (왼쪽 위)
            blue: { x: 30, y: 12 },
            // 레드팀이 공격 -> 블루 탑 타워 (왼쪽)
            red: { x: 14, y: 45 }
          },
          'mid': {
            blue: { x: 60, y: 38 },
            red: { x: 38, y: 62 }
          },
          'bot': {
            blue: { x: 88, y: 50 },
            red: { x: 55, y: 88 }
          }
        };
        const lane = event.data?.lane || 'mid';
        const towerPos = turretPositions[lane]?.[attackingTeam === 'home' ? 'blue' : 'red'] || { x: 50, y: 50 };

        // 모든 살아있는 챔피언을 타워 위치로 이동
        setChampions(prev => prev.map(champ => {
          if (!champ.isAlive) {
            const spawnPos = SPAWN_POSITIONS[champ.team][champ.position as keyof typeof SPAWN_POSITIONS.blue];
            return {
              ...champ,
              x: spawnPos?.x || (champ.team === 'blue' ? 8.1 : 92),
              y: spawnPos?.y || (champ.team === 'blue' ? 92.7 : 7.7)
            };
          }
          // 공격팀은 타워 쪽, 수비팀은 약간 뒤
          const isAttacker = (attackingTeam === 'home' && champ.team === 'blue') || (attackingTeam === 'away' && champ.team === 'red');
          const offsetX = isAttacker ? (Math.random() - 0.5) * 8 : (champ.team === 'blue' ? -10 : 10) + (Math.random() - 0.5) * 6;
          const offsetY = isAttacker ? (Math.random() - 0.5) * 8 : (champ.team === 'blue' ? 10 : -10) + (Math.random() - 0.5) * 6;
          return {
            ...champ,
            x: Math.max(5, Math.min(95, towerPos.x + offsetX)),
            y: Math.max(5, Math.min(95, towerPos.y + offsetY))
          };
        }));

        highlight = {
          type: 'objective',
          x: towerPos.x,
          y: towerPos.y,
          description: event.description
        };
        duration = 5000;
        break;

      case 'NEXUS_DESTROYED':
        // 넥서스 파괴: 모든 선수가 적 넥서스 위치로 이동
        const nexusX = event.data?.team === 'home' ? 85.2 : 13.9;
        const nexusY = event.data?.team === 'home' ? 13.7 : 85.7;
        moveChampionsToPosition(nexusX, nexusY, 'all');
        highlight = {
          type: 'ace',
          x: nexusX,
          y: nexusY,
          description: 'VICTORY!'
        };
        duration = 10000; // 승리는 10초
        break;
    }

    if (highlight) {
      setCurrentHighlight(highlight);
      setTimeout(() => {
        setCurrentHighlight(null);
      }, duration);
    }
  };

  // 포지션별 라인 위치 (실제 롤 맵 기준)
  const getLanePosition = (position: string, team: 'blue' | 'red', gameMinutes: number) => {
    // 게임 시간에 따라 라인 위치 조정
    const laneProgress = Math.min(1, gameMinutes / 20); // 0~1 (20분까지)

    // 실제 롤 맵 좌표 (좌하단이 블루, 우상단이 레드)
    const lanePositions = {
      blue: {
        TOP: {
          // 탑 라인: 왼쪽 위 (14, 50) → (30, 15)
          baseX: 14, baseY: 50,
          pushX: 30, pushY: 15
        },
        JUNGLE: {
          // 정글: 블루팀 정글 순환
          baseX: 30, baseY: 60,
          pushX: 45, pushY: 45
        },
        MID: {
          // 미드 라인: 대각선 (30, 70) → (50, 50)
          baseX: 30, baseY: 70,
          pushX: 50, pushY: 50
        },
        ADC: {
          // 봇 라인: 아래쪽 (50, 88) → (75, 85)
          baseX: 50, baseY: 88,
          pushX: 75, pushY: 85
        },
        SUPPORT: {
          // 서포터: ADC 약간 앞
          baseX: 45, baseY: 86,
          pushX: 70, pushY: 82
        }
      },
      red: {
        TOP: {
          // 탑 라인: 왼쪽 위에서 대치 (35, 12) → (18, 45)
          baseX: 35, baseY: 12,
          pushX: 18, pushY: 45
        },
        JUNGLE: {
          // 정글: 레드팀 정글 순환
          baseX: 70, baseY: 40,
          pushX: 55, pushY: 55
        },
        MID: {
          // 미드 라인: 대각선 (70, 30) → (50, 50)
          baseX: 70, baseY: 30,
          pushX: 50, pushY: 50
        },
        ADC: {
          // 봇 라인: 위쪽에서 대치 (50, 12) → (25, 15)
          baseX: 50, baseY: 12,
          pushX: 25, pushY: 15
        },
        SUPPORT: {
          // 서포터: ADC 약간 앞
          baseX: 55, baseY: 14,
          pushX: 30, pushY: 18
        }
      }
    };

    const pos = lanePositions[team][position as keyof typeof lanePositions.blue];
    if (!pos) return { x: 50, y: 50 };

    // 게임 진행에 따라 라인 중앙으로 이동
    return {
      x: pos.baseX + (pos.pushX - pos.baseX) * laneProgress,
      y: pos.baseY + (pos.pushY - pos.baseY) * laneProgress
    };
  };

  // 챔피언 위치 업데이트 (부드러운 이동)
  useEffect(() => {
    if (!isLive || champions.length === 0) return;

    const interval = setInterval(() => {
      const gameMinutes = gameTime / 60;

      setChampions(prev => prev.map(champ => {
        // 죽은 챔피언은 스폰 위치로 이동
        if (!champ.isAlive) {
          const spawnPos = SPAWN_POSITIONS[champ.team][champ.position as keyof typeof SPAWN_POSITIONS.blue];
          const targetX = spawnPos?.x || (champ.team === 'blue' ? 8.1 : 92);
          const targetY = spawnPos?.y || (champ.team === 'blue' ? 92.7 : 7.7);

          // 빠르게 스폰으로 이동
          const dx = (targetX - champ.x) * 0.3;
          const dy = (targetY - champ.y) * 0.3;

          return {
            ...champ,
            x: champ.x + dx,
            y: champ.y + dy
          };
        }

        // 하이라이트 중에는 약간의 움직임만 (제자리에서 흔들림)
        if (currentHighlight) {
          const jitterX = (Math.random() - 0.5) * 2;
          const jitterY = (Math.random() - 0.5) * 2;
          return {
            ...champ,
            x: Math.max(5, Math.min(95, champ.x + jitterX)),
            y: Math.max(5, Math.min(95, champ.y + jitterY))
          };
        }

        // 목표 라인 위치
        const targetPos = getLanePosition(champ.position, champ.team, gameMinutes);

        // 약간의 랜덤 움직임 (CS 파밍, 라인 관리)
        const randomX = (Math.random() - 0.5) * 3;
        const randomY = (Math.random() - 0.5) * 3;

        // 부드러운 이동 (현재 위치에서 목표로)
        const moveSpeed = 0.15; // 조금 더 빠르게
        const dx = (targetPos.x + randomX - champ.x) * moveSpeed;
        const dy = (targetPos.y + randomY - champ.y) * moveSpeed;

        return {
          ...champ,
          x: Math.max(5, Math.min(95, champ.x + dx)),
          y: Math.max(5, Math.min(95, champ.y + dy))
        };
      }));
    }, 200); // 0.2초마다 업데이트 (더 부드럽게)

    return () => clearInterval(interval);
  }, [isLive, champions.length, gameTime, currentHighlight]);

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
                {formatGold(Math.abs(homeState.gold - awayState.gold))} 원 차
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

      <div className="main-content with-map">
        {/* 왼쪽: 블루팀(홈팀) */}
        <div className="team-panel home">
          {/* 옵젝 상황 */}
          <div className="panel-section objectives">
            <h4>옵젝 상황</h4>
            {homeState && (
              <div className="obj-list">
                <div className="obj-item">
                  <span className="obj-icon">🐉</span>
                  <span className="obj-count">{homeState.dragons.length}</span>
                </div>
                <div className="obj-item">
                  <span className="obj-icon">👿</span>
                  <span className="obj-count">{homeState.barons}</span>
                </div>
                <div className="obj-item">
                  <span className="obj-icon">👁️</span>
                  <span className="obj-count">{homeState.heralds}</span>
                </div>
                <div className="obj-item">
                  <span className="obj-icon">💰</span>
                  <span className="obj-count">{formatGold(homeState.gold)}</span>
                </div>
              </div>
            )}
          </div>

          {/* 팀명 */}
          <div className="panel-section team-name-section">
            <h3>{match.home_team_name}</h3>
          </div>

          {/* 선수 */}
          <div className="panel-section players">
            <h4>선수</h4>
            {homeStats.map(player => (
              <div key={player.id} className="player-row">
                <span className="position">{player.position}</span>
                <span className="name">{player.player_name}</span>
              </div>
            ))}
          </div>

          {/* 통계 */}
          <div className="panel-section stats">
            <h4>통계</h4>
            {homeStats.map(player => (
              <div key={player.id} className="stat-row-compact">
                <span className="kda">{player.kills}/{player.deaths}/{player.assists}</span>
                <span className="cs">{player.cs}</span>
                <span className="dmg">{(player.damage_dealt / 1000).toFixed(1)}k</span>
              </div>
            ))}
          </div>
        </div>

        {/* 중앙: 맵 + 이벤트 로그 */}
        <div className="center-content">
          {/* 이벤트 로그 (맵 위) */}
          <div className="event-log" ref={eventLogRef}>
            <h3>경기 로그</h3>
            <div className="events-list">
              {events.length === 0 ? (
                <div className="no-events">이벤트가 없습니다.</div>
              ) : (
                events.slice(-10).map((event, idx) => (
                  <div key={idx} className={`event-item ${event.type.toLowerCase()}`}>
                    <span className="event-time">{formatTime(event.time)}</span>
                    <span className="event-desc">{event.description}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 맵 - 항상 표시 */}
          <div className={`map-container ${currentHighlight ? 'highlight-active' : ''}`}>
            <SummonersRiftMap
              champions={champions.filter(c => !deadPlayerIds.includes(c.playerId))}
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

          {/* 드래곤 현황 */}
          {homeState && awayState && (homeState.dragons.length > 0 || awayState.dragons.length > 0) && (
            <div className="dragons-display">
              <div className="dragons home-dragons">
                {homeState.dragons.map((dragon, idx) => {
                  const getDragonImage = (type: string) => {
                    switch (type) {
                      case '불': return '/dragons/fire.png';
                      case '바다': return '/dragons/water.png';
                      case '바람': return '/dragons/air.png';
                      case '대지': return '/dragons/ddang.png';
                      case '마법공학': return '/dragons/magong.png';
                      case '화학공학': return '/dragons/hwagong.png';
                      default: return '/dragons/fire.png';
                    }
                  };
                  return (
                    <img
                      key={idx}
                      src={getDragonImage(dragon)}
                      alt={dragon}
                      title={dragon}
                      className="dragon-icon-img"
                    />
                  );
                })}
              </div>
              <div className="dragons away-dragons">
                {awayState.dragons.map((dragon, idx) => {
                  const getDragonImage = (type: string) => {
                    switch (type) {
                      case '불': return '/dragons/fire.png';
                      case '바다': return '/dragons/water.png';
                      case '바람': return '/dragons/air.png';
                      case '대지': return '/dragons/ddang.png';
                      case '마법공학': return '/dragons/magong.png';
                      case '화학공학': return '/dragons/hwagong.png';
                      default: return '/dragons/fire.png';
                    }
                  };
                  return (
                    <img
                      key={idx}
                      src={getDragonImage(dragon)}
                      alt={dragon}
                      title={dragon}
                      className="dragon-icon-img"
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 레드팀(어웨이팀) */}
        <div className="team-panel away">
          {/* 옵젝 상황 */}
          <div className="panel-section objectives">
            <h4>옵젝상황</h4>
            {awayState && (
              <div className="obj-list">
                <div className="obj-item">
                  <span className="obj-icon">🐉</span>
                  <span className="obj-count">{awayState.dragons.length}</span>
                </div>
                <div className="obj-item">
                  <span className="obj-icon">👿</span>
                  <span className="obj-count">{awayState.barons}</span>
                </div>
                <div className="obj-item">
                  <span className="obj-icon">👁️</span>
                  <span className="obj-count">{awayState.heralds}</span>
                </div>
                <div className="obj-item">
                  <span className="obj-icon">💰</span>
                  <span className="obj-count">{formatGold(awayState.gold)}</span>
                </div>
              </div>
            )}
          </div>

          {/* 팀명 */}
          <div className="panel-section team-name-section">
            <h3>{match.away_team_name}</h3>
          </div>

          {/* 선수 */}
          <div className="panel-section players">
            <h4>선수</h4>
            {awayStats.map(player => (
              <div key={player.id} className="player-row">
                <span className="position">{player.position}</span>
                <span className="name">{player.player_name}</span>
              </div>
            ))}
          </div>

          {/* 통계 */}
          <div className="panel-section stats">
            <h4>통계</h4>
            {awayStats.map(player => (
              <div key={player.id} className="stat-row-compact">
                <span className="kda">{player.kills}/{player.deaths}/{player.assists}</span>
                <span className="cs">{player.cs}</span>
                <span className="dmg">{(player.damage_dealt / 1000).toFixed(1)}k</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 실시간 채팅 */}
      <div className="live-chat">
        <div className="chat-header">
          <h3>실시간 채팅</h3>
          <span className="viewer-count">{viewers.length}명 시청 중</span>
        </div>
        <div className="chat-messages" ref={chatRef}>
          {chatMessages.length === 0 ? (
            <div className="no-messages">채팅이 없습니다.</div>
          ) : (
            chatMessages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.type}`}>
                {msg.type === 'user' ? (
                  <>
                    <span className="chat-username">{msg.username}</span>
                    <span className="chat-text">{msg.message}</span>
                  </>
                ) : (
                  <span className="chat-system">{msg.message}</span>
                )}
              </div>
            ))
          )}
        </div>
        <div className="chat-input-container">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={handleChatKeyPress}
            placeholder="메시지를 입력하세요..."
            className="chat-input"
            maxLength={200}
          />
          <button onClick={sendChat} className="chat-send-btn">전송</button>
        </div>
      </div>

      {/* 경기 종료 집계 모달 */}
      {showSummary && (
        <div className="match-summary-overlay" onClick={() => setShowSummary(false)}>
          <div className="match-summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="summary-header">
              <h2>경기 종료</h2>
              <button className="close-btn" onClick={() => setShowSummary(false)}>×</button>
            </div>

            <div className="summary-score">
              <div className="summary-team home">
                <span className="team-name">{match.home_team_name}</span>
                <span className="score">{homeSetWins}</span>
              </div>
              <span className="vs">VS</span>
              <div className="summary-team away">
                <span className="score">{awaySetWins}</span>
                <span className="team-name">{match.away_team_name}</span>
              </div>
            </div>

            <div className="summary-result">
              {team && (
                <span className={`result ${
                  (match.home_team_id === team.id && homeSetWins > awaySetWins) ||
                  (match.away_team_id === team.id && awaySetWins > homeSetWins)
                    ? 'win' : homeSetWins === awaySetWins ? 'draw' : 'lose'
                }`}>
                  {(match.home_team_id === team.id && homeSetWins > awaySetWins) ||
                   (match.away_team_id === team.id && awaySetWins > homeSetWins)
                    ? '승리!' : homeSetWins === awaySetWins ? '무승부' : '패배'}
                </span>
              )}
            </div>

            <div className="summary-stats">
              <h3>선수 통계</h3>
              <div className="stats-table">
                <div className="stats-header">
                  <span>선수</span>
                  <span>KDA</span>
                  <span>CS</span>
                  <span>딜량</span>
                </div>
                {playerStats
                  .filter(p => team && (
                    (match.home_team_id === team.id && p.team_name === match.home_team_name) ||
                    (match.away_team_id === team.id && p.team_name === match.away_team_name)
                  ))
                  .map(player => (
                    <div key={player.id} className="stats-row">
                      <span className="player">{player.position} {player.player_name}</span>
                      <span className="kda">{player.kills}/{player.deaths}/{player.assists}</span>
                      <span className="cs">{player.cs}</span>
                      <span className="damage">{(player.damage_dealt / 1000).toFixed(1)}k</span>
                    </div>
                  ))}
              </div>
            </div>

            <button className="summary-close-btn" onClick={() => setShowSummary(false)}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
