import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Transfer.css';

interface TransferListing {
  listing_id: number;
  asking_price: number;
  listed_at: string;
  seller_team_id: number;
  seller_team_name: string;
  card_id: number;
  ovr: number;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  card_type: string;
  player_name: string;
  pro_team: string;
  position: string;
  league: string;
  nationality: string;
  status?: string;
}

interface MyCard {
  id: number;
  ovr: number;
  name: string;
  pro_team: string;
  position: string;
  is_starter: boolean;
  is_contracted: boolean;
}

export default function Transfer() {
  const { team, refreshTeam } = useAuth();
  const [activeTab, setActiveTab] = useState<'market' | 'sell' | 'history'>('market');
  const [listings, setListings] = useState<TransferListing[]>([]);
  const [myListings, setMyListings] = useState<TransferListing[]>([]);
  const [myCards, setMyCards] = useState<MyCard[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 필터 상태
  const [filters, setFilters] = useState({
    position: 'all',
    league: 'all',
    minOvr: '',
    maxOvr: '',
    minPrice: '',
    maxPrice: '',
    sort: 'newest'
  });

  // 판매 등록 상태
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [askingPrice, setAskingPrice] = useState('');

  useEffect(() => {
    fetchMarket();
    fetchMyListings();
    fetchMyCards();
    fetchHistory();
  }, []);

  useEffect(() => {
    fetchMarket();
  }, [filters]);

  const fetchMarket = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value);
        }
      });
      const response = await axios.get(`/api/transfer?${params.toString()}`);
      setListings(response.data);
    } catch (error) {
      console.error('Failed to fetch market:', error);
    }
  };

  const fetchMyListings = async () => {
    try {
      const response = await axios.get('/api/transfer/my-listings');
      setMyListings(response.data);
    } catch (error) {
      console.error('Failed to fetch my listings:', error);
    }
  };

  const fetchMyCards = async () => {
    try {
      const response = await axios.get('/api/packs/my-cards');
      setMyCards(response.data.filter((c: any) => c.is_contracted && !c.is_starter));
    } catch (error) {
      console.error('Failed to fetch my cards:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get('/api/transfer/history');
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const buyCard = async (listingId: number, price: number) => {
    if (!team || team.gold < price) {
      alert('골드가 부족합니다!');
      return;
    }

    if (!confirm(`이 카드를 ${price.toLocaleString()}원에 구매하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`/api/transfer/buy/${listingId}`);
      alert(response.data.message);
      await refreshTeam();
      await fetchMarket();
      await fetchHistory();
    } catch (error: any) {
      alert(error.response?.data?.error || '구매 실패');
    } finally {
      setLoading(false);
    }
  };

  const listCard = async () => {
    if (!selectedCard || !askingPrice) {
      alert('카드와 가격을 선택해주세요');
      return;
    }

    const price = parseInt(askingPrice);
    if (price < 1000) {
      alert('최소 가격은 1,000원입니다');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/transfer/list', {
        cardId: selectedCard,
        askingPrice: price
      });
      alert('이적시장에 등록되었습니다!');
      setSelectedCard(null);
      setAskingPrice('');
      await fetchMyListings();
      await fetchMyCards();
    } catch (error: any) {
      alert(error.response?.data?.error || '등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const cancelListing = async (listingId: number) => {
    if (!confirm('매물을 취소하시겠습니까?')) {
      return;
    }

    try {
      await axios.delete(`/api/transfer/cancel/${listingId}`);
      await fetchMyListings();
      await fetchMyCards();
    } catch (error: any) {
      alert(error.response?.data?.error || '취소 실패');
    }
  };

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

  const getOvrColor = (ovr: number) => {
    if (ovr >= 90) return '#ffd700';
    if (ovr >= 80) return '#c0c0c0';
    if (ovr >= 70) return '#cd7f32';
    return '#868e96';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  return (
    <div className="transfer-page">
      <h1 className="page-title">이적시장</h1>

      <div className="transfer-tabs">
        <button
          className={`tab-btn ${activeTab === 'market' ? 'active' : ''}`}
          onClick={() => setActiveTab('market')}
        >
          시장 둘러보기
        </button>
        <button
          className={`tab-btn ${activeTab === 'sell' ? 'active' : ''}`}
          onClick={() => setActiveTab('sell')}
        >
          판매하기
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          거래 내역
        </button>
      </div>

      {activeTab === 'market' && (
        <div className="market-section">
          <div className="filter-bar">
            <select
              value={filters.position}
              onChange={(e) => setFilters({ ...filters, position: e.target.value })}
            >
              <option value="all">전체 포지션</option>
              <option value="TOP">탑</option>
              <option value="JUNGLE">정글</option>
              <option value="MID">미드</option>
              <option value="ADC">원딜</option>
              <option value="SUPPORT">서포터</option>
            </select>

            <select
              value={filters.league}
              onChange={(e) => setFilters({ ...filters, league: e.target.value })}
            >
              <option value="all">전체 리그</option>
              <option value="LCK">LCK</option>
              <option value="LPL">LPL</option>
              <option value="LEC">LEC</option>
              <option value="LCS">LCS</option>
            </select>

            <input
              type="number"
              placeholder="최소 OVR"
              value={filters.minOvr}
              onChange={(e) => setFilters({ ...filters, minOvr: e.target.value })}
            />

            <input
              type="number"
              placeholder="최대 OVR"
              value={filters.maxOvr}
              onChange={(e) => setFilters({ ...filters, maxOvr: e.target.value })}
            />

            <input
              type="number"
              placeholder="최소 가격"
              value={filters.minPrice}
              onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
            />

            <input
              type="number"
              placeholder="최대 가격"
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
            />

            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            >
              <option value="newest">최신순</option>
              <option value="price_asc">가격 낮은순</option>
              <option value="price_desc">가격 높은순</option>
              <option value="ovr_desc">OVR 높은순</option>
              <option value="ovr_asc">OVR 낮은순</option>
            </select>
          </div>

          <div className="listings-grid">
            {listings.map((listing) => (
              <div key={listing.listing_id} className="listing-card">
                <div className="card-header">
                  <span
                    className="position"
                    style={{ backgroundColor: getPositionColor(listing.position) }}
                  >
                    {listing.position}
                  </span>
                  <span
                    className="ovr"
                    style={{ color: getOvrColor(listing.ovr) }}
                  >
                    {listing.ovr}
                  </span>
                </div>
                <div className="player-name">{listing.player_name}</div>
                <div className="player-team">{listing.pro_team}</div>
                <div className="player-info">{listing.league} | {listing.nationality}</div>
                <div className="stats">
                  <span>멘탈 {listing.mental}</span>
                  <span>팀파 {listing.teamfight}</span>
                  <span>집중 {listing.focus}</span>
                  <span>라인 {listing.laning}</span>
                </div>
                <div className="price">{listing.asking_price.toLocaleString()}원</div>
                <div className="seller">판매자: {listing.seller_team_name}</div>
                <button
                  className="buy-btn"
                  onClick={() => buyCard(listing.listing_id, listing.asking_price)}
                  disabled={loading || !team || team.gold < listing.asking_price}
                >
                  구매하기
                </button>
              </div>
            ))}
          </div>

          {listings.length === 0 && (
            <p className="no-listings">매물이 없습니다.</p>
          )}
        </div>
      )}

      {activeTab === 'sell' && (
        <div className="sell-section">
          <div className="sell-form">
            <h2>카드 판매 등록</h2>

            <div className="form-group">
              <label>판매할 카드 선택</label>
              <select
                value={selectedCard || ''}
                onChange={(e) => setSelectedCard(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">카드를 선택하세요</option>
                {myCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name} ({card.position}) - OVR {card.ovr}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>판매 가격</label>
              <input
                type="number"
                placeholder="최소 1,000원"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
              />
              <span className="fee-info">* 판매 시 5% 수수료가 부과됩니다</span>
            </div>

            <button
              className="list-btn"
              onClick={listCard}
              disabled={loading || !selectedCard || !askingPrice}
            >
              등록하기
            </button>
          </div>

          <div className="my-listings">
            <h2>내 매물 목록</h2>
            {myListings.filter(l => l.status === 'LISTED').length > 0 ? (
              <div className="my-listings-list">
                {myListings.filter(l => l.status === 'LISTED').map((listing) => (
                  <div key={listing.listing_id} className="my-listing-item">
                    <div className="listing-info">
                      <span className="player-name">{listing.player_name}</span>
                      <span className="position" style={{ backgroundColor: getPositionColor(listing.position) }}>
                        {listing.position}
                      </span>
                      <span className="ovr">OVR {listing.ovr}</span>
                      <span className="price">{listing.asking_price.toLocaleString()}원</span>
                    </div>
                    <button
                      className="cancel-btn"
                      onClick={() => cancelListing(listing.listing_id)}
                    >
                      취소
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-listings">등록된 매물이 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section">
          <h2>거래 내역</h2>
          {history.length > 0 ? (
            <table className="history-table">
              <thead>
                <tr>
                  <th>선수</th>
                  <th>포지션</th>
                  <th>가격</th>
                  <th>유형</th>
                  <th>상대방</th>
                  <th>날짜</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.player_name}</td>
                    <td>
                      <span style={{ color: getPositionColor(item.position) }}>
                        {item.position}
                      </span>
                    </td>
                    <td>{item.asking_price.toLocaleString()}원</td>
                    <td className={item.transaction_type === 'SOLD' ? 'sold' : 'bought'}>
                      {item.transaction_type === 'SOLD' ? '판매' : '구매'}
                    </td>
                    <td>
                      {item.transaction_type === 'SOLD' ? item.buyer_name : item.seller_name}
                    </td>
                    <td>{formatDate(item.sold_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-history">거래 내역이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
