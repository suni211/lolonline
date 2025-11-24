import { useEffect, useState } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import './Sponsors.css';

interface Sponsor {
  id: number;
  name: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
  base_payment: number;
  bonus_per_win: number;
  contract_duration_months: number;
  min_team_rank: number;
  min_wins: number;
  description: string;
  already_contracted: number;
}

interface Contract {
  id: number;
  sponsor_id: number;
  name: string;
  tier: string;
  monthly_payment: number;
  bonus_per_win: number;
  contract_start: string;
  contract_end: string;
  total_earnings: number;
  description: string;
}

interface FinancialRecord {
  id: number;
  record_type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  recorded_at: string;
}

interface DailySummary {
  date: string;
  income: number;
  expense: number;
}

interface CategorySummary {
  category: string;
  record_type: string;
  total: number;
}

const tierColors = {
  BRONZE: '#CD7F32',
  SILVER: '#C0C0C0',
  GOLD: '#FFD700',
  PLATINUM: '#E5E4E2',
  DIAMOND: '#B9F2FF'
};

const tierIcons = {
  BRONZE: '🥉',
  SILVER: '🥈',
  GOLD: '🥇',
  PLATINUM: '💎',
  DIAMOND: '👑'
};

const categoryNames: Record<string, string> = {
  MATCH_WIN: '경기 승리',
  SPONSOR: '스폰서',
  FACILITY: '시설 수익',
  PLAYER_SALARY: '선수 연봉',
  COACH_SALARY: '코치 연봉',
  TRANSFER_FEE: '이적료',
  FACILITY_UPGRADE: '시설 업그레이드',
  FACILITY_MAINTENANCE: '시설 유지비',
  OTHER: '기타'
};

const CHART_COLORS = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#f87171', '#38bdf8', '#4ade80'];

export default function Sponsors() {
  const [activeTab, setActiveTab] = useState<'sponsors' | 'contracts' | 'financial'>('sponsors');
  const [availableSponsors, setAvailableSponsors] = useState<Sponsor[]>([]);
  const [myContracts, setMyContracts] = useState<Contract[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'sponsors') {
        const response = await axios.get('/api/sponsors/available');
        setAvailableSponsors(response.data);
      } else if (activeTab === 'contracts') {
        const response = await axios.get('/api/sponsors/my');
        setMyContracts(response.data);
      } else {
        const response = await axios.get('/api/sponsors/financial-history?season=current');
        setFinancialRecords(response.data.records);
        setDailySummary(response.data.dailySummary);
        setCategorySummary(response.data.categorySummary);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleSignSponsor = async (sponsorId: number) => {
    if (!confirm('이 스폰서와 계약하시겠습니까?')) return;

    setLoading(true);
    try {
      const response = await axios.post(`/api/sponsors/${sponsorId}/sign`);
      alert(response.data.message);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || '계약 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateContract = async (contractId: number) => {
    setLoading(true);
    try {
      // 먼저 위약금 조회
      const penaltyResponse = await axios.get(`/api/sponsors/${contractId}/penalty`);
      const { penaltyFee, remainingMonths } = penaltyResponse.data;

      const confirmMessage = penaltyFee > 0
        ? `정말 계약을 해지하시겠습니까?\n\n남은 기간: ${remainingMonths}개월\n위약금: ${penaltyFee.toLocaleString()} 원`
        : '정말 계약을 해지하시겠습니까?';

      if (!confirm(confirmMessage)) {
        setLoading(false);
        return;
      }

      const response = await axios.post(`/api/sponsors/${contractId}/terminate`);
      const message = response.data.penaltyFee > 0
        ? `${response.data.message}\n위약금 ${response.data.penaltyFee.toLocaleString()} 원가 차감되었습니다.`
        : response.data.message;
      alert(message);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || '해지 실패');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // 수입/지출 합계 계산
  const totalIncome = categorySummary
    .filter(c => c.record_type === 'INCOME')
    .reduce((sum, c) => sum + c.total, 0);
  const totalExpense = categorySummary
    .filter(c => c.record_type === 'EXPENSE')
    .reduce((sum, c) => sum + c.total, 0);

  // 파이 차트 데이터
  const incomeData = categorySummary
    .filter(c => c.record_type === 'INCOME')
    .map(c => ({ name: categoryNames[c.category] || c.category, value: c.total }));
  const expenseData = categorySummary
    .filter(c => c.record_type === 'EXPENSE')
    .map(c => ({ name: categoryNames[c.category] || c.category, value: c.total }));

  return (
    <div className="sponsors-page">
      <div className="page-header">
        <h1 className="page-title">스폰서 & 재정</h1>
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'sponsors' ? 'tab-active' : 'tab-btn'}
          onClick={() => setActiveTab('sponsors')}
        >
          스폰서 찾기
        </button>
        <button
          className={activeTab === 'contracts' ? 'tab-active' : 'tab-btn'}
          onClick={() => setActiveTab('contracts')}
        >
          내 계약 ({myContracts.length})
        </button>
        <button
          className={activeTab === 'financial' ? 'tab-active' : 'tab-btn'}
          onClick={() => setActiveTab('financial')}
        >
          재정 현황
        </button>
      </div>

      {activeTab === 'sponsors' && (
        <div className="sponsors-grid">
          {availableSponsors.length === 0 ? (
            <div className="empty-message">
              사용 가능한 스폰서가 없습니다. 순위를 올리거나 더 많은 경기를 승리하세요!
            </div>
          ) : (
            availableSponsors.map(sponsor => (
              <div
                key={sponsor.id}
                className={`sponsor-card tier-${sponsor.tier.toLowerCase()}`}
                style={{ borderColor: tierColors[sponsor.tier] }}
              >
                <div className="sponsor-header">
                  <span className="tier-icon">{tierIcons[sponsor.tier]}</span>
                  <div>
                    <h3>{sponsor.name}</h3>
                    <span className="tier-badge" style={{ backgroundColor: tierColors[sponsor.tier] }}>
                      {sponsor.tier}
                    </span>
                  </div>
                </div>

                <p className="sponsor-description">{sponsor.description}</p>

                <div className="sponsor-details">
                  <div className="detail-row">
                    <span>월 지급액</span>
                    <span className="value">{sponsor.base_payment.toLocaleString()} 원</span>
                  </div>
                  <div className="detail-row">
                    <span>승리 보너스</span>
                    <span className="value">+{sponsor.bonus_per_win.toLocaleString()} 원</span>
                  </div>
                  <div className="detail-row">
                    <span>계약 기간</span>
                    <span className="value">{sponsor.contract_duration_months}개월</span>
                  </div>
                  <div className="detail-row requirements">
                    <span>요구 조건</span>
                    <span className="value">
                      {sponsor.min_team_rank}위 이상 / {sponsor.min_wins}승 이상
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleSignSponsor(sponsor.id)}
                  disabled={loading || sponsor.already_contracted > 0}
                  className={sponsor.already_contracted > 0 ? 'btn-secondary' : 'btn-primary'}
                >
                  {sponsor.already_contracted > 0 ? '계약 중' : '계약하기'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'contracts' && (
        <div className="contracts-section">
          {myContracts.length === 0 ? (
            <div className="empty-message">
              현재 계약 중인 스폰서가 없습니다.
            </div>
          ) : (
            <div className="contracts-grid">
              {myContracts.map(contract => (
                <div key={contract.id} className="contract-card">
                  <div className="contract-header">
                    <h3>{contract.name}</h3>
                    <span className="tier-badge">{contract.tier}</span>
                  </div>

                  <div className="contract-details">
                    <div className="detail-row">
                      <span>월 지급액</span>
                      <span className="value">{contract.monthly_payment.toLocaleString()} 원</span>
                    </div>
                    <div className="detail-row">
                      <span>승리 보너스</span>
                      <span className="value">+{contract.bonus_per_win.toLocaleString()} 원</span>
                    </div>
                    <div className="detail-row">
                      <span>총 수익</span>
                      <span className="value total">{contract.total_earnings.toLocaleString()} 원</span>
                    </div>
                    <div className="detail-row">
                      <span>계약 기간</span>
                      <span className="value">
                        {formatDate(contract.contract_start)} ~ {formatDate(contract.contract_end)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTerminateContract(contract.id)}
                    disabled={loading}
                    className="btn-danger"
                  >
                    계약 해지
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="financial-section">
          <div className="financial-summary">
            <div className="summary-card income">
              <h4>총 수입 (시즌)</h4>
              <p className="amount">+{totalIncome.toLocaleString()} 원</p>
            </div>
            <div className="summary-card expense">
              <h4>총 지출 (시즌)</h4>
              <p className="amount">-{totalExpense.toLocaleString()} 원</p>
            </div>
            <div className="summary-card net">
              <h4>순수익</h4>
              <p className={`amount ${totalIncome - totalExpense >= 0 ? 'positive' : 'negative'}`}>
                {(totalIncome - totalExpense >= 0 ? '+' : '')}{(totalIncome - totalExpense).toLocaleString()} 원
              </p>
            </div>
          </div>

          <div className="chart-section">
            <h3>일별 수입/지출 추이</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailySummary}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#fff' }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fill: '#fff' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #1e3a8a', color: '#fff' }}
                    formatter={(value: number) => [value.toLocaleString() + ' 원']}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="income" name="수입" stroke="#34d399" fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expense" name="지출" stroke="#f87171" fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pie-charts-section">
            <div className="pie-chart-container">
              <h3>수입 구성</h3>
              {incomeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={incomeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {incomeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString() + ' 원'} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty-message">수입 기록이 없습니다</p>
              )}
            </div>

            <div className="pie-chart-container">
              <h3>지출 구성</h3>
              {expenseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={expenseData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {expenseData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString() + ' 원'} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty-message">지출 기록이 없습니다</p>
              )}
            </div>
          </div>

          <div className="records-section">
            <h3>최근 거래 내역</h3>
            <div className="records-list">
              {financialRecords.slice(0, 20).map(record => (
                <div key={record.id} className={`record-item ${record.record_type.toLowerCase()}`}>
                  <div className="record-info">
                    <span className="record-category">{categoryNames[record.category] || record.category}</span>
                    <span className="record-description">{record.description}</span>
                  </div>
                  <div className="record-amount">
                    <span className={record.record_type === 'INCOME' ? 'positive' : 'negative'}>
                      {record.record_type === 'INCOME' ? '+' : '-'}{record.amount.toLocaleString()} 원
                    </span>
                    <span className="record-date">{formatDate(record.recorded_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
