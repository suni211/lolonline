import { useEffect, useState } from 'react';
import './SummonersRiftMap.css';

// 맵 좌표 (0-100% 기준)
const MAP_POSITIONS = {
  // 라인 위치
  lanes: {
    top: [
      { x: 10, y: 15 }, { x: 12, y: 25 }, { x: 14, y: 35 }, { x: 16, y: 45 },
      { x: 18, y: 55 }, { x: 25, y: 60 }, { x: 35, y: 62 }, { x: 45, y: 64 }
    ],
    mid: [
      { x: 20, y: 80 }, { x: 30, y: 70 }, { x: 40, y: 60 }, { x: 50, y: 50 },
      { x: 60, y: 40 }, { x: 70, y: 30 }, { x: 80, y: 20 }
    ],
    bot: [
      { x: 55, y: 86 }, { x: 65, y: 84 }, { x: 75, y: 82 }, { x: 82, y: 75 },
      { x: 84, y: 65 }, { x: 86, y: 55 }, { x: 88, y: 45 }, { x: 90, y: 35 }
    ]
  },
  // 정글 위치
  jungle: {
    blueTop: { x: 25, y: 45 },
    blueBot: { x: 35, y: 75 },
    redTop: { x: 65, y: 25 },
    redBot: { x: 75, y: 55 }
  },
  // 오브젝트 위치
  objectives: {
    dragon: { x: 70.5, y: 68 },
    baron: { x: 30, y: 30 },
    herald: { x: 30, y: 30 },
    blueNexus: { x: 12, y: 88 },
    redNexus: { x: 88, y: 12 },
    voidgrub: { x: 30, y: 30 },
    atakhan: { x: 50, y: 50 }
  },
  // 타워 위치
  turrets: {
    blue: {
      top: [{ x: 5, y: 51 }, { x: 5, y: 39 }, { x: 10, y: 26 }],
      mid: [{ x: 23, y: 77 }, { x: 32, y: 68 }, { x: 42, y: 58 }],
      bot: [{ x: 51, y: 95 }, { x: 39, y: 95 }, { x: 26, y: 90 }],
      nexus: [{ x: 13, y: 87 }, { x: 17, y: 83 }]
    },
    red: {
      top: [{ x: 49, y: 5 }, { x: 61, y: 5 }, { x: 74, y: 10 }],
      mid: [{ x: 77, y: 23 }, { x: 68, y: 32 }, { x: 58, y: 42 }],
      bot: [{ x: 95, y: 49 }, { x: 95, y: 61 }, { x: 90, y: 74 }],
      nexus: [{ x: 83, y: 17 }, { x: 87, y: 13 }]
    }
  }
};

// 포지션별 기본 위치 (게임 시작 시)
const SPAWN_POSITIONS = {
  blue: {
    TOP: { x: 14, y: 35 },
    JGL: { x: 30, y: 60 },
    MID: { x: 30, y: 70 },
    ADC: { x: 40, y: 85 },
    SUP: { x: 35, y: 82 }
  },
  red: {
    TOP: { x: 86, y: 65 },
    JGL: { x: 70, y: 40 },
    MID: { x: 70, y: 30 },
    ADC: { x: 60, y: 15 },
    SUP: { x: 65, y: 18 }
  }
};

interface ChampionPosition {
  playerId: number;
  playerName: string;
  position: string; // TOP, JGL, MID, ADC, SUP
  team: 'blue' | 'red';
  x: number;
  y: number;
  isAlive: boolean;
  imageUrl?: string;
}

interface ObjectiveState {
  dragon: { alive: boolean; type?: string; health?: number };
  baron: { alive: boolean; health?: number };
  herald: { alive: boolean; taken: boolean };
  voidgrub: { alive: boolean; count: number };
  atakhan: { alive: boolean };
}

interface TurretState {
  top: { t1: boolean; t2: boolean; t3: boolean; inhib: boolean };
  mid: { t1: boolean; t2: boolean; t3: boolean; inhib: boolean };
  bot: { t1: boolean; t2: boolean; t3: boolean; inhib: boolean };
  nexus: { twin1: boolean; twin2: boolean; nexus: boolean };
}

interface Highlight {
  type: 'kill' | 'teamfight' | 'objective' | 'ace';
  x: number;
  y: number;
  description: string;
}

interface SummonersRiftMapProps {
  champions: ChampionPosition[];
  objectives: ObjectiveState;
  blueTurrets: TurretState;
  redTurrets: TurretState;
  currentHighlight?: Highlight | null;
  gameTime: number;
}

export default function SummonersRiftMap({
  champions,
  objectives,
  blueTurrets,
  redTurrets,
  currentHighlight,
  gameTime
}: SummonersRiftMapProps) {
  const [highlightEffect, setHighlightEffect] = useState(false);

  useEffect(() => {
    if (currentHighlight) {
      setHighlightEffect(true);
      const timer = setTimeout(() => setHighlightEffect(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentHighlight]);

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  const getDragonIcon = (type?: string) => {
    switch (type) {
      case 'INFERNAL': return '/map/fire.png';
      case 'OCEAN': return '/map/water.png';
      case 'CLOUD': return '/map/air.png';
      case 'MOUNTAIN': return '/map/ddang.png';
      case 'HEXTECH': return '/map/hwagong.png';
      case 'CHEMTECH': return '/map/magong.png';
      case 'ELDER': return '/map/jangro.png';
      default: return '/map/fire.png';
    }
  };

  const renderTurret = (alive: boolean, x: number, y: number, team: 'blue' | 'red', key: string) => {
    if (!alive) return null;
    return (
      <div
        key={key}
        className={`map-turret ${team}`}
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        <img src={team === 'blue' ? '/map/bluetureet.png' : '/map/redturret.png'} alt="turret" />
      </div>
    );
  };

  const renderAllTurrets = () => {
    const turrets: JSX.Element[] = [];

    // Blue turrets
    const blueLanes = ['top', 'mid', 'bot'] as const;
    blueLanes.forEach(lane => {
      const laneState = blueTurrets[lane];
      const positions = MAP_POSITIONS.turrets.blue[lane];
      if (laneState.t1) turrets.push(renderTurret(true, positions[0].x, positions[0].y, 'blue', `blue-${lane}-t1`)!);
      if (laneState.t2) turrets.push(renderTurret(true, positions[1].x, positions[1].y, 'blue', `blue-${lane}-t2`)!);
      if (laneState.t3) turrets.push(renderTurret(true, positions[2].x, positions[2].y, 'blue', `blue-${lane}-t3`)!);
    });
    if (blueTurrets.nexus.twin1) {
      turrets.push(renderTurret(true, MAP_POSITIONS.turrets.blue.nexus[0].x, MAP_POSITIONS.turrets.blue.nexus[0].y, 'blue', 'blue-nexus-1')!);
    }
    if (blueTurrets.nexus.twin2) {
      turrets.push(renderTurret(true, MAP_POSITIONS.turrets.blue.nexus[1].x, MAP_POSITIONS.turrets.blue.nexus[1].y, 'blue', 'blue-nexus-2')!);
    }

    // Red turrets
    const redLanes = ['top', 'mid', 'bot'] as const;
    redLanes.forEach(lane => {
      const laneState = redTurrets[lane];
      const positions = MAP_POSITIONS.turrets.red[lane];
      if (laneState.t1) turrets.push(renderTurret(true, positions[0].x, positions[0].y, 'red', `red-${lane}-t1`)!);
      if (laneState.t2) turrets.push(renderTurret(true, positions[1].x, positions[1].y, 'red', `red-${lane}-t2`)!);
      if (laneState.t3) turrets.push(renderTurret(true, positions[2].x, positions[2].y, 'red', `red-${lane}-t3`)!);
    });
    if (redTurrets.nexus.twin1) {
      turrets.push(renderTurret(true, MAP_POSITIONS.turrets.red.nexus[0].x, MAP_POSITIONS.turrets.red.nexus[0].y, 'red', 'red-nexus-1')!);
    }
    if (redTurrets.nexus.twin2) {
      turrets.push(renderTurret(true, MAP_POSITIONS.turrets.red.nexus[1].x, MAP_POSITIONS.turrets.red.nexus[1].y, 'red', 'red-nexus-2')!);
    }

    return turrets;
  };

  return (
    <div className={`summoners-rift-map ${highlightEffect ? 'highlight-active' : ''}`}>
      {/* 맵 배경 */}
      <img src="/map/111.png" alt="Summoner's Rift" className="map-background" />

      {/* 타워 */}
      {renderAllTurrets()}

      {/* 오브젝트 */}
      {objectives.dragon.alive && (
        <div
          className="map-objective dragon"
          style={{
            left: `${MAP_POSITIONS.objectives.dragon.x}%`,
            top: `${MAP_POSITIONS.objectives.dragon.y}%`
          }}
        >
          <img src={getDragonIcon(objectives.dragon.type)} alt="dragon" />
          {objectives.dragon.health && objectives.dragon.health < 50 && (
            <div className="objective-contest">!</div>
          )}
        </div>
      )}

      {objectives.baron.alive && gameTime >= 1200 && (
        <div
          className="map-objective baron"
          style={{
            left: `${MAP_POSITIONS.objectives.baron.x}%`,
            top: `${MAP_POSITIONS.objectives.baron.y}%`
          }}
        >
          <img src="/map/baron.png" alt="baron" />
          {objectives.baron.health && objectives.baron.health < 50 && (
            <div className="objective-contest">!</div>
          )}
        </div>
      )}

      {objectives.herald.alive && gameTime < 1200 && !objectives.herald.taken && (
        <div
          className="map-objective herald"
          style={{
            left: `${MAP_POSITIONS.objectives.herald.x}%`,
            top: `${MAP_POSITIONS.objectives.herald.y}%`
          }}
        >
          <img src="/map/junryeong.png" alt="herald" />
        </div>
      )}

      {objectives.voidgrub.alive && gameTime < 840 && (
        <div
          className="map-objective voidgrub"
          style={{
            left: `${MAP_POSITIONS.objectives.voidgrub.x}%`,
            top: `${MAP_POSITIONS.objectives.voidgrub.y}%`
          }}
        >
          <img src="/map/voidgrub.png" alt="voidgrub" />
          {objectives.voidgrub.count > 0 && (
            <span className="grub-count">{objectives.voidgrub.count}</span>
          )}
        </div>
      )}

      {/* 챔피언 */}
      {champions.map(champ => (
        <div
          key={champ.playerId}
          className={`map-champion ${champ.team} ${!champ.isAlive ? 'dead' : ''}`}
          style={{
            left: `${champ.x}%`,
            top: `${champ.y}%`,
            opacity: champ.isAlive ? 1 : 0.3
          }}
        >
          {champ.imageUrl ? (
            <img src={champ.imageUrl} alt={champ.playerName} className="champion-image" />
          ) : (
            <div className="champion-initial">{getInitials(champ.playerName)}</div>
          )}
          <span className="champion-name">{champ.playerName}</span>
        </div>
      ))}

      {/* 하이라이트 이펙트 */}
      {currentHighlight && (
        <div
          className={`highlight-effect ${currentHighlight.type}`}
          style={{
            left: `${currentHighlight.x}%`,
            top: `${currentHighlight.y}%`
          }}
        >
          <div className="highlight-ring"></div>
          <div className="highlight-text">{currentHighlight.description}</div>
        </div>
      )}

      {/* 한타 경고 */}
      {currentHighlight?.type === 'teamfight' && (
        <div className="teamfight-alert">
          TEAM FIGHT!
        </div>
      )}
    </div>
  );
}

export { SPAWN_POSITIONS, MAP_POSITIONS };
export type { ChampionPosition, ObjectiveState, Highlight };
