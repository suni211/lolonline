import { useEffect, useState } from 'react';
import axios from 'axios';
import PlayerDetailModal from '../components/PlayerDetailModal';
import { getNationalityFlag, getNationalityName } from '../utils/nationalityFlags';
import './Players.css';

interface Player {
  id: number;
  name: string;
  nationality: string;
  position: string;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  leadership?: number;
  adaptability?: number;
  consistency?: number;
  work_ethic?: number;
  level: number;
  exp: number;
  exp_to_next: number;
  stat_points: number;
  player_condition: number;
  uniform_level: number;
  injury_status: string;
  injury_recovery_days: number;
  is_starter: boolean;
  is_benched: boolean;
  overall: number;
  personality?: string;
}

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchName, setSearchName] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await axios.get('/api/players/my');
      setPlayers(response.data);
    } catch (error: any) {
      console.error('Failed to fetch players:', error);
      if (error.response?.status === 500) {
        alert('선수 목록을 불러올 수 없습니다. 팀을 먼저 생성해주세요.');
      }
    }
  };

  const handleLineup = async (playerId: number, isStarter: boolean) => {
    try {
      await axios.put(`/api/players/${playerId}/lineup`, {
        is_starter: isStarter,
        is_benched: !isStarter
      });
      fetchPlayers();
    } catch (error: any) {
      alert(error.response?.data?.error || '라인업 변경 실패');
    }
  };

  const filteredPlayers = players.filter(p => {
    if (searchName && !p.name.toLowerCase().includes(searchName.toLowerCase())) return false;
    if (filterPosition && p.position !== filterPosition) return false;
    return true;
  });

  return (
    <div className="players-page page-wrapper">
      <div className="page-header">
        <h1 className="page-title">선수 관리</h1>
        <p className="page-subtitle">선수 카드에서 새로운 선수를 획득하세요</p>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="선수 이름 검색"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="filter-input"
        />
        <select
          value={filterPosition}
          onChange={(e) => setFilterPosition(e.target.value)}
          className="filter-select"
        >
          <option value="">모든 포지션</option>
          <option value="TOP">TOP</option>
          <option value="JUNGLE">JUNGLE</option>
          <option value="MID">MID</option>
          <option value="ADC">ADC</option>
          <option value="SUPPORT">SUPPORT</option>
        </select>
      </div>

      <div className="players-grid">
        {filteredPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`player-card hover-card list-item-animate ${player.is_starter ? 'starter' : ''}`}
            style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
            onClick={() => setSelectedPlayer(player)}
          >
            <div className="player-header">
              <h3>{player.name}</h3>
              <div className="player-meta">
                <span className="nationality-flag" title={getNationalityName(player.nationality || 'KR')}>
                  {getNationalityFlag(player.nationality || 'KR')}
                </span>
                <span className={`position-badge ${player.position}`}>{player.position}</span>
              </div>
            </div>
            <div className="player-overall">
              <span className="overall-label">OVR</span>
              <span className="overall-value">{player.overall}</span>
            </div>
            <div className="player-quick-info">
              <span>Lv.{player.level}</span>
              <span>{player.player_condition}%</span>
              {player.injury_status !== 'NONE' && <span className="injury-badge">부상</span>}
              {player.is_starter && <span className="starter-badge">주전</span>}
            </div>
            <div className="player-actions">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlayer(player);
                }}
                className="btn-small"
              >
                상세
              </button>
              {!player.is_starter ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLineup(player.id, true);
                  }}
                  className="btn-small btn-starter"
                  disabled={players.filter(p => p.is_starter).length >= 5}
                >
                  주전
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLineup(player.id, false);
                  }}
                  className="btn-small btn-bench"
                >
                  벤치
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onUpdate={() => {
            fetchPlayers();
            setSelectedPlayer(null);
          }}
        />
      )}
    </div>
  );
}

