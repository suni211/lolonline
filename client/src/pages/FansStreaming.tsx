import { useState, useEffect } from 'react';
import axios from 'axios';
import './FansStreaming.css';

interface FanStatus {
  maleFans: number;
  femaleFans: number;
  totalFans: number;
  merchandiseSales: number;
}

interface StreamHistory {
  id: number;
  player_name: string;
  stream_date: string;
  duration_hours: number;
  viewers: number;
  income: number;
  male_fans_gained: number;
  female_fans_gained: number;
  condition_loss: number;
}

interface Player {
  id: number;
  name: string;
  position: string;
  player_condition: number;
  overall: number;
}

interface StreamStats {
  overall: {
    total_streams: number;
    total_viewers: number;
    avg_viewers: number;
    total_income: number;
    total_male_fans: number;
    total_female_fans: number;
  };
  byPlayer: Array<{
    player_card_id: number;
    player_name: string;
    stream_count: number;
    total_income: number;
    avg_viewers: number;
  }>;
}

export default function FansStreaming() {
  const [activeTab, setActiveTab] = useState<'fans' | 'streaming'>('fans');
  const [fanStatus, setFanStatus] = useState<FanStatus | null>(null);
  const [streamHistory, setStreamHistory] = useState<StreamHistory[]>([]);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [streamDuration, setStreamDuration] = useState(2);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fanRes, historyRes, statsRes, playersRes] = await Promise.all([
        axios.get('/api/fans/status'),
        axios.get('/api/streaming/history'),
        axios.get('/api/streaming/stats'),
        axios.get('/api/players/my')
      ]);
      setFanStatus(fanRes.data);
      setStreamHistory(historyRes.data);
      setStreamStats(statsRes.data);
      // /api/players/my는 이미 팀 선수만 반환
      setPlayers(playersRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStream = async () => {
    if (!selectedPlayer) return;

    try {
      setStreaming(true);
      const res = await axios.post('/api/streaming/start', {
        playerCardId: selectedPlayer,
        durationHours: streamDuration
      });
      alert(res.data.message);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || '스트리밍 실패');
    } finally {
      setStreaming(false);
    }
  };

  const handleFanEvent = async (eventType: string) => {
    try {
      const res = await axios.post('/api/fans/event', { eventType });
      alert(res.data.message);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || '이벤트 개최 실패');
    }
  };

  if (loading) {
    return <div className="fans-streaming-page"><div className="loading">로딩 중...</div></div>;
  }

  return (
    <div className="fans-streaming-page">
      <h1>팬 & 스트리밍</h1>

      <div className="tabs">
        <button className={activeTab === 'fans' ? 'active' : ''} onClick={() => setActiveTab('fans')}>
          팬 관리
        </button>
        <button className={activeTab === 'streaming' ? 'active' : ''} onClick={() => setActiveTab('streaming')}>
          스트리밍
        </button>
      </div>

      {activeTab === 'fans' && fanStatus && (
        <div className="fans-section">
          <div className="fan-stats">
            <div className="stat-card">
              <h3>남성 팬</h3>
              <div className="value">{fanStatus.maleFans.toLocaleString()}</div>
              <div className="desc">경기 관중 수입</div>
            </div>
            <div className="stat-card">
              <h3>여성 팬</h3>
              <div className="value">{fanStatus.femaleFans.toLocaleString()}</div>
              <div className="desc">굿즈 판매 수입</div>
            </div>
            <div className="stat-card">
              <h3>총 팬</h3>
              <div className="value">{fanStatus.totalFans.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <h3>굿즈 총 판매</h3>
              <div className="value">{fanStatus.merchandiseSales.toLocaleString()}</div>
            </div>
          </div>

          <div className="fan-events">
            <h2>팬 이벤트</h2>
            <div className="event-list">
              <div className="event-card">
                <h3>팬미팅</h3>
                <p>비용: 5,000,000</p>
                <p>남성 +100, 여성 +200</p>
                <button onClick={() => handleFanEvent('FANMEET')}>개최</button>
              </div>
              <div className="event-card">
                <h3>사인회</h3>
                <p>비용: 3,000,000</p>
                <p>남성 +150, 여성 +100</p>
                <button onClick={() => handleFanEvent('SIGNING')}>개최</button>
              </div>
              <div className="event-card">
                <h3>콘서트</h3>
                <p>비용: 20,000,000</p>
                <p>남성 +300, 여성 +500</p>
                <button onClick={() => handleFanEvent('CONCERT')}>개최</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'streaming' && (
        <div className="streaming-section">
          <div className="stream-control">
            <h2>스트리밍 시작</h2>
            <div className="control-form">
              <select
                value={selectedPlayer || ''}
                onChange={(e) => setSelectedPlayer(Number(e.target.value))}
              >
                <option value="">선수 선택</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.position}) - 컨디션 {p.player_condition}%
                  </option>
                ))}
              </select>
              <select
                value={streamDuration}
                onChange={(e) => setStreamDuration(Number(e.target.value))}
              >
                <option value={1}>1시간</option>
                <option value={2}>2시간</option>
                <option value={3}>3시간</option>
                <option value={4}>4시간</option>
              </select>
              <button onClick={handleStream} disabled={!selectedPlayer || streaming}>
                {streaming ? '스트리밍 중...' : '스트리밍 시작'}
              </button>
            </div>
          </div>

          {streamStats && (
            <div className="stream-stats">
              <h2>스트리밍 통계</h2>
              <div className="stats-grid">
                <div className="stat">총 방송: {streamStats.overall.total_streams || 0}회</div>
                <div className="stat">총 시청자: {(streamStats.overall.total_viewers || 0).toLocaleString()}명</div>
                <div className="stat">평균 시청자: {Math.floor(streamStats.overall.avg_viewers || 0).toLocaleString()}명</div>
                <div className="stat">총 수익: {(streamStats.overall.total_income || 0).toLocaleString()}</div>
              </div>

              {streamStats.byPlayer.length > 0 && (
                <div className="player-stats">
                  <h3>선수별 통계</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>선수</th>
                        <th>방송 수</th>
                        <th>총 수익</th>
                        <th>평균 시청자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {streamStats.byPlayer.map(p => (
                        <tr key={p.player_card_id}>
                          <td>{p.player_name}</td>
                          <td>{p.stream_count}</td>
                          <td>{Number(p.total_income).toLocaleString()}</td>
                          <td>{Math.floor(Number(p.avg_viewers)).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="stream-history">
            <h2>최근 스트리밍</h2>
            {streamHistory.length === 0 ? (
              <p className="empty">스트리밍 기록이 없습니다</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>선수</th>
                    <th>시간</th>
                    <th>시청자</th>
                    <th>수익</th>
                    <th>팬 증가</th>
                  </tr>
                </thead>
                <tbody>
                  {streamHistory.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.stream_date).toLocaleDateString()}</td>
                      <td>{s.player_name}</td>
                      <td>{s.duration_hours}시간</td>
                      <td>{s.viewers.toLocaleString()}</td>
                      <td>{s.income.toLocaleString()}</td>
                      <td>남{s.male_fans_gained} / 여{s.female_fans_gained}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
