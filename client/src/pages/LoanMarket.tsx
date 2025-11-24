import { useState, useEffect } from 'react';
import axios from 'axios';
import './LoanMarket.css';

interface LoanPlayer {
  id: number;
  name: string;
  position: string;
  overall: number;
  team_name: string;
  owner_team_id: number;
}

interface Loan {
  id: number;
  player_card_id: number;
  name: string;
  position: string;
  overall: number;
  from_team_name?: string;
  to_team_name?: string;
  loan_fee: number;
  salary_share_percent: number;
  start_date: string;
  end_date: string;
}

export default function LoanMarket() {
  const [activeTab, setActiveTab] = useState<'available' | 'incoming' | 'outgoing'>('available');
  const [availablePlayers, setAvailablePlayers] = useState<LoanPlayer[]>([]);
  const [incomingLoans, setIncomingLoans] = useState<Loan[]>([]);
  const [outgoingLoans, setOutgoingLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<LoanPlayer | null>(null);
  const [loanMonths, setLoanMonths] = useState(6);
  const [salaryShare, setSalaryShare] = useState(50);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [availableRes, incomingRes, outgoingRes] = await Promise.all([
        axios.get('/api/loans/available'),
        axios.get('/api/loans/incoming'),
        axios.get('/api/loans/outgoing')
      ]);
      setAvailablePlayers(availableRes.data);
      setIncomingLoans(incomingRes.data);
      setOutgoingLoans(outgoingRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoan = async () => {
    if (!selectedPlayer) return;

    try {
      setActionLoading(true);
      const res = await axios.post('/api/loans/request', {
        playerCardId: selectedPlayer.id,
        loanMonths,
        salarySharePercent: salaryShare
      });
      alert(res.data.message);
      setSelectedPlayer(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || '임대 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndLoan = async (loanId: number) => {
    if (!confirm('임대를 종료하시겠습니까?')) return;

    try {
      setActionLoading(true);
      const res = await axios.post(`/api/loans/end/${loanId}`);
      alert(res.data.message);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || '임대 종료 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'TOP': return '#ff6b6b';
      case 'JUNGLE': return '#4ecdc4';
      case 'MID': return '#45b7d1';
      case 'ADC': return '#f9ca24';
      case 'SUPPORT': return '#a29bfe';
      default: return '#888';
    }
  };

  if (loading) {
    return <div className="loan-market-page"><div className="loading">로딩 중...</div></div>;
  }

  return (
    <div className="loan-market-page">
      <h1>임대 시장</h1>

      <div className="tabs">
        <button className={activeTab === 'available' ? 'active' : ''} onClick={() => setActiveTab('available')}>
          임대 가능 ({availablePlayers.length})
        </button>
        <button className={activeTab === 'incoming' ? 'active' : ''} onClick={() => setActiveTab('incoming')}>
          임대 받은 선수 ({incomingLoans.length})
        </button>
        <button className={activeTab === 'outgoing' ? 'active' : ''} onClick={() => setActiveTab('outgoing')}>
          임대 보낸 선수 ({outgoingLoans.length})
        </button>
      </div>

      {activeTab === 'available' && (
        <div className="player-list">
          {availablePlayers.length === 0 ? (
            <p className="empty">임대 가능한 선수가 없습니다</p>
          ) : (
            <div className="player-grid">
              {availablePlayers.map(player => (
                <div
                  key={player.id}
                  className="player-card"
                  onClick={() => setSelectedPlayer(player)}
                >
                  <div className="position" style={{ color: getPositionColor(player.position) }}>
                    {player.position}
                  </div>
                  <div className="name">{player.name}</div>
                  <div className="overall">OVR {player.overall}</div>
                  <div className="team">{player.team_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'incoming' && (
        <div className="loan-list">
          {incomingLoans.length === 0 ? (
            <p className="empty">임대 받은 선수가 없습니다</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>선수</th>
                  <th>포지션</th>
                  <th>OVR</th>
                  <th>원 소속</th>
                  <th>임대 종료</th>
                  <th>급여 분담</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {incomingLoans.map(loan => (
                  <tr key={loan.id}>
                    <td>{loan.name}</td>
                    <td style={{ color: getPositionColor(loan.position) }}>{loan.position}</td>
                    <td>{loan.overall}</td>
                    <td>{loan.from_team_name}</td>
                    <td>{new Date(loan.end_date).toLocaleDateString()}</td>
                    <td>{loan.salary_share_percent}%</td>
                    <td>
                      <button onClick={() => handleEndLoan(loan.id)} disabled={actionLoading}>
                        종료
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'outgoing' && (
        <div className="loan-list">
          {outgoingLoans.length === 0 ? (
            <p className="empty">임대 보낸 선수가 없습니다</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>선수</th>
                  <th>포지션</th>
                  <th>OVR</th>
                  <th>임대 팀</th>
                  <th>임대 종료</th>
                  <th>임대료</th>
                </tr>
              </thead>
              <tbody>
                {outgoingLoans.map(loan => (
                  <tr key={loan.id}>
                    <td>{loan.name}</td>
                    <td style={{ color: getPositionColor(loan.position) }}>{loan.position}</td>
                    <td>{loan.overall}</td>
                    <td>{loan.to_team_name}</td>
                    <td>{new Date(loan.end_date).toLocaleDateString()}</td>
                    <td>{loan.loan_fee.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedPlayer && (
        <div className="loan-modal" onClick={() => setSelectedPlayer(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{selectedPlayer.name} 임대</h2>
            <div className="player-info">
              <span style={{ color: getPositionColor(selectedPlayer.position) }}>
                {selectedPlayer.position}
              </span>
              <span>OVR {selectedPlayer.overall}</span>
              <span>{selectedPlayer.team_name}</span>
            </div>
            <div className="loan-options">
              <label>
                임대 기간
                <select value={loanMonths} onChange={e => setLoanMonths(Number(e.target.value))}>
                  <option value={3}>3개월</option>
                  <option value={6}>6개월</option>
                  <option value={12}>12개월</option>
                </select>
              </label>
              <label>
                급여 분담 (%)
                <select value={salaryShare} onChange={e => setSalaryShare(Number(e.target.value))}>
                  <option value={25}>25%</option>
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100%</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={handleLoan} disabled={actionLoading}>
                {actionLoading ? '처리 중...' : '임대 요청'}
              </button>
              <button className="cancel" onClick={() => setSelectedPlayer(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
