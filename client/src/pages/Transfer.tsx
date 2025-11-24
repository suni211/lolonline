import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Transfer.css';

interface TransferListing {
  listing_id: number;
  asking_price: number;
  listed_at: string;
  seller_team_id: number;
  seller_team_name: string;
  card_id: number;
  pro_player_id: number;
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

interface FAPlayer {
  id: number;
  name: string;
  position: string;
  nationality: string;
  original_team: string;
  league: string;
  face_image: string;
  overall: number;
}

interface ContractedCard {
  card_id: number;
  name: string;
  position: string;
  ovr: number;
  is_starter: boolean;
}

interface NegotiationInfo {
  player: {
    id: number;
    name: string;
    position: string;
    team: string;
    league: string;
    face_image: string;
    overall: number;
  };
  stats: {
    mental: number;
    teamfight: number;
    focus: number;
    laning: number;
  };
  personality: {
    type: string;
    name: string;
    description: string;
  };
  asking_price: number;
  base_price: number;
}

interface TransferRequest {
  id: number;
  card_id: number;
  seller_team_id: number;
  buyer_team_id: number;
  offer_price: number;
  status: string;
  counter_price: number | null;
  message: string | null;
  response_message: string | null;
  created_at: string;
  expires_at: string;
  player_name: string;
  position: string;
  ovr: number;
  buyer_team_name?: string;
  seller_team_name?: string;
}

interface TeamPlayer {
  card_id: number;
  pro_player_id: number;
  ovr: number;
  mental: number;
  teamfight: number;
  focus: number;
  laning: number;
  is_starter: boolean;
  name: string;
  position: string;
  pro_team: string;
  league: string;
  team_name: string;
}

interface TeamInfo {
  id: number;
  name: string;
  league: string;
  logo_url: string | null;
}

export default function Transfer() {
  const { team, refreshTeam } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'fa' | 'market' | 'sell' | 'release' | 'requests' | 'history'>('fa');
  const [listings, setListings] = useState<TransferListing[]>([]);
  const [myListings, setMyListings] = useState<TransferListing[]>([]);
  const [myCards, setMyCards] = useState<MyCard[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // FA 상태
  const [faPlayers, setFaPlayers] = useState<FAPlayer[]>([]);
  const [contractedCards, setContractedCards] = useState<ContractedCard[]>([]);

  // 이적 요청 상태
  const [incomingRequests, setIncomingRequests] = useState<TransferRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<TransferRequest[]>([]);
  const [allTeams, setAllTeams] = useState<TeamInfo[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [requestModal, setRequestModal] = useState<{cardId: number, playerName: string, ovr: number} | null>(null);
  const [requestOfferPrice, setRequestOfferPrice] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [counterModal, setCounterModal] = useState<TransferRequest | null>(null);
  const [counterPrice, setCounterPrice] = useState('');

  // 필터 상태
  const [filters, setFilters] = useState({
    position: 'all',
    league: 'all',
    minOvr: '',
    maxOvr: '',
    minPrice: '',
    maxPrice: '',
    name: '',
    sort: 'newest'
  });

  // FA 필터 상태
  const [faFilters, setFaFilters] = useState({
    position: 'all',
    league: 'all',
    minOvr: '',
    maxOvr: '',
    name: '',
    sort: 'ovr_desc'
  });

  // 판매 등록 상태
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [askingPrice, setAskingPrice] = useState('');

  // 협상 상태
  const [negotiation, setNegotiation] = useState<NegotiationInfo | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [contractYears, setContractYears] = useState(1);
  const [contractRole, setContractRole] = useState<'KEY' | 'REGULAR' | 'BACKUP' | 'RESERVE'>('REGULAR');
  const [negotiationResult, setNegotiationResult] = useState<any>(null);

  // 계약 등급별 연봉 배수
  const contractRoleMultipliers = {
    KEY: 1.5,      // 중요 선수: 150%
    REGULAR: 1.0,  // 일반 선수: 100%
    BACKUP: 0.7,   // 후보: 70%
    RESERVE: 0.4   // 2군: 40%
  };

  useEffect(() => {
    fetchFaPlayers();
    fetchMarket();
    fetchMyListings();
    fetchMyCards();
    fetchContractedCards();
    fetchHistory();
    fetchRequests();
    fetchAllTeams();
  }, []);

  useEffect(() => {
    fetchMarket();
  }, [filters]);

  useEffect(() => {
    fetchFaPlayers();
  }, [faFilters]);

  const fetchFaPlayers = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(faFilters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value);
        }
      });
      params.append('limit', '1000'); // 모든 선수 가져오기
      const response = await axios.get(`/api/transfer/fa?${params.toString()}`);
      setFaPlayers(response.data.players || response.data);
    } catch (error) {
      console.error('Failed to fetch FA players:', error);
    }
  };

  const fetchContractedCards = async () => {
    try {
      const response = await axios.get('/api/packs/my-cards');
      // MySQL은 boolean을 0/1로 반환
      const cards = response.data.filter((c: any) => c.is_contracted === true || c.is_contracted === 1);
      setContractedCards(cards.map((c: any) => ({
        card_id: c.id,
        name: c.name,
        position: c.position,
        ovr: c.ovr,
        is_starter: c.is_starter
      })));
    } catch (error) {
      console.error('Failed to fetch contracted cards:', error);
    }
  };

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
      // MySQL은 boolean을 0/1로 반환
      setMyCards(response.data.filter((c: any) =>
        (c.is_contracted === true || c.is_contracted === 1) &&
        !(c.is_starter === true || c.is_starter === 1)
      ));
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

  const fetchRequests = async () => {
    try {
      const [incoming, outgoing] = await Promise.all([
        axios.get('/api/transfer/requests/incoming'),
        axios.get('/api/transfer/requests/outgoing')
      ]);
      setIncomingRequests(incoming.data);
      setOutgoingRequests(outgoing.data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  const fetchAllTeams = async () => {
    try {
      const response = await axios.get('/api/teams/all');
      setAllTeams(response.data.filter((t: any) => t.id !== team?.id));
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchTeamPlayers = async (teamId: number) => {
    try {
      const response = await axios.get(`/api/transfer/teams/${teamId}/players`);
      setTeamPlayers(response.data);
    } catch (error) {
      console.error('Failed to fetch team players:', error);
    }
  };

  const sendTransferRequest = async () => {
    if (!requestModal || !requestOfferPrice) return;

    setLoading(true);
    try {
      const response = await axios.post('/api/transfer/request', {
        cardId: requestModal.cardId,
        offerPrice: parseInt(requestOfferPrice),
        message: requestMessage || null
      });
      alert(response.data.message);
      setRequestModal(null);
      setRequestOfferPrice('');
      setRequestMessage('');
      await fetchRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || '요청 실패');
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async (requestId: number) => {
    if (!confirm('이 요청을 수락하시겠습니까?')) return;

    setLoading(true);
    try {
      const response = await axios.post(`/api/transfer/requests/${requestId}/accept`);
      alert(response.data.message);
      await refreshTeam();
      await fetchRequests();
      await fetchContractedCards();
    } catch (error: any) {
      alert(error.response?.data?.error || '수락 실패');
    } finally {
      setLoading(false);
    }
  };

  const rejectRequest = async (requestId: number) => {
    if (!confirm('이 요청을 거절하시겠습니까?')) return;

    setLoading(true);
    try {
      await axios.post(`/api/transfer/requests/${requestId}/reject`);
      alert('요청을 거절했습니다');
      await fetchRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || '거절 실패');
    } finally {
      setLoading(false);
    }
  };

  const sendCounter = async () => {
    if (!counterModal || !counterPrice) return;

    setLoading(true);
    try {
      await axios.post(`/api/transfer/requests/${counterModal.id}/counter`, {
        counterPrice: parseInt(counterPrice)
      });
      alert('역제안을 보냈습니다');
      setCounterModal(null);
      setCounterPrice('');
      await fetchRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || '역제안 실패');
    } finally {
      setLoading(false);
    }
  };

  const acceptCounter = async (requestId: number) => {
    if (!confirm('역제안을 수락하시겠습니까?')) return;

    setLoading(true);
    try {
      const response = await axios.post(`/api/transfer/requests/${requestId}/accept-counter`);
      alert(response.data.message);
      await refreshTeam();
      await fetchRequests();
      await fetchContractedCards();
    } catch (error: any) {
      alert(error.response?.data?.error || '수락 실패');
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async (requestId: number) => {
    if (!confirm('요청을 취소하시겠습니까?')) return;

    try {
      await axios.delete(`/api/transfer/requests/${requestId}`);
      alert('요청을 취소했습니다');
      await fetchRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || '취소 실패');
    }
  };

  const buyCard = async (listingId: number, price: number) => {
    if (!team || team.gold < price) {
      alert('원가 부족합니다!');
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

  const startNegotiation = async (playerId: number) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/transfer/fa/negotiate/${playerId}`);
      setNegotiation(response.data);
      setOfferPrice(response.data.asking_price.toString());
      setNegotiationResult(null);
    } catch (error: any) {
      alert(error.response?.data?.error || '협상 시작 실패');
    } finally {
      setLoading(false);
    }
  };

  const submitOffer = async () => {
    if (!negotiation || !offerPrice) return;

    const price = parseInt(offerPrice);
    if (!team || team.gold < price) {
      alert('원가 부족합니다!');
      return;
    }

    setLoading(true);
    try {
      // 계약 등급에 따른 실제 연봉 계산
      const adjustedPrice = Math.floor(price * contractRoleMultipliers[contractRole]);

      const response = await axios.post(`/api/transfer/fa/sign/${negotiation.player.id}`, {
        offered_price: adjustedPrice,
        mental: negotiation.stats.mental,
        teamfight: negotiation.stats.teamfight,
        focus: negotiation.stats.focus,
        laning: negotiation.stats.laning,
        personality: negotiation.personality.type,
        contract_years: contractYears,
        contract_role: contractRole
      });

      setNegotiationResult(response.data);

      if (response.data.success) {
        await refreshTeam();
        await fetchFaPlayers();
        await fetchContractedCards();
      } else if (response.data.result === 'COUNTER') {
        setOfferPrice(response.data.counter_price.toString());
      }
    } catch (error: any) {
      alert(error.response?.data?.error || '협상 실패');
    } finally {
      setLoading(false);
    }
  };

  const closeNegotiation = () => {
    setNegotiation(null);
    setNegotiationResult(null);
    setOfferPrice('');
    setContractYears(1);
    setContractRole('REGULAR');
  };

  const releasePlayer = async (cardId: number, ovr: number, name: string) => {
    const refund = Math.floor(ovr * 100000 * 0.5);
    if (!confirm(`${name} 선수를 방출하시겠습니까? (환불금: ${refund.toLocaleString()}원)`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`/api/transfer/release/${cardId}`);
      alert(response.data.message);
      await refreshTeam();
      await fetchContractedCards();
      await fetchFaPlayers();
    } catch (error: any) {
      alert(error.response?.data?.error || '방출 실패');
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
    <div className="transfer-page page-wrapper">
      <h1 className="page-title">이적시장</h1>

      <div className="transfer-tabs">
        <button
          className={`tab-btn ${activeTab === 'fa' ? 'active' : ''}`}
          onClick={() => setActiveTab('fa')}
        >
          FA 선수
        </button>
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
          className={`tab-btn ${activeTab === 'release' ? 'active' : ''}`}
          onClick={() => setActiveTab('release')}
        >
          선수 방출
        </button>
        <button
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          이적 요청
          {(incomingRequests.length > 0 || outgoingRequests.filter(r => r.status === 'COUNTER').length > 0) && (
            <span className="request-badge">
              {incomingRequests.length + outgoingRequests.filter(r => r.status === 'COUNTER').length}
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          거래 내역
        </button>
      </div>

      {activeTab === 'fa' && (
        <div className="fa-section">
          <div className="filter-bar">
            <input
              type="text"
              placeholder="선수 이름 검색"
              value={faFilters.name}
              onChange={(e) => setFaFilters({ ...faFilters, name: e.target.value })}
              className="search-input"
            />

            <select
              value={faFilters.position}
              onChange={(e) => setFaFilters({ ...faFilters, position: e.target.value })}
            >
              <option value="all">전체 포지션</option>
              <option value="TOP">탑</option>
              <option value="JUNGLE">정글</option>
              <option value="MID">미드</option>
              <option value="ADC">원딜</option>
              <option value="SUPPORT">서포터</option>
            </select>

            <select
              value={faFilters.league}
              onChange={(e) => setFaFilters({ ...faFilters, league: e.target.value })}
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
              value={faFilters.minOvr}
              onChange={(e) => setFaFilters({ ...faFilters, minOvr: e.target.value })}
            />

            <input
              type="number"
              placeholder="최대 OVR"
              value={faFilters.maxOvr}
              onChange={(e) => setFaFilters({ ...faFilters, maxOvr: e.target.value })}
            />

            <select
              value={faFilters.sort}
              onChange={(e) => setFaFilters({ ...faFilters, sort: e.target.value })}
            >
              <option value="ovr_desc">OVR 높은순</option>
              <option value="ovr_asc">OVR 낮은순</option>
              <option value="name">이름순</option>
            </select>
          </div>

          <div className="listings-grid">
            {faPlayers.map((player) => (
              <div key={player.id} className="listing-card fa-card">
                <div className="card-header">
                  <span
                    className="position"
                    style={{ backgroundColor: getPositionColor(player.position) }}
                  >
                    {player.position}
                  </span>
                  <span
                    className="ovr"
                    style={{ color: getOvrColor(player.overall) }}
                  >
                    {player.overall}
                  </span>
                </div>
                {player.face_image && (
                  <div className="player-face">
                    <img src={player.face_image} alt={player.name} />
                  </div>
                )}
                <div className="player-name">{player.name}</div>
                <div className="player-team">{player.original_team}</div>
                <div className="player-info">{player.league} | {player.nationality}</div>
                <div className="price">{(player.overall * 100000).toLocaleString()}원</div>
                <div className="button-group">
                  <button
                    className="buy-btn"
                    onClick={() => startNegotiation(player.id)}
                    disabled={loading}
                  >
                    협상하기
                  </button>
                  <button
                    className="profile-btn"
                    onClick={() => navigate(`/player/${player.id}`)}
                  >
                    프로필
                  </button>
                </div>
              </div>
            ))}
          </div>

          {faPlayers.length === 0 && (
            <p className="no-listings">FA 선수가 없습니다.</p>
          )}
        </div>
      )}

      {activeTab === 'market' && (
        <div className="market-section">
          <div className="filter-bar">
            <input
              type="text"
              placeholder="선수 이름 검색"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              className="search-input"
            />

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
                <div className="button-group">
                  <button
                    className="buy-btn"
                    onClick={() => buyCard(listing.listing_id, listing.asking_price)}
                    disabled={loading || !team || team.gold < listing.asking_price}
                  >
                    구매하기
                  </button>
                  <button
                    className="profile-btn"
                    onClick={() => listing.pro_player_id && navigate(`/player/${listing.pro_player_id}`)}
                    disabled={!listing.pro_player_id}
                  >
                    프로필
                  </button>
                </div>
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

      {activeTab === 'release' && (
        <div className="release-section">
          <h2>선수 방출</h2>
          <p className="release-info">선수를 방출하면 계약금의 50%를 환불받습니다.</p>

          <div className="contracted-list">
            {contractedCards.length > 0 ? (
              contractedCards.map((card) => (
                <div key={card.card_id} className="contracted-item">
                  <div className="player-info">
                    <span className="player-name">{card.name}</span>
                    <span
                      className="position"
                      style={{ backgroundColor: getPositionColor(card.position) }}
                    >
                      {card.position}
                    </span>
                    <span className="ovr">OVR {card.ovr}</span>
                    {card.is_starter && <span className="starter-badge">주전</span>}
                  </div>
                  <div className="release-actions">
                    <span className="refund">환불: {Math.floor(card.ovr * 100000 * 0.5).toLocaleString()}원</span>
                    <button
                      className="release-btn"
                      onClick={() => releasePlayer(card.card_id, card.ovr, card.name)}
                      disabled={loading || card.is_starter}
                    >
                      {card.is_starter ? '주전 불가' : '방출'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-listings">계약된 선수가 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="requests-section">
          <div className="requests-columns">
            <div className="requests-column">
              <h2>받은 요청 ({incomingRequests.length})</h2>
              {incomingRequests.length > 0 ? (
                <div className="request-list">
                  {incomingRequests.map((req) => (
                    <div key={req.id} className="request-item incoming">
                      <div className="request-info">
                        <span className="player-name">{req.player_name}</span>
                        <span className="position" style={{ backgroundColor: getPositionColor(req.position) }}>
                          {req.position}
                        </span>
                        <span className="ovr">OVR {req.ovr}</span>
                      </div>
                      <div className="request-details">
                        <p>제안 팀: {req.buyer_team_name}</p>
                        <p>제안 금액: {req.offer_price.toLocaleString()}원</p>
                        {req.status === 'COUNTER' && (
                          <p className="counter-info">역제안: {req.counter_price?.toLocaleString()}원</p>
                        )}
                      </div>
                      <div className="request-actions">
                        <button onClick={() => acceptRequest(req.id)} disabled={loading}>수락</button>
                        <button onClick={() => setCounterModal(req)} disabled={loading}>역제안</button>
                        <button onClick={() => rejectRequest(req.id)} disabled={loading} className="reject">거절</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-listings">받은 요청이 없습니다.</p>
              )}
            </div>

            <div className="requests-column">
              <h2>보낸 요청 ({outgoingRequests.length})</h2>
              {outgoingRequests.length > 0 ? (
                <div className="request-list">
                  {outgoingRequests.map((req) => (
                    <div key={req.id} className={`request-item outgoing ${req.status === 'COUNTER' ? 'has-counter' : ''}`}>
                      <div className="request-info">
                        <span className="player-name">{req.player_name}</span>
                        <span className="position" style={{ backgroundColor: getPositionColor(req.position) }}>
                          {req.position}
                        </span>
                        <span className="ovr">OVR {req.ovr}</span>
                      </div>
                      <div className="request-details">
                        <p>판매 팀: {req.seller_team_name}</p>
                        <p>제안 금액: {req.offer_price.toLocaleString()}원</p>
                        {req.status === 'COUNTER' && (
                          <p className="counter-info">역제안: {req.counter_price?.toLocaleString()}원</p>
                        )}
                      </div>
                      <div className="request-actions">
                        {req.status === 'COUNTER' ? (
                          <button onClick={() => acceptCounter(req.id)} disabled={loading}>역제안 수락</button>
                        ) : (
                          <span className="waiting">대기중</span>
                        )}
                        <button onClick={() => cancelRequest(req.id)} className="cancel">취소</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-listings">보낸 요청이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="browse-teams">
            <h2>다른 팀 선수 영입</h2>
            <div className="team-select">
              <select
                value={selectedTeamId || ''}
                onChange={(e) => {
                  const id = parseInt(e.target.value);
                  setSelectedTeamId(id || null);
                  if (id) fetchTeamPlayers(id);
                }}
              >
                <option value="">팀 선택...</option>
                {allTeams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.league})</option>
                ))}
              </select>
            </div>

            {selectedTeamId && teamPlayers.length > 0 && (
              <div className="team-players-grid">
                {teamPlayers.map((player) => (
                  <div key={player.card_id} className="team-player-card">
                    <div className="card-header">
                      <span className="position" style={{ backgroundColor: getPositionColor(player.position) }}>
                        {player.position}
                      </span>
                      <span className="ovr" style={{ color: getOvrColor(player.ovr) }}>
                        {player.ovr}
                      </span>
                    </div>
                    <div className="player-name">{player.name}</div>
                    <div className="stats">
                      <span>멘탈 {player.mental}</span>
                      <span>팀파 {player.teamfight}</span>
                      <span>집중 {player.focus}</span>
                      <span>라인 {player.laning}</span>
                    </div>
                    {player.is_starter && <span className="starter-badge">주전</span>}
                    <div className="button-group">
                      <button
                        className="request-btn"
                        onClick={() => {
                          setRequestModal({ cardId: player.card_id, playerName: player.name, ovr: player.ovr });
                          setRequestOfferPrice((player.ovr * 150000).toString());
                        }}
                      >
                        이적 요청
                      </button>
                      <button
                        className="profile-btn"
                        onClick={() => player.pro_player_id && navigate(`/player/${player.pro_player_id}`)}
                        disabled={!player.pro_player_id}
                      >
                        프로필
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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

      {/* 협상 모달 */}
      {negotiation && (
        <div className="modal-overlay" onClick={closeNegotiation}>
          <div className="negotiation-modal" onClick={(e) => e.stopPropagation()}>
            <h2>월급 협상</h2>

            <div className="negotiation-player">
              {negotiation.player.face_image && (
                <img src={negotiation.player.face_image} alt={negotiation.player.name} />
              )}
              <div className="player-info">
                <h3>{negotiation.player.name}</h3>
                <span className="position" style={{ backgroundColor: getPositionColor(negotiation.player.position) }}>
                  {negotiation.player.position}
                </span>
                <span className="ovr" style={{ color: getOvrColor(negotiation.player.overall) }}>
                  OVR {negotiation.player.overall}
                </span>
              </div>
            </div>

            <div className="negotiation-stats">
              <div className="stat">멘탈: {negotiation.stats.mental}</div>
              <div className="stat">팀파: {negotiation.stats.teamfight}</div>
              <div className="stat">집중: {negotiation.stats.focus}</div>
              <div className="stat">라인: {negotiation.stats.laning}</div>
            </div>

            <div className="negotiation-personality">
              <span className="personality-type">{negotiation.personality.name}</span>
              <p>{negotiation.personality.description}</p>
            </div>

            <div className="negotiation-price">
              <div className="asking-price">
                요구 월급: <strong>{negotiation.asking_price.toLocaleString()}원</strong>
              </div>

              {negotiationResult?.dialogue && (
                <div className="dialogue-box">
                  "{negotiationResult.dialogue}"
                </div>
              )}

              {negotiationResult?.result === 'ACCEPT' ? (
                <div className="result-accept">
                  <p>계약 완료!</p>
                  <button onClick={closeNegotiation}>확인</button>
                </div>
              ) : negotiationResult?.result === 'REJECT' ? (
                <div className="result-reject">
                  <p>협상 결렬</p>
                  <button onClick={closeNegotiation}>확인</button>
                </div>
              ) : (
                <div className="offer-form">
                  <div className="form-row">
                    <label>계약 등급:</label>
                    <div className="contract-role-buttons">
                      <button
                        className={`role-btn ${contractRole === 'KEY' ? 'active key' : ''}`}
                        onClick={() => setContractRole('KEY')}
                      >
                        중요 선수
                      </button>
                      <button
                        className={`role-btn ${contractRole === 'REGULAR' ? 'active regular' : ''}`}
                        onClick={() => setContractRole('REGULAR')}
                      >
                        일반 선수
                      </button>
                      <button
                        className={`role-btn ${contractRole === 'BACKUP' ? 'active backup' : ''}`}
                        onClick={() => setContractRole('BACKUP')}
                      >
                        후보
                      </button>
                      <button
                        className={`role-btn ${contractRole === 'RESERVE' ? 'active reserve' : ''}`}
                        onClick={() => setContractRole('RESERVE')}
                      >
                        2군
                      </button>
                    </div>
                  </div>
                  <div className="form-row">
                    <label>기본 월급:</label>
                    <input
                      type="number"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <label>계약 기간:</label>
                    <select
                      value={contractYears}
                      onChange={(e) => setContractYears(parseInt(e.target.value))}
                      className="contract-years-select"
                    >
                      <option value={1}>1시즌</option>
                      <option value={2}>2시즌</option>
                      <option value={3}>3시즌</option>
                      <option value={4}>4시즌</option>
                      <option value={5}>5시즌</option>
                    </select>
                  </div>
                  <div className="contract-summary">
                    <p>등급 적용 월급: {Math.floor(parseInt(offerPrice || '0') * contractRoleMultipliers[contractRole]).toLocaleString()}원</p>
                    <p className="contract-cost-info">
                      총 계약금: {Math.floor(parseInt(offerPrice || '0') * contractRoleMultipliers[contractRole] * contractYears).toLocaleString()}원
                    </p>
                  </div>
                  <div className="offer-buttons">
                    <button onClick={submitOffer} disabled={loading}>
                      {loading ? '처리중...' : '제안하기'}
                    </button>
                    <button onClick={closeNegotiation} className="cancel">취소</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 이적 요청 모달 */}
      {requestModal && (
        <div className="modal-overlay" onClick={() => setRequestModal(null)}>
          <div className="negotiation-modal" onClick={(e) => e.stopPropagation()}>
            <h2>이적 요청</h2>
            <div className="request-modal-content">
              <p className="player-info">
                <strong>{requestModal.playerName}</strong> (OVR {requestModal.ovr})
              </p>
              <div className="form-group">
                <label>제안 금액:</label>
                <input
                  type="number"
                  value={requestOfferPrice}
                  onChange={(e) => setRequestOfferPrice(e.target.value)}
                  placeholder="제안 금액"
                />
              </div>
              <div className="form-group">
                <label>메시지 (선택):</label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="판매 팀에게 보낼 메시지"
                  rows={3}
                />
              </div>
              <div className="offer-buttons">
                <button onClick={sendTransferRequest} disabled={loading || !requestOfferPrice}>
                  {loading ? '처리중...' : '요청 보내기'}
                </button>
                <button onClick={() => setRequestModal(null)} className="cancel">취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 역제안 모달 */}
      {counterModal && (
        <div className="modal-overlay" onClick={() => setCounterModal(null)}>
          <div className="negotiation-modal" onClick={(e) => e.stopPropagation()}>
            <h2>역제안</h2>
            <div className="request-modal-content">
              <p className="player-info">
                <strong>{counterModal.player_name}</strong> (OVR {counterModal.ovr})
              </p>
              <p>원래 제안: {counterModal.offer_price.toLocaleString()}원</p>
              <div className="form-group">
                <label>역제안 금액:</label>
                <input
                  type="number"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  placeholder="역제안 금액"
                />
              </div>
              <div className="offer-buttons">
                <button onClick={sendCounter} disabled={loading || !counterPrice}>
                  {loading ? '처리중...' : '역제안 보내기'}
                </button>
                <button onClick={() => setCounterModal(null)} className="cancel">취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
