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
  const [selectedCardForColor, setSelectedCardForColor] = useState<number | null>(null);

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

  const applyTeamColor = async (cardId: number, teamColorName: string | null) => {
    try {
      await axios.post(`/api/packs/cards/${cardId}/team-color`, {
        teamColorName
      });
      await fetchCards();
      await fetchTeamColorBonus();
      setSelectedCardForColor(null);
    } catch (error: any) {
      alert(error.response?.data?.error || '팀컬러 적용 실패');
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
                  <div className="card-actions">
                    <button
                      className={`starter-btn ${card.is_starter ? 'active' : ''}`}
                      onClick={() => toggleStarter(card.id, card.is_starter)}
                    >
                      {card.is_starter ? '스타터 해제' : '스타터 지정'}
                    </button>
                    <button
                      className="color-btn"
                      onClick={() => setSelectedCardForColor(card.id)}
                    >
                      팀컬러
                    </button>
                  </div>
                )}
                {card.is_contracted && (
                  <div className="contract-badge">계약됨 (S{card.contract_season})</div>
                )}
                {(card as any).team_color_name && (
                  <div className="card-team-color" style={{ borderColor: teamColors.find(c => c.team_name === (card as any).team_color_name)?.color_code || '#fff' }}>
                    {(card as any).team_color_name}
                  </div>
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
          <h2>팀컬러 (프로팀)</h2>

          <div className="teamcolor-info">
            <p>카드에 프로팀 컬러를 적용하면 같은 팀 3명 이상일 때 +5 보너스!</p>
          </div>

          <div className="my-colors">
            <h3>프로팀 목록</h3>
            {teamColors.length > 0 ? (
              <div className="colors-grid">
                {teamColors.map(color => (
                  <div key={color.team_name} className="color-item">
                    <div
                      className="color-preview"
                      style={{ backgroundColor: color.color_code }}
                    />
                    <div className="color-info">
                      <span className="color-name">{color.team_name}</span>
                      <span className="color-league">{color.league}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-colors">프로팀 데이터를 불러오는 중...</p>
            )}
          </div>

          {teamColorBonus && (
            <div className="color-bonus-info">
              <h3>팀컬러 보너스 (3명 이상 동일 팀)</h3>
              <div className="bonus-detail">
                <span>총 보너스: +{teamColorBonus.teamColorBonus.totalBonus}</span>
                <p>{teamColorBonus.teamColorBonus.details}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedCardForColor && (
        <div className="color-select-overlay" onClick={() => setSelectedCardForColor(null)}>
          <div className="color-select-modal" onClick={e => e.stopPropagation()}>
            <h3>팀컬러 선택</h3>
            <div className="color-options-scroll">
              <button
                className="color-option none"
                onClick={() => applyTeamColor(selectedCardForColor, null)}
              >
                해제
              </button>
              {teamColors.map(color => (
                <button
                  key={color.team_name}
                  className="color-option"
                  style={{ borderColor: color.color_code }}
                  onClick={() => applyTeamColor(selectedCardForColor, color.team_name)}
                >
                  <div
                    className="option-preview"
                    style={{ backgroundColor: color.color_code }}
                  />
                  {color.team_name}
                </button>
              ))}
            </div>
            <button className="close-btn" onClick={() => setSelectedCardForColor(null)}>
              닫기
            </button>
          </div>
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
