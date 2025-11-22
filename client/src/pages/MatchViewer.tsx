import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './MatchViewer.css';

interface Player {
  id: number;
  name: string;
  position: string;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  overall: number;
  face_image: string | null;
}

interface MatchDetails {
  id: number;
  league_id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  status: string;
  league_name: string;
  home_players: Player[];
  away_players: Player[];
}

interface GameEvent {
  time: string;
  type: 'kill' | 'objective' | 'teamfight' | 'info';
  team: 'home' | 'away' | 'neutral';
  message: string;
}

export default function MatchViewer() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([]);
  const [currentSet, setCurrentSet] = useState(1);
  const [setScores, setSetScores] = useState<{ home: number; away: number }[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const eventLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMatchDetails();
  }, [matchId]);

  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [gameEvents]);

  const fetchMatchDetails = async () => {
    try {
      const res = await axios.get(`/api/leagues/matches/${matchId}`);
      setMatch(res.data);
    } catch (error) {
      console.error('Failed to fetch match:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNarration = (homeTeam: string, awayTeam: string, homePlayers: Player[], awayPlayers: Player[]) => {
    const narrations = [
      `${homeTeam}의 정글러가 상대 블루 버프를 노립니다!`,
      `${awayTeam} 미드라이너의 화려한 솔로킬!`,
      `양 팀이 드래곤 앞에서 신경전을 벌이고 있습니다.`,
      `${homeTeam} 원딜이 완벽한 포지셔닝으로 3킬을 올립니다!`,
      `${awayTeam} 서포터의 결정적인 이니시에이팅!`,
      `바론 나셔를 둘러싼 치열한 한타!`,
      `${homeTeam} 탑라이너가 스플릿 푸시로 압박합니다.`,
      `${awayTeam}의 완벽한 다이브! 타워를 무너뜨립니다!`,
      `${homeTeam} 정글러의 갱킹이 성공했습니다!`,
      `${awayTeam} 미드라이너가 로밍으로 판을 키웁니다.`,
    ];

    const killNarrations = (team: string, players: Player[]) => {
      const player = players[Math.floor(Math.random() * players.length)];
      return [
        `${team} ${player.name}이(가) 솔로킬을 기록합니다!`,
        `${player.name}의 화려한 플레이!`,
        `${player.name}이(가) 더블킬을 달성합니다!`,
      ];
    };

    const objectiveNarrations = [
      '드래곤을 획득했습니다!',
      '헤럴드를 소환합니다!',
      '바론 나셔를 처치했습니다!',
      '인히비터를 파괴했습니다!',
    ];

    return { narrations, killNarrations, objectiveNarrations };
  };

  const simulateSet = async () => {
    if (!match) return;

    setIsSimulating(true);
    setGameEvents([]);
    setGameTime(0);

    const { narrations, killNarrations, objectiveNarrations } = generateNarration(
      match.home_team_name,
      match.away_team_name,
      match.home_players,
      match.away_players
    );

    // 팀 파워 계산
    const homePower = match.home_players.reduce((sum, p) => sum + p.overall, 0) + 5; // 홈 어드밴티지
    const awayPower = match.away_players.reduce((sum, p) => sum + p.overall, 0);

    let homeKills = 0;
    let awayKills = 0;

    // 경기 시뮬레이션 (40분 기준, 5초마다 이벤트)
    for (let minute = 1; minute <= 40; minute++) {
      await new Promise(resolve => setTimeout(resolve, 150)); // 빠른 시뮬레이션

      setGameTime(minute);

      // 이벤트 발생 확률
      if (Math.random() < 0.4) {
        const isHomeEvent = Math.random() * (homePower + awayPower) < homePower;
        const eventType = Math.random();

        let event: GameEvent;

        if (eventType < 0.5) {
          // 킬 이벤트
          if (isHomeEvent) {
            homeKills++;
            const killNarr = killNarrations(match.home_team_name, match.home_players);
            event = {
              time: `${minute}:00`,
              type: 'kill',
              team: 'home',
              message: killNarr[Math.floor(Math.random() * killNarr.length)]
            };
          } else {
            awayKills++;
            const killNarr = killNarrations(match.away_team_name, match.away_players);
            event = {
              time: `${minute}:00`,
              type: 'kill',
              team: 'away',
              message: killNarr[Math.floor(Math.random() * killNarr.length)]
            };
          }
        } else if (eventType < 0.7) {
          // 오브젝트 이벤트
          event = {
            time: `${minute}:00`,
            type: 'objective',
            team: isHomeEvent ? 'home' : 'away',
            message: `${isHomeEvent ? match.home_team_name : match.away_team_name}이(가) ${objectiveNarrations[Math.floor(Math.random() * objectiveNarrations.length)]}`
          };
        } else {
          // 일반 나레이션
          event = {
            time: `${minute}:00`,
            type: 'info',
            team: 'neutral',
            message: narrations[Math.floor(Math.random() * narrations.length)]
          };
        }

        setGameEvents(prev => [...prev, event]);
      }
    }

    // 세트 승자 결정
    const homeRoll = Math.random() * homePower + homeKills * 2;
    const awayRoll = Math.random() * awayPower + awayKills * 2;
    const setWinner = homeRoll > awayRoll ? 'home' : 'away';

    setGameEvents(prev => [...prev, {
      time: '40:00',
      type: 'info',
      team: setWinner,
      message: `${setWinner === 'home' ? match.home_team_name : match.away_team_name}이(가) ${currentSet}세트 승리!`
    }]);

    setSetScores(prev => [...prev, {
      home: setWinner === 'home' ? 1 : 0,
      away: setWinner === 'away' ? 1 : 0
    }]);

    setIsSimulating(false);
    setCurrentSet(prev => prev + 1);
  };

  const getStatBarWidth = (value: number, max: number = 100) => {
    return `${(value / max) * 100}%`;
  };

  if (loading) {
    return <div className="match-viewer loading">로딩 중...</div>;
  }

  if (!match) {
    return <div className="match-viewer error">경기를 찾을 수 없습니다.</div>;
  }

  const totalHomeWins = setScores.filter(s => s.home > s.away).length;
  const totalAwayWins = setScores.filter(s => s.away > s.home).length;

  return (
    <div className="match-viewer">
      <div className="match-header">
        <div className="team-info home">
          <h2>{match.home_team_name}</h2>
          <div className="score">{match.status === 'FINISHED' ? match.home_score : totalHomeWins}</div>
        </div>
        <div className="vs-info">
          <div className="league-name">{match.league_name}</div>
          <div className="vs">VS</div>
          <div className="game-time">
            {isSimulating ? `${gameTime}:00` : match.status === 'FINISHED' ? '종료' : '대기'}
          </div>
        </div>
        <div className="team-info away">
          <h2>{match.away_team_name}</h2>
          <div className="score">{match.status === 'FINISHED' ? match.away_score : totalAwayWins}</div>
        </div>
      </div>

      <div className="match-content">
        <div className="players-panel home-panel">
          <h3>홈 팀</h3>
          {match.home_players.map(player => (
            <div
              key={player.id}
              className={`player-row ${selectedPlayer?.id === player.id ? 'selected' : ''}`}
              onClick={() => setSelectedPlayer(player)}
            >
              <div className="player-face">
                {player.face_image ? (
                  <img src={player.face_image} alt={player.name} />
                ) : (
                  <div className="no-face">{player.position}</div>
                )}
              </div>
              <div className="player-brief">
                <div className="name">{player.name}</div>
                <div className="position">{player.position}</div>
              </div>
              <div className="overall">{player.overall}</div>
            </div>
          ))}
        </div>

        <div className="center-panel">
          <div className="event-log" ref={eventLogRef}>
            <h3>경기 진행</h3>
            {gameEvents.length === 0 ? (
              <div className="no-events">경기 시작을 기다리는 중...</div>
            ) : (
              gameEvents.map((event, idx) => (
                <div key={idx} className={`event ${event.type} ${event.team}`}>
                  <span className="event-time">[{event.time}]</span>
                  <span className="event-message">{event.message}</span>
                </div>
              ))
            )}
          </div>

          {match.status !== 'FINISHED' && (
            <button
              onClick={simulateSet}
              disabled={isSimulating || totalHomeWins >= 2 || totalAwayWins >= 2}
              className="simulate-btn"
            >
              {isSimulating ? '경기 진행 중...' : totalHomeWins >= 2 || totalAwayWins >= 2 ? '경기 종료' : `${currentSet}세트 시작`}
            </button>
          )}
        </div>

        <div className="players-panel away-panel">
          <h3>어웨이 팀</h3>
          {match.away_players.map(player => (
            <div
              key={player.id}
              className={`player-row ${selectedPlayer?.id === player.id ? 'selected' : ''}`}
              onClick={() => setSelectedPlayer(player)}
            >
              <div className="player-face">
                {player.face_image ? (
                  <img src={player.face_image} alt={player.name} />
                ) : (
                  <div className="no-face">{player.position}</div>
                )}
              </div>
              <div className="player-brief">
                <div className="name">{player.name}</div>
                <div className="position">{player.position}</div>
              </div>
              <div className="overall">{player.overall}</div>
            </div>
          ))}
        </div>
      </div>

      {selectedPlayer && (
        <div className="player-stats-panel">
          <div className="stats-header">
            <div className="player-face large">
              {selectedPlayer.face_image ? (
                <img src={selectedPlayer.face_image} alt={selectedPlayer.name} />
              ) : (
                <div className="no-face">{selectedPlayer.position}</div>
              )}
            </div>
            <div>
              <h3>{selectedPlayer.name}</h3>
              <p>{selectedPlayer.position} | OVR {selectedPlayer.overall}</p>
            </div>
            <button onClick={() => setSelectedPlayer(null)} className="close-btn">×</button>
          </div>
          <div className="stats-bars">
            <div className="stat-row">
              <label>멘탈</label>
              <div className="stat-bar">
                <div className="stat-fill mental" style={{ width: getStatBarWidth(selectedPlayer.mental) }}></div>
              </div>
              <span>{selectedPlayer.mental}</span>
            </div>
            <div className="stat-row">
              <label>팀파이트</label>
              <div className="stat-bar">
                <div className="stat-fill teamfight" style={{ width: getStatBarWidth(selectedPlayer.teamfight) }}></div>
              </div>
              <span>{selectedPlayer.teamfight}</span>
            </div>
            <div className="stat-row">
              <label>집중력</label>
              <div className="stat-bar">
                <div className="stat-fill focus" style={{ width: getStatBarWidth(selectedPlayer.focus) }}></div>
              </div>
              <span>{selectedPlayer.focus}</span>
            </div>
            <div className="stat-row">
              <label>라인전</label>
              <div className="stat-bar">
                <div className="stat-fill laning" style={{ width: getStatBarWidth(selectedPlayer.laning) }}></div>
              </div>
              <span>{selectedPlayer.laning}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
