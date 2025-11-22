import { useState, useEffect } from 'react';
import axios from 'axios';
import './ContractNegotiationModal.css';

interface ContractNegotiationModalProps {
  playerId: number;
  playerName: string;
  playerOverall: number;
  ownedCount?: number; // 다른 팀에 소속되어 있는지 확인 (0 = FA, >0 = 다른 팀 소속)
  onClose: () => void;
  onSuccess: () => void;
}

interface Negotiation {
  id: number;
  player_id: number;
  team_id: number;
  annual_salary: number;
  contract_years: number;
  signing_bonus: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTER_OFFER' | 'EXPIRED';
  ai_response_type: 'ACCEPT' | 'REJECT' | 'COUNTER' | null;
  ai_counter_salary: number | null;
  ai_counter_years: number | null;
  ai_counter_bonus: number | null;
  negotiation_round: number;
  created_at: string;
  responded_at: string | null;
  expires_at: string;
}

export default function ContractNegotiationModal({
  playerId,
  playerName,
  playerOverall,
  ownedCount = 0,
  onClose,
  onSuccess
}: ContractNegotiationModalProps) {
  const [annualSalary, setAnnualSalary] = useState<number>(playerOverall * 1000);
  const [contractYears, setContractYears] = useState<number>(2);
  const [signingBonus, setSigningBonus] = useState<number>(0);
  const [transferFee, setTransferFee] = useState<number>(playerOverall * 5000);
  const [requiresTransferFee, setRequiresTransferFee] = useState(ownedCount > 0);
  const [negotiation, setNegotiation] = useState<Negotiation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const checkExistingNegotiation = async () => {
    try {
      const response = await axios.get(`/api/contracts/${playerId}`);
      if (response.data && response.data.status !== 'EXPIRED') {
        setNegotiation(response.data);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Failed to check negotiation:', error);
      }
    }
  };

  useEffect(() => {
    checkExistingNegotiation();
  }, [playerId]);

  useEffect(() => {
    // 협상이 진행 중일 때만 주기적으로 확인
    if (negotiation && (negotiation.status === 'PENDING' || negotiation.status === 'COUNTER_OFFER')) {
      const interval = setInterval(checkExistingNegotiation, 3000); // 3초마다 확인
      return () => clearInterval(interval);
    }
  }, [negotiation?.status]);

  const handlePropose = async () => {
    if (annualSalary <= 0 || contractYears < 1 || contractYears > 5) {
      setError('올바른 값을 입력해주세요');
      return;
    }

    if (requiresTransferFee && transferFee <= 0) {
      setError('이적료를 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`/api/contracts/${playerId}/propose`, {
        annual_salary: annualSalary,
        contract_years: contractYears,
        signing_bonus: signingBonus,
        transfer_fee: transferFee || undefined
      });

      if (response.data.success) {
        // FA 선수 즉시 계약 성사
        alert(response.data.message || '계약이 성사되었습니다!');
        onSuccess();
        onClose();
        return;
      }

      setRequiresTransferFee(response.data.requires_transfer_fee || false);
      setNegotiation(null);
      setTimeout(() => {
        checkExistingNegotiation();
      }, 2000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || '제안 전송에 실패했습니다';
      setError(errorMsg);
      if (error.response?.data?.requires_transfer_fee) {
        setRequiresTransferFee(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!negotiation) return;

    setLoading(true);
    setError('');

    try {
      await axios.post(`/api/contracts/${negotiation.id}/accept`);
      alert('계약이 성사되었습니다!');
      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.error || '계약 수락에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptCounter = async () => {
    if (!negotiation) return;

    setLoading(true);
    setError('');

    try {
      await axios.post(`/api/contracts/${negotiation.id}/accept-counter`);
      alert('계약이 성사되었습니다!');
      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.error || '계약 수락에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!negotiation) return;

    setLoading(true);
    setError('');

    try {
      await axios.post(`/api/contracts/${negotiation.id}/reject`);
      setNegotiation(null);
    } catch (error: any) {
      setError(error.response?.data?.error || '협상 거절에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCounter = async () => {
    if (!negotiation) return;

    setLoading(true);
    setError('');

    try {
      await axios.post(`/api/contracts/${negotiation.id}/counter`, {
        annual_salary: annualSalary,
        contract_years: contractYears,
        signing_bonus: signingBonus
      });

      setNegotiation(null);
      setTimeout(() => {
        checkExistingNegotiation();
      }, 2000);
    } catch (error: any) {
      setError(error.response?.data?.error || '재제안에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const totalCost = annualSalary * contractYears + signingBonus + (requiresTransferFee ? transferFee : 0);
  const baseSalary = playerOverall * 1000;
  const baseTransferFee = playerOverall * 5000;

  return (
    <div className="contract-negotiation-modal-overlay" onClick={onClose}>
      <div className="contract-negotiation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{playerName} 연봉협상</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {error && <div className="error-message">{error}</div>}

          {!negotiation && (
            <div className="proposal-form">
              <div className="form-section">
                <h3>계약 조건 제안</h3>
                <div className="form-group">
                  <label>연봉 (원)</label>
                  <input
                    type="number"
                    value={annualSalary}
                    onChange={(e) => setAnnualSalary(parseInt(e.target.value) || 0)}
                    min={1}
                    className="form-input"
                  />
                  <div className="form-hint">
                    기준 연봉: {baseSalary.toLocaleString()}원
                    {annualSalary < baseSalary * 0.8 && (
                      <span className="warning"> (낮은 제안)</span>
                    )}
                    {annualSalary > baseSalary * 1.2 && (
                      <span className="success"> (좋은 제안)</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>계약 기간 (년)</label>
                  <select
                    value={contractYears}
                    onChange={(e) => setContractYears(parseInt(e.target.value))}
                    className="form-select"
                  >
                    <option value={1}>1년</option>
                    <option value={2}>2년</option>
                    <option value={3}>3년</option>
                    <option value={4}>4년</option>
                    <option value={5}>5년</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>계약금 (원)</label>
                  <input
                    type="number"
                    value={signingBonus}
                    onChange={(e) => setSigningBonus(parseInt(e.target.value) || 0)}
                    min={0}
                    className="form-input"
                  />
                </div>

                {requiresTransferFee && (
                  <div className="form-group transfer-fee-group">
                    <label>이적료 (원) *필수</label>
                    <input
                      type="number"
                      value={transferFee}
                      onChange={(e) => setTransferFee(parseInt(e.target.value) || 0)}
                      min={1}
                      className="form-input"
                      required
                    />
                    <div className="form-hint">
                      기준 이적료: {baseTransferFee.toLocaleString()}원
                      {transferFee < baseTransferFee * 0.8 && (
                        <span className="warning"> (낮음)</span>
                      )}
                      {transferFee > baseTransferFee * 1.2 && (
                        <span className="success"> (좋음)</span>
                      )}
                    </div>
                    <div className="transfer-fee-notice">
                      <p>이 선수는 다른 팀 소속입니다</p>
                    </div>
                  </div>
                )}

                <div className="cost-summary">
                  <h4>총 비용</h4>
                  <p className="total-cost">{totalCost.toLocaleString()}원</p>
                  <p className="cost-breakdown">
                    연봉 {annualSalary.toLocaleString()} × {contractYears}년 + 계약금 {signingBonus.toLocaleString()}
                    {requiresTransferFee && ` + 이적료 ${transferFee.toLocaleString()}`}
                  </p>
                </div>

                <button
                  onClick={handlePropose}
                  disabled={loading}
                  className="btn-primary btn-full"
                >
                  {loading ? '전송 중...' : '제안 전송'}
                </button>
              </div>
            </div>
          )}

          {negotiation && negotiation.status === 'PENDING' && (
            <div className="negotiation-status">
              <div className="status-pending">
                <h3>제안 전송 완료</h3>
                <p>AI가 제안을 검토 중입니다. 잠시만 기다려주세요...</p>
                <div className="spinner"></div>
              </div>
            </div>
          )}

          {negotiation && negotiation.status === 'ACCEPTED' && (
            <div className="negotiation-status">
              <div className="status-accepted">
                <h3>제안 수락됨</h3>
                <div className="accepted-details">
                  <p>연봉: {negotiation.annual_salary.toLocaleString()}원</p>
                  <p>기간: {negotiation.contract_years}년</p>
                  <p>계약금: {negotiation.signing_bonus.toLocaleString()}원</p>
                  <p>총: {(negotiation.annual_salary * negotiation.contract_years + negotiation.signing_bonus).toLocaleString()}원</p>
                </div>
                <button onClick={handleAccept} className="btn-primary btn-full">
                  계약 확정
                </button>
              </div>
            </div>
          )}

          {negotiation && negotiation.status === 'REJECTED' && (
            <div className="negotiation-status">
              <div className="status-rejected">
                <h3>제안 거절됨</h3>
                <p>더 나은 조건으로 재제안하세요</p>
                <div className="form-group">
                  <label>연봉 (원)</label>
                  <input
                    type="number"
                    value={annualSalary}
                    onChange={(e) => setAnnualSalary(parseInt(e.target.value) || 0)}
                    min={1}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>기간</label>
                  <select
                    value={contractYears}
                    onChange={(e) => setContractYears(parseInt(e.target.value))}
                    className="form-select"
                  >
                    <option value={1}>1년</option>
                    <option value={2}>2년</option>
                    <option value={3}>3년</option>
                    <option value={4}>4년</option>
                    <option value={5}>5년</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>계약금 (원)</label>
                  <input
                    type="number"
                    value={signingBonus}
                    onChange={(e) => setSigningBonus(parseInt(e.target.value) || 0)}
                    min={0}
                    className="form-input"
                  />
                </div>
                <button onClick={handleCounter} disabled={loading} className="btn-primary btn-full">
                  재제안
                </button>
              </div>
            </div>
          )}

          {negotiation && negotiation.status === 'COUNTER_OFFER' && (
            <div className="negotiation-status">
              <div className="status-counter">
                <h3>카운터 오퍼</h3>
                <div className="counter-offer-details">
                  <p>연봉: {negotiation.ai_counter_salary?.toLocaleString()}원</p>
                  <p>기간: {negotiation.ai_counter_years}년</p>
                  <p>계약금: {negotiation.ai_counter_bonus?.toLocaleString()}원</p>
                  <p className="total-cost">
                    총: {((negotiation.ai_counter_salary || 0) * (negotiation.ai_counter_years || 0) + (negotiation.ai_counter_bonus || 0)).toLocaleString()}원
                  </p>
                </div>
                <div className="counter-actions">
                  <button onClick={handleAcceptCounter} className="btn-primary">
                    수락
                  </button>
                  <button onClick={handleReject} className="btn-secondary">
                    거절
                  </button>
                  <button onClick={() => setNegotiation(null)} className="btn-secondary">
                    재제안
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

