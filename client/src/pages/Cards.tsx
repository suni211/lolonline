import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Cards.css';

interface Pack {
  id: number;
  name: string;
  description: string;
  price_gold: number;
  card_count: number;
  pack_type: string;
}

interface PlayerCard {
  id: number;
  pro_player_id: number;
  name: string;
  team: string;
  position: string;
  league: string;
  nationality: string;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  ovr: number;
  card_type: string;
  is_starter: boolean;
  is_contracted: boolean;
  contract_season: number | null;
}

interface Chemistry {
  starters: PlayerCard[];
  chemistry_bonus: {
    leagueBonus: number;
    nationalityBonus: number;
    totalBonus: number;
    leagueDetail: string;
    nationalityDetail: string;
  };
}

interface TeamColor {
  team_name: string;
  league: string;
  color_code: string;
}

interface TeamColorBonus {
  starters: PlayerCard[];
  teamColorBonus: {
    totalBonus: number;
    details: string;
    teamCounts?: { [key: string]: number };
  };
}

export default function Cards() {
  const { team, refreshTeam } = useAuth();
  const [activeTab, setActiveTab] = useState<'packs' | 'cards' | 'starters' | 'teamcolor'>('packs');
  const [packs, setPacks] = useState<Pack[]>([]);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [chemistry, setChemistry] = useState<Chemistry | null>(null);
  const [openedCards, setOpenedCards] = useState<PlayerCard[]>([]);
  const [showOpenResult, setShowOpenResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [teamColors, setTeamColors] = useState<TeamColor[]>([]);
  const [teamColorBonus, setTeamColorBonus] = useState<TeamColorBonus | null>(null);

  useEffect(() => {
    fetchPacks();
    fetchCards();
    fetchChemistry();
    fetchTeamColors();
    fetchTeamColorBonus();
  }, []);

  const fetchPacks = async () => {
    try {
      const response = await axios.get('/api/packs');
      setPacks(response.data);
    } catch (error) {
      console.error('Failed to fetch packs:', error);
    }
  };

  const fetchCards = async () => {
    try {
      const response = await axios.get('/api/packs/my-cards');
      setCards(response.data);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    }
  };

  const fetchChemistry = async () => {
    try {
      const response = await axios.get('/api/packs/chemistry');
      setChemistry(response.data);
    } catch (error) {
      console.error('Failed to fetch chemistry:', error);
    }
  };

  const fetchTeamColors = async () => {
    try {
      const response = await axios.get('/api/packs/team-colors');
      setTeamColors(response.data);
    } catch (error) {
      console.error('Failed to fetch team colors:', error);
    }
  };

  const fetchTeamColorBonus = async () => {
    try {
      const response = await axios.get('/api/packs/team-color-bonus');
      setTeamColorBonus(response.data);
    } catch (error) {
      console.error('Failed to fetch team color bonus:', error);
    }
  };

  const openPack = async (packId: number, price: number) => {
    if (!team || team.gold < price) {
      alert('골드가 부족합니다!');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`/api/packs/${packId}/open`);
      const cards = response.data.cards || response.data || [];
      setOpenedCards(Array.isArray(cards) ? cards : [cards]);
      setShowOpenResult(true);
      await refreshTeam();
      await fetchCards();
      await fetchChemistry();
    } catch (error: any) {
      alert(error.response?.data?.error || '팩 개봉 실패');
    } finally {
      setLoading(false);
    }
  };

  const toggleStarter = async (cardId: number, currentStatus: boolean) => {
    try {
      await axios.post(`/api/packs/cards/${cardId}/starter`, {
        isStarter: !currentStatus
      });
      await fetchCards();
      await fetchChemistry();
    } catch (error: any) {
      alert(error.response?.data?.error || '스타터 설정 실패');
    }
  };

  const contractCard = async (cardId: number, ovr: number) => {
    // 계약된 카드 수 확인 - 5명 미만이면 무료
    const contractedCount = cards.filter(c => c.is_contracted).length;
    const isFree = contractedCount < 5;
    const cost = isFree ? 0 : Math.floor(ovr * 50000);

    const message = isFree
      ? `이 카드와 무료로 계약하시겠습니까?\n(초반 5명 무료 계약 - ${contractedCount + 1}/5)\n(1시즌 동안 유효)`
      : `이 카드와 계약하시겠습니까?\n계약 비용: ${cost.toLocaleString()}원\n(1시즌 동안 유효)`;

    if (!confirm(message)) {
      return;
    }

    try {
      await axios.post(`/api/packs/cards/${cardId}/contract`);
      await fetchCards();
      await refreshTeam();
      alert('계약이 완료되었습니다!');
    } catch (error: any) {
      alert(error.response?.data?.error || '계약 실패');
    }
  };

  // 계약된 카드 수 (무료 계약 표시용)
  const contractedCount = cards.filter(c => c.is_contracted).length;

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'TOP': return '#ff6b6b';
      case 'JUNGLE': return '#51cf66';
      case 'MID': return '#339af0';
      case 'ADC': return '#ffd43b';
      case 'SUPPORT': return '#cc5de8';
      default: return '#868e96';
    }
  };

  const getCardTypeClass = (type: string) => {
    return type === 'SEASON' ? 'card-season' : 'card-normal';
  };

  const getOvrColor = (ovr: number) => {
    if (ovr >= 90) return '#ffd700';
    if (ovr >= 80) return '#c0c0c0';
    if (ovr >= 70) return '#cd7f32';
    return '#868e96';
  };

  const filteredCards = cards.filter(card => {
    if (filter === 'all') return true;
    return card.position === filter;
  });

  const starters = cards.filter(c => c.is_starter);

  return (
    <div className="cards-page">
      <h1 className="page-title">선수 카드</h1>

      <div className="cards-tabs">
        <button
          className={`tab-btn ${activeTab === 'packs' ? 'active' : ''}`}
          onClick={() => setActiveTab('packs')}
        >
          선수팩
        </button>
        <button
          className={`tab-btn ${activeTab === 'cards' ? 'active' : ''}`}
          onClick={() => setActiveTab('cards')}
        >
          내 카드 ({cards.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'starters' ? 'active' : ''}`}
          onClick={() => setActiveTab('starters')}
        >
          스타터/케미
        </button>
        <button
          className={`tab-btn ${activeTab === 'teamcolor' ? 'active' : ''}`}
          onClick={() => setActiveTab('teamcolor')}
        >
          팀컬러
        </button>
      </div>

      {activeTab === 'packs' && (
        <div className="packs-section">
          <h2>선수팩 구매</h2>
          <div className="packs-grid">
            {packs.map(pack => (
              <div key={pack.id} className={`pack-item ${pack.pack_type.toLowerCase()}`}>
                <div className="pack-icon">
                  {pack.pack_type === 'NORMAL' ? '📦' : '⭐'}
                </div>
                <h3>{pack.name}</h3>
                <p className="pack-desc">{pack.description}</p>
                <p className="pack-info">랜덤 선수 1명</p>
                <p className="pack-price">{pack.price_gold.toLocaleString()}원</p>
                <button
                  className="open-btn"
                  onClick={() => openPack(pack.id, pack.price_gold)}
                  disabled={loading || !team || team.gold < pack.price_gold}
                >
                  {loading ? '개봉 중...' : '개봉하기'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'cards' && (
        <div className="my-cards-section">
          <div className="filter-bar">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              전체
            </button>
            {['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'].map(pos => (
              <button
                key={pos}
                className={`filter-btn ${filter === pos ? 'active' : ''}`}
                onClick={() => setFilter(pos)}
                style={{ borderColor: getPositionColor(pos) }}
              >
                {pos}
              </button>
            ))}
          </div>

          <div className="cards-grid">
            {filteredCards.map(card => (
              <div
                key={card.id}
                className={`player-card ${getCardTypeClass(card.card_type)} ${card.is_starter ? 'starter' : ''}`}
              >
                <div className="card-header">
                  <span
                    className="card-position"
                    style={{ backgroundColor: getPositionColor(card.position) }}
                  >
                    {card.position}
                  </span>
                  <span
                    className="card-ovr"
                    style={{ color: getOvrColor(card.ovr) }}
                  >
                    {card.ovr}
                  </span>
                </div>
                <div
                  className="card-avatar"
                  style={{
                    background: `linear-gradient(135deg, ${getPositionColor(card.position)}, ${getPositionColor(card.position)}88)`
                  }}
                >
                  <span className="avatar-initial">{card.name.charAt(0)}</span>
                </div>
                <div className="card-name">{card.name}</div>
                <div className="card-team">{card.team}</div>
                <div className="card-league">{card.league} | {card.nationality}</div>
                <div className="card-stats">
                  <div className="stat">
                    <span className="stat-label">멘탈</span>
                    <span className="stat-value">{card.mental}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">팀파이트</span>
                    <span className="stat-value">{card.teamfight}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">집중</span>
                    <span className="stat-value">{card.focus}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">라인전</span>
                    <span className="stat-value">{card.laning}</span>
                  </div>
                </div>
                {!card.is_contracted ? (
                  <button
                    className="contract-btn"
                    onClick={() => contractCard(card.id, card.ovr)}
                  >
                    {contractedCount < 5
                      ? `무료 계약 (${contractedCount + 1}/5)`
                      : `계약 (${(card.ovr * 50000).toLocaleString()}원)`
                    }
                  </button>
                ) : (
                  <button
                    className={`starter-btn ${card.is_starter ? 'active' : ''}`}
                    onClick={() => toggleStarter(card.id, card.is_starter)}
                  >
                    {card.is_starter ? '스타터 해제' : '스타터 지정'}
                  </button>
                )}
                {card.is_contracted && (
                  <div className="contract-badge">계약됨 (S{card.contract_season})</div>
                )}
              </div>
            ))}
          </div>

          {filteredCards.length === 0 && (
            <p className="no-cards">카드가 없습니다. 선수팩을 구매해보세요!</p>
          )}
        </div>
      )}

      {activeTab === 'starters' && (
        <div className="starters-section">
          <h2>현재 스타터</h2>

          {chemistry && (
            <div className="chemistry-info">
              <h3>케미스트리 보너스</h3>
              <div className="chemistry-details">
                <div className="chemistry-item">
                  <span className="chem-label">리그 보너스</span>
                  <span className="chem-value">+{chemistry.chemistry_bonus.leagueBonus}</span>
                  <span className="chem-detail">{chemistry.chemistry_bonus.leagueDetail}</span>
                </div>
                <div className="chemistry-item">
                  <span className="chem-label">국적 보너스</span>
                  <span className="chem-value">+{chemistry.chemistry_bonus.nationalityBonus}</span>
                  <span className="chem-detail">{chemistry.chemistry_bonus.nationalityDetail}</span>
                </div>
                <div className="chemistry-total">
                  <span>총 보너스</span>
                  <span className="total-value">+{chemistry.chemistry_bonus.totalBonus}</span>
                </div>
              </div>
            </div>
          )}

          <div className="starters-grid">
            {['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'].map(position => {
              const starter = starters.find(s => s.position === position);
              return (
                <div key={position} className="starter-slot">
                  <div
                    className="slot-position"
                    style={{ backgroundColor: getPositionColor(position) }}
                  >
                    {position}
                  </div>
                  {starter ? (
                    <div className="starter-card">
                      <div
                        className="starter-avatar"
                        style={{
                          background: `linear-gradient(135deg, ${getPositionColor(starter.position)}, ${getPositionColor(starter.position)}88)`
                        }}
                      >
                        <span className="avatar-initial">{starter.name.charAt(0)}</span>
                      </div>
                      <div className="starter-name">{starter.name}</div>
                      <div className="starter-ovr" style={{ color: getOvrColor(starter.ovr) }}>
                        OVR {starter.ovr}
                      </div>
                      <div className="starter-team">{starter.team}</div>
                    </div>
                  ) : (
                    <div className="empty-slot">
                      <span>비어있음</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'teamcolor' && (
        <div className="teamcolor-section">
          <h2>팀 보너스</h2>

          <div className="teamcolor-info">
            <p>스타터에 같은 프로팀 소속 선수가 3명 이상이면 +5 보너스!</p>
          </div>

          {teamColorBonus && (
            <div className="color-bonus-info">
              <h3>현재 팀 보너스</h3>
              <div className="bonus-detail">
                <span>총 보너스: +{teamColorBonus.teamColorBonus.totalBonus}</span>
                <p>{teamColorBonus.teamColorBonus.details}</p>
              </div>

              {teamColorBonus.teamColorBonus.teamCounts && Object.keys(teamColorBonus.teamColorBonus.teamCounts).length > 0 && (
                <div className="team-counts">
                  <h4>스타터 팀 구성</h4>
                  <div className="colors-grid">
                    {Object.entries(teamColorBonus.teamColorBonus.teamCounts).map(([teamName, count]) => (
                      <div key={teamName} className="color-item">
                        <div
                          className="color-preview"
                          style={{ backgroundColor: teamColors.find(c => c.team_name === teamName)?.color_code || '#888' }}
                        />
                        <div className="color-info">
                          <span className="color-name">{teamName}</span>
                          <span className="color-league">{count}명</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showOpenResult && openedCards && openedCards.length > 0 && (
        <div className="pack-result-overlay" onClick={() => setShowOpenResult(false)}>
          <div className="pack-result" onClick={e => e.stopPropagation()}>
            <h2>팩 개봉 결과!</h2>
            <div className="opened-cards">
              {openedCards.map((card, idx) => (
                <div
                  key={idx}
                  className={`opened-card ${getCardTypeClass(card.card_type)}`}
                >
                  <div className="card-header">
                    <span
                      className="card-position"
                      style={{ backgroundColor: getPositionColor(card.position) }}
                    >
                      {card.position}
                    </span>
                    <span
                      className="card-ovr"
                      style={{ color: getOvrColor(card.ovr) }}
                    >
                      {card.ovr}
                    </span>
                  </div>
                  <div
                    className="card-avatar large"
                    style={{
                      background: `linear-gradient(135deg, ${getPositionColor(card.position)}, ${getPositionColor(card.position)}88)`
                    }}
                  >
                    <span className="avatar-initial">{card.name.charAt(0)}</span>
                  </div>
                  <div className="card-name">{card.name}</div>
                  <div className="card-team">{card.team}</div>
                </div>
              ))}
            </div>
            <button className="close-btn" onClick={() => setShowOpenResult(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
