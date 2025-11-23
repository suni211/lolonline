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
  // 정글 캠프 위치
  jungleCamps: {
    blue: {
      redBuff: { x: 52.1, y: 70.7 },
      golems: { x: 55.9, y: 79.4 },
      raptors: { x: 48.3, y: 62.1 },
      wolves: { x: 29.5, y: 53.9 },
      blueBuff: { x: 29.3, y: 45.8 },
      gromp: { x: 20, y: 42.4 }
    },
    red: {
      blueBuff: { x: 71.5, y: 52.2 },
      gromp: { x: 81.3, y: 55.8 },
      wolves: { x: 70.9, y: 44 },
      raptors: { x: 53.5, y: 36.3 },
      redBuff: { x: 49.5, y: 28.2 },
      golems: { x: 45.3, y: 19.3 }
    }
  },
  // 오브젝트 위치
  objectives: {
    dragon: { x: 64.9, y: 68 },
    baron: { x: 36.6, y: 30.2 },
    herald: { x: 36.6, y: 30.2 },
    blueNexus: { x: 13.9, y: 85.7 },
    redNexus: { x: 85.2, y: 13.7 },
    voidgrub: { x: 36.6, y: 30.2 },
    atakhan: { x: 27, y: 23.5 }
  },
  // 타워 위치
  turrets: {
    blue: {
      top: [{ x: 13.3, y: 29.6 }, { x: 15.4, y: 53.3 }, { x: 12.6, y: 68 }],
      mid: [{ x: 40.9, y: 55.4 }, { x: 35.9, y: 65.3 }, { x: 27.5, y: 71.4 }],
      bot: [{ x: 68.7, y: 90.5 }, { x: 46.6, y: 86.8 }, { x: 30.6, y: 88.1 }],
      nexus: [{ x: 15.5, y: 81.4 }, { x: 18, y: 84.5 }]
    },
    red: {
      top: [{ x: 32.9, y: 8.9 }, { x: 54.1, y: 12.4 }, { x: 69.2, y: 11.1 }],
      mid: [{ x: 59.5, y: 42.3 }, { x: 64.7, y: 32.3 }, { x: 72.8, y: 25.9 }],
      bot: [{ x: 89.1, y: 68.4 }, { x: 85.7, y: 44.4 }, { x: 87.6, y: 29.9 }],
      nexus: [{ x: 81.1, y: 14.9 }, { x: 83.8, y: 17.5 }]
    }
  }
};

// 포지션별 기본 위치 (게임 시작 시)
const SPAWN_POSITIONS = {
  blue: {
    TOP: { x: 8.1, y: 92.7 },
    JGL: { x: 8.1, y: 92.7 },
    MID: { x: 8.1, y: 92.7 },
    ADC: { x: 8.1, y: 92.7 },
    SUP: { x: 8.1, y: 92.7 }
  },
  red: {
    TOP: { x: 92, y: 7.7 },
    JGL: { x: 92, y: 7.7 },
    MID: { x: 92, y: 7.7 },
    ADC: { x: 92, y: 7.7 },
    SUP: { x: 92, y: 7.7 }
  }
};

// 네비게이션 노드 시스템
interface NavNode {
  id: string;
  x: number;
  y: number;
  connections: string[];
  // 이 노드에 접근하려면 파괴해야 할 적 포탑 (blue 팀 기준)
  requiresDestroyedTurret?: { team: 'blue' | 'red'; lane: string; index: number };
}

const NAVIGATION_NODES: NavNode[] = [
  // 블루팀 베이스
  { id: 'blue_spawn', x: 8.1, y: 92.7, connections: ['blue_nexus'] },
  { id: 'blue_nexus', x: 13.9, y: 85.7, connections: ['blue_spawn', 'blue_top_t3', 'blue_mid_t3', 'blue_bot_t3'] },

  // 블루팀 탑 라인
  { id: 'blue_top_t3', x: 12.6, y: 68, connections: ['blue_nexus', 'blue_top_t2', 'blue_wolves'] },
  { id: 'blue_top_t2', x: 15.4, y: 53.3, connections: ['blue_top_t3', 'blue_top_t1', 'blue_gromp'] },
  { id: 'blue_top_t1', x: 13.3, y: 29.6, connections: ['blue_top_t2', 'top_river', 'baron_pit'] },

  // 블루팀 미드 라인
  { id: 'blue_mid_t3', x: 27.5, y: 71.4, connections: ['blue_nexus', 'blue_mid_t2', 'blue_wolves', 'blue_raptors'] },
  { id: 'blue_mid_t2', x: 35.9, y: 65.3, connections: ['blue_mid_t3', 'blue_mid_t1', 'blue_raptors'] },
  { id: 'blue_mid_t1', x: 40.9, y: 55.4, connections: ['blue_mid_t2', 'mid_center'] },

  // 블루팀 봇 라인
  { id: 'blue_bot_t3', x: 30.6, y: 88.1, connections: ['blue_nexus', 'blue_bot_t2', 'blue_golems'] },
  { id: 'blue_bot_t2', x: 46.6, y: 86.8, connections: ['blue_bot_t3', 'blue_bot_t1', 'blue_red_buff'] },
  { id: 'blue_bot_t1', x: 68.7, y: 90.5, connections: ['blue_bot_t2', 'bot_river', 'dragon_pit'] },

  // 블루팀 정글
  { id: 'blue_gromp', x: 20, y: 42.4, connections: ['blue_top_t2', 'blue_blue_buff', 'top_river'] },
  { id: 'blue_blue_buff', x: 29.3, y: 45.8, connections: ['blue_gromp', 'blue_wolves'] },
  { id: 'blue_wolves', x: 29.5, y: 53.9, connections: ['blue_blue_buff', 'blue_top_t3', 'blue_mid_t3'] },
  { id: 'blue_raptors', x: 48.3, y: 62.1, connections: ['blue_mid_t2', 'blue_red_buff', 'mid_center'] },
  { id: 'blue_red_buff', x: 52.1, y: 70.7, connections: ['blue_raptors', 'blue_golems', 'dragon_pit'] },
  { id: 'blue_golems', x: 55.9, y: 79.4, connections: ['blue_red_buff', 'blue_bot_t3', 'bot_river'] },

  // 레드팀 베이스
  { id: 'red_spawn', x: 92, y: 7.7, connections: ['red_nexus'] },
  { id: 'red_nexus', x: 85.2, y: 13.7, connections: ['red_spawn', 'red_top_t3', 'red_mid_t3', 'red_bot_t3'] },

  // 레드팀 탑 라인
  { id: 'red_top_t3', x: 69.2, y: 11.1, connections: ['red_nexus', 'red_top_t2', 'red_golems'] },
  { id: 'red_top_t2', x: 54.1, y: 12.4, connections: ['red_top_t3', 'red_top_t1', 'red_red_buff'] },
  { id: 'red_top_t1', x: 32.9, y: 8.9, connections: ['red_top_t2', 'top_river', 'baron_pit'] },

  // 레드팀 미드 라인
  { id: 'red_mid_t3', x: 72.8, y: 25.9, connections: ['red_nexus', 'red_mid_t2', 'red_wolves', 'red_raptors'] },
  { id: 'red_mid_t2', x: 64.7, y: 32.3, connections: ['red_mid_t3', 'red_mid_t1', 'red_raptors'] },
  { id: 'red_mid_t1', x: 59.5, y: 42.3, connections: ['red_mid_t2', 'mid_center'] },

  // 레드팀 봇 라인
  { id: 'red_bot_t3', x: 87.6, y: 29.9, connections: ['red_nexus', 'red_bot_t2', 'red_gromp'] },
  { id: 'red_bot_t2', x: 85.7, y: 44.4, connections: ['red_bot_t3', 'red_bot_t1', 'red_blue_buff'] },
  { id: 'red_bot_t1', x: 89.1, y: 68.4, connections: ['red_bot_t2', 'bot_river', 'dragon_pit'] },

  // 레드팀 정글
  { id: 'red_gromp', x: 81.3, y: 55.8, connections: ['red_bot_t2', 'red_blue_buff', 'bot_river'] },
  { id: 'red_blue_buff', x: 71.5, y: 52.2, connections: ['red_gromp', 'red_wolves'] },
  { id: 'red_wolves', x: 70.9, y: 44, connections: ['red_blue_buff', 'red_mid_t3', 'red_bot_t3'] },
  { id: 'red_raptors', x: 53.5, y: 36.3, connections: ['red_mid_t2', 'red_red_buff', 'mid_center'] },
  { id: 'red_red_buff', x: 49.5, y: 28.2, connections: ['red_raptors', 'red_golems', 'baron_pit'] },
  { id: 'red_golems', x: 45.3, y: 19.3, connections: ['red_red_buff', 'red_top_t3', 'top_river'] },

  // 리버 & 오브젝트
  { id: 'mid_center', x: 50, y: 50, connections: ['blue_mid_t1', 'red_mid_t1', 'top_river', 'bot_river', 'blue_raptors', 'red_raptors'] },
  { id: 'top_river', x: 36.6, y: 30.2, connections: ['mid_center', 'blue_top_t1', 'red_top_t1', 'baron_pit', 'blue_gromp', 'red_golems'] },
  { id: 'bot_river', x: 64.9, y: 68, connections: ['mid_center', 'blue_bot_t1', 'red_bot_t1', 'dragon_pit', 'blue_golems', 'red_gromp'] },
  { id: 'baron_pit', x: 36.6, y: 30.2, connections: ['top_river', 'blue_top_t1', 'red_top_t1', 'atakhan'] },
  { id: 'dragon_pit', x: 64.9, y: 68, connections: ['bot_river', 'blue_bot_t1', 'red_bot_t1', 'blue_red_buff'] },
  { id: 'atakhan', x: 27, y: 23.5, connections: ['baron_pit', 'blue_top_t1'] }
];

// 포탑 상태에 따른 이동 가능 여부 체크
function canPassTurret(
  nodeId: string,
  team: 'blue' | 'red',
  blueTurrets: any,
  redTurrets: any
): boolean {
  // 자기 팀 포탑은 항상 통과 가능
  if (nodeId.startsWith(team)) return true;

  // 적 팀 포탑 노드인 경우
  const enemyTeam = team === 'blue' ? 'red' : 'blue';
  if (nodeId.startsWith(enemyTeam)) {
    const turrets = team === 'blue' ? redTurrets : blueTurrets;

    // 포탑 노드 파싱 (예: red_top_t1)
    const parts = nodeId.split('_');
    if (parts.length >= 3 && (parts[2] === 't1' || parts[2] === 't2' || parts[2] === 't3')) {
      const lane = parts[1] as 'top' | 'mid' | 'bot';
      const turretIndex = parseInt(parts[2].charAt(1)) - 1;

      // 해당 포탑이 살아있으면 통과 불가
      const turretState = turrets[lane];
      if (turretIndex === 0 && turretState.t1) return false;
      if (turretIndex === 1 && turretState.t2) return false;
      if (turretIndex === 2 && turretState.t3) return false;
    }
  }

  return true;
}

// 두 노드 사이의 경로 찾기 (BFS)
function findPath(
  startId: string,
  endId: string,
  team: 'blue' | 'red',
  blueTurrets: any,
  redTurrets: any
): NavNode[] {
  const nodeMap = new Map(NAVIGATION_NODES.map(n => [n.id, n]));
  const visited = new Set<string>();
  const queue: { node: NavNode; path: NavNode[] }[] = [];

  const startNode = nodeMap.get(startId);
  if (!startNode) return [];

  queue.push({ node: startNode, path: [startNode] });
  visited.add(startId);

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;

    if (node.id === endId) {
      return path;
    }

    for (const connId of node.connections) {
      if (visited.has(connId)) continue;

      const connNode = nodeMap.get(connId);
      if (!connNode) continue;

      // 포탑 통과 가능 여부 체크
      if (!canPassTurret(connId, team, blueTurrets, redTurrets)) continue;

      visited.add(connId);
      queue.push({ node: connNode, path: [...path, connNode] });
    }
  }

  return []; // 경로 없음
}

// 가장 가까운 노드 찾기
function findNearestNode(x: number, y: number): NavNode | null {
  let nearest: NavNode | null = null;
  let minDist = Infinity;

  for (const node of NAVIGATION_NODES) {
    const dist = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }

  return nearest;
}

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

export { SPAWN_POSITIONS, MAP_POSITIONS, NAVIGATION_NODES, findPath, findNearestNode, canPassTurret };
export type { ChampionPosition, ObjectiveState, Highlight, NavNode };
