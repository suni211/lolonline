import { useEffect, useState } from 'react';
import axios from 'axios';
import { soundManager } from '../utils/soundManager';
import PlayerDetailModal from '../components/PlayerDetailModal';
import ContractNegotiationModal from '../components/ContractNegotiationModal';
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
}

interface SearchPlayer {
  id: number;
  name: string;
  nationality: string;
  position: string;
  overall: number;
  owned_count: number;
}

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchName, setSearchName] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [showScout, setShowScout] = useState(false);
  const [scoutCost, setScoutCost] = useState<'gold' | 'diamond'>('gold');
  const [activeTab, setActiveTab] = useState<'my' | 'search'>('my');
  const [searchResults, setSearchResults] = useState<SearchPlayer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPosition, setSearchPosition] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [negotiatingPlayer, setNegotiatingPlayer] = useState<SearchPlayer | null>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await axios.get('/api/players/my');
      setPlayers(response.data);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  const handleScout = async () => {
    try {
      await axios.post('/api/players/scout', { cost_type: scoutCost });
      soundManager.playSound('click');
      alert('선수 스카우팅 완료!');
      fetchPlayers();
    } catch (error: any) {
      alert(error.response?.data?.error || '스카우팅 실패');
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

  const handleSearch = async () => {
    try {
      const response = await axios.get('/api/players/search', {
        params: {
          name: searchQuery || undefined,
          position: searchPosition || undefined
        }
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Failed to search players:', error);
    }
  };

  const handleRecruit = (player: SearchPlayer) => {
    setNegotiatingPlayer(player);
  };

  const filteredPlayers = players.filter(p => {
    if (searchName && !p.name.toLowerCase().includes(searchName.toLowerCase())) return false;
    if (filterPosition && p.position !== filterPosition) return false;
    return true;
  });

  return (
    <div className="players-page">
      <div className="page-header">
        <h1 className="page-title">선수 관리</h1>
        <button onClick={() => setShowScout(!showScout)} className="btn-primary">
          선수 스카우팅
        </button>
      </div>

      <div className="tabs-container">
        <button
          type="button"
          onClick={() => setActiveTab('my')}
          className={activeTab === 'my' ? 'tab-active' : 'tab-btn'}
        >
          내 선수
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={activeTab === 'search' ? 'tab-active' : 'tab-btn'}
        >
          선수 검색
        </button>
      </div>

      {showScout && (
        <div className="scout-modal">
          <div className="scout-content">
            <h3>선수 스카우팅</h3>
            <div className="scout-options">
              <label>
                <input
                  type="radio"
                  value="gold"
                  checked={scoutCost === 'gold'}
                  onChange={(e) => setScoutCost(e.target.value as 'gold' | 'diamond')}
                />
                골드 1,000
              </label>
              <label>
                <input
                  type="radio"
                  value="diamond"
                  checked={scoutCost === 'diamond'}
                  onChange={(e) => setScoutCost(e.target.value as 'gold' | 'diamond')}
                />
                다이아몬드 10
              </label>
            </div>
            <div className="scout-actions">
              <button onClick={handleScout} className="btn-primary">스카우팅</button>
              <button onClick={() => setShowScout(false)} className="btn-secondary">취소</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my' && (
        <>
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
            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                className={`player-card ${player.is_starter ? 'starter' : ''}`}
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
        </>
      )}

      {activeTab === 'search' && (
        <div className="search-section">
          <div className="search-filters">
            <input
              type="text"
              placeholder="선수 이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-input"
            />
            <select
              value={searchPosition}
              onChange={(e) => setSearchPosition(e.target.value)}
              className="filter-select"
            >
              <option value="">모든 포지션</option>
              <option value="TOP">TOP</option>
              <option value="JUNGLE">JUNGLE</option>
              <option value="MID">MID</option>
              <option value="ADC">ADC</option>
              <option value="SUPPORT">SUPPORT</option>
            </select>
            <button onClick={handleSearch} className="btn-primary">
              검색
            </button>
          </div>

          <div className="players-grid">
            {searchResults.map((player) => (
              <div key={player.id} className="player-card">
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
                  <span>{player.owned_count > 0 ? `${player.owned_count}팀 보유` : 'FA'}</span>
                </div>
                <div className="player-actions">
                  <button
                    type="button"
                    onClick={() => handleRecruit(player)}
                    className="btn-small btn-recruit"
                  >
                    영입
                  </button>
                </div>
              </div>
            ))}
            {searchResults.length === 0 && (
              <p className="empty-message">검색 결과가 없습니다. 검색 버튼을 눌러주세요.</p>
            )}
          </div>
        </div>
      )}

      {negotiatingPlayer && (
        <ContractNegotiationModal
          playerId={negotiatingPlayer.id}
          playerName={negotiatingPlayer.name}
          playerOverall={negotiatingPlayer.overall}
          ownedCount={negotiatingPlayer.owned_count}
          onClose={() => setNegotiatingPlayer(null)}
          onSuccess={() => {
            setNegotiatingPlayer(null);
            fetchPlayers();
            handleSearch();
          }}
        />
      )}
    </div>
  );
}

