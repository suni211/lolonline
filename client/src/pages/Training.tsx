import { useEffect, useState } from 'react';
import axios from 'axios';
import './Training.css';

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
  is_starter: boolean | number;
  is_contracted: boolean | number;
}

interface TrainingHistory {
  id: number;
  player_name: string;
  training_type: string;
  stat_type: string;
  exp_gained: number;
  stat_increase: number;
  trained_at: string;
}

export default function Training() {
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [selectedStat, setSelectedStat] = useState<'MENTAL' | 'TEAMFIGHT' | 'FOCUS' | 'LANING'>('MENTAL');
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistory[]>([]);

  useEffect(() => {
    fetchCards();
    fetchTrainingHistory();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await axios.get('/api/packs/my-cards');
      setCards(response.data);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    }
  };

  const fetchTrainingHistory = async () => {
    try {
      const response = await axios.get('/api/training/history');
      setTrainingHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch training history:', error);
    }
  };

  const handleIndividualTraining = async () => {
    if (!selectedCard) {
      alert('선수 카드를 선택해주세요.');
      return;
    }

    try {
      await axios.post('/api/training/individual', {
        player_id: selectedCard,
        stat_type: selectedStat
      });
      alert('훈련 완료!');
      fetchCards();
      fetchTrainingHistory();
    } catch (error: any) {
      alert(error.response?.data?.error || '훈련 실패');
    }
  };

  const handleTeamTraining = async () => {
    if (!confirm('스타터 전체를 훈련시키시겠습니까?')) return;

    try {
      await axios.post('/api/training/team', {
        stat_type: selectedStat
      });
      alert('팀 훈련 완료!');
      fetchCards();
      fetchTrainingHistory();
    } catch (error: any) {
      alert(error.response?.data?.error || '훈련 실패');
    }
  };

  // 계약된 카드만 훈련 가능 (MySQL은 boolean을 0/1로 반환)
  const contractedCards = cards.filter(c => c.is_contracted === true || c.is_contracted === 1);
  const starterCards = contractedCards.filter(c => c.is_starter === true || c.is_starter === 1);

  return (
    <div className="training-page page-wrapper">
      <h1 className="page-title">훈련 시스템</h1>

      <div className="training-sections">
        <div className="training-section">
          <h2>개별 훈련</h2>
          <div className="training-form">
            <div className="form-group">
              <label>선수 카드 선택 (계약된 카드만)</label>
              <select
                value={selectedCard || ''}
                onChange={(e) => setSelectedCard(parseInt(e.target.value) || null)}
                className="form-select"
              >
                <option value="">선수 선택</option>
                {contractedCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name} ({card.position}) - OVR: {card.ovr}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>훈련할 스탯</label>
              <select
                value={selectedStat}
                onChange={(e) => setSelectedStat(e.target.value as any)}
                className="form-select"
              >
                <option value="MENTAL">멘탈</option>
                <option value="TEAMFIGHT">팀파이트</option>
                <option value="FOCUS">집중력</option>
                <option value="LANING">라인전</option>
              </select>
            </div>

            {selectedCard && (
              <div className="player-preview">
                <h3>카드 정보</h3>
                {(() => {
                  const card = cards.find(c => c.id === selectedCard);
                  if (!card) return null;
                  return (
                    <div className="preview-stats">
                      <p>현재 {selectedStat === 'MENTAL' ? '멘탈' : selectedStat === 'TEAMFIGHT' ? '팀파이트' : selectedStat === 'FOCUS' ? '집중력' : '라인전'}: {
                        selectedStat === 'MENTAL' ? card.mental :
                        selectedStat === 'TEAMFIGHT' ? card.teamfight :
                        selectedStat === 'FOCUS' ? card.focus :
                        card.laning
                      } / 200</p>
                    </div>
                  );
                })()}
              </div>
            )}

            <button
              onClick={handleIndividualTraining}
              className="btn-primary"
              disabled={!selectedCard}
            >
              개별 훈련 시작
            </button>
          </div>
        </div>

        <div className="training-section">
          <h2>팀 훈련</h2>
          <div className="training-form">
            <div className="form-group">
              <label>훈련할 스탯</label>
              <select
                value={selectedStat}
                onChange={(e) => setSelectedStat(e.target.value as any)}
                className="form-select"
              >
                <option value="MENTAL">멘탈</option>
                <option value="TEAMFIGHT">팀파이트</option>
                <option value="FOCUS">집중력</option>
                <option value="LANING">라인전</option>
              </select>
            </div>

            <div className="team-info">
              <p>스타터: {starterCards.length}명</p>
              <p>계약된 카드: {contractedCards.length}장</p>
            </div>

            <button
              onClick={handleTeamTraining}
              className="btn-primary"
              disabled={starterCards.length === 0}
            >
              팀 훈련 시작 (스타터 {starterCards.length}명)
            </button>
          </div>
        </div>
      </div>

      <div className="training-history-section">
        <h2>훈련 기록</h2>
        <div className="history-list">
          {trainingHistory.length > 0 ? (
            <table className="history-table">
              <thead>
                <tr>
                  <th>선수</th>
                  <th>훈련 종류</th>
                  <th>스탯</th>
                  <th>경험치</th>
                  <th>스탯 증가</th>
                  <th>날짜</th>
                </tr>
              </thead>
              <tbody>
                {trainingHistory.map((history) => (
                  <tr key={history.id}>
                    <td>{history.player_name}</td>
                    <td>{history.training_type === 'INDIVIDUAL' ? '개별' : '팀'}</td>
                    <td>
                      {history.stat_type === 'MENTAL' ? '멘탈' :
                       history.stat_type === 'TEAMFIGHT' ? '팀파이트' :
                       history.stat_type === 'FOCUS' ? '집중력' : '라인전'}
                    </td>
                    <td>+{history.exp_gained}</td>
                    <td>+{history.stat_increase}</td>
                    <td>{new Date(history.trained_at).toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-message">훈련 기록이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

