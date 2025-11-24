import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Trades.css';

interface Trade {
  id: number;
  player_name: string;
  position: string;
  overall: number;
  price_gold: number;
  price_diamond: number;
  seller_team_name: string;
  status: string;
}

export default function Trades() {
  const { team } = useAuth();
  const [market, setMarket] = useState<Trade[]>([]);
  const [myTrades, setMyTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<'market' | 'my' | 'exchange'>('market');
  const [exchangeType, setExchangeType] = useState<'GOLD_TO_DIAMOND' | 'DIAMOND_TO_GOLD'>('GOLD_TO_DIAMOND');
  const [exchangeAmount, setExchangeAmount] = useState('');

  useEffect(() => {
    fetchMarket();
    fetchMyTrades();
  }, []);

  const fetchMarket = async () => {
    try {
      const response = await axios.get('/api/trades/market');
      setMarket(response.data);
    } catch (error) {
      console.error('Failed to fetch market:', error);
    }
  };

  const fetchMyTrades = async () => {
    try {
      const response = await axios.get('/api/trades/my');
      setMyTrades(response.data);
    } catch (error) {
      console.error('Failed to fetch my trades:', error);
    }
  };

  const handleBuy = async (tradeId: number) => {
    if (!confirm('이 선수를 구매하시겠습니까?')) return;

    try {
      await axios.post(`/api/trades/buy/${tradeId}`);
      alert('구매 완료!');
      fetchMarket();
      fetchMyTrades();
    } catch (error: any) {
      alert(error.response?.data?.error || '구매 실패');
    }
  };

  const handleCancel = async (tradeId: number) => {
    if (!confirm('거래를 취소하시겠습니까?')) return;

    try {
      await axios.post(`/api/trades/cancel/${tradeId}`);
      alert('거래 취소 완료');
      fetchMyTrades();
    } catch (error: any) {
      alert(error.response?.data?.error || '취소 실패');
    }
  };

  const handleExchange = async () => {
    if (!exchangeAmount || parseInt(exchangeAmount) <= 0) {
      alert('올바른 금액을 입력하세요.');
      return;
    }

    try {
      await axios.post('/api/trades/exchange', {
        exchange_type: exchangeType,
        amount: parseInt(exchangeAmount)
      });
      alert('교환 완료!');
      setExchangeAmount('');
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.error || '교환 실패');
    }
  };

  return (
    <div className="trades-page">
      <h1 className="page-title">이적 시장</h1>

      <div className="tabs">
        <button
          onClick={() => setActiveTab('market')}
          className={activeTab === 'market' ? 'tab-active' : ''}
        >
          이적 시장
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={activeTab === 'my' ? 'tab-active' : ''}
        >
          내 거래
        </button>
        <button
          onClick={() => setActiveTab('exchange')}
          className={activeTab === 'exchange' ? 'tab-active' : ''}
        >
          재화 교환
        </button>
      </div>

      {activeTab === 'market' && (
        <div className="market-section">
          <h2>이적 시장</h2>
          <div className="trades-grid">
            {market.map((trade) => (
              <div key={trade.id} className="trade-card">
                <h3>{trade.player_name}</h3>
                <p className="position">{trade.position}</p>
                <p className="overall">오버롤: {trade.overall}</p>
                <div className="price">
                  {trade.price_gold && <span>원: {trade.price_gold.toLocaleString()}</span>}
                  {trade.price_diamond && <span>다이아: {trade.price_diamond}</span>}
                </div>
                <p className="seller">판매자: {trade.seller_team_name}</p>
                <button onClick={() => handleBuy(trade.id)} className="btn-primary">
                  구매
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'my' && (
        <div className="my-trades-section">
          <h2>내 거래</h2>
          <div className="trades-grid">
            {myTrades.map((trade) => (
              <div key={trade.id} className="trade-card">
                <h3>{trade.player_name}</h3>
                <p className="position">{trade.position}</p>
                <p className="overall">오버롤: {trade.overall}</p>
                <div className="price">
                  {trade.price_gold && <span>원: {trade.price_gold.toLocaleString()}</span>}
                  {trade.price_diamond && <span>다이아: {trade.price_diamond}</span>}
                </div>
                <p className="status">상태: {trade.status}</p>
                {trade.status === 'LISTED' && (
                  <button onClick={() => handleCancel(trade.id)} className="btn-secondary">
                    취소
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'exchange' && (
        <div className="exchange-section">
          <h2>재화 교환</h2>
          <div className="exchange-box">
            <div className="exchange-options">
              <label>
                <input
                  type="radio"
                  value="GOLD_TO_DIAMOND"
                  checked={exchangeType === 'GOLD_TO_DIAMOND'}
                  onChange={(e) => setExchangeType(e.target.value as any)}
                />
                원 → 다이아몬드 (1,000원 = 1다이아)
              </label>
              <label>
                <input
                  type="radio"
                  value="DIAMOND_TO_GOLD"
                  checked={exchangeType === 'DIAMOND_TO_GOLD'}
                  onChange={(e) => setExchangeType(e.target.value as any)}
                />
                다이아몬드 → 원 (1다이아 = 1,000원)
              </label>
            </div>
            <div className="exchange-input">
              <input
                type="number"
                placeholder="금액 입력"
                value={exchangeAmount}
                onChange={(e) => setExchangeAmount(e.target.value)}
              />
              <button onClick={handleExchange} className="btn-primary">
                교환
              </button>
            </div>
            {team && (
              <div className="current-balance">
                <p>현재 보유: 원 {team.gold.toLocaleString()} | 다이아 {team.diamond}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

