import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import './Finance.css';

interface FinanceSummary {
  balance: {
    gold: number;
    diamond: number;
  };
  monthlyIncome: {
    sponsors: number;
    matches: number;
    streaming: number;
    merchandise: number;
  };
  monthlyExpense: {
    salaries: number;
  };
  stats: {
    matchCount: number;
    streamCount: number;
    fanCount: number;
  };
}

interface Transaction {
  id: number;
  type: string;
  description: string;
  amount: number;
  date: string;
  category: string;
}

interface DailyStats {
  date: string;
  income: number;
  expense: number;
  net: number;
}

interface BreakdownItem {
  name: string;
  value: number;
}

const INCOME_COLORS = ['#4CAF50', '#8BC34A', '#CDDC39', '#FFC107'];
const EXPENSE_COLORS = ['#f44336', '#FF5722', '#FF9800'];

export default function Finance() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState<BreakdownItem[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, transactionsRes, dailyRes, incomeRes, expenseRes] = await Promise.all([
        axios.get('/api/finance/summary'),
        axios.get('/api/finance/transactions'),
        axios.get('/api/finance/daily-stats'),
        axios.get('/api/finance/income-breakdown'),
        axios.get('/api/finance/expense-breakdown')
      ]);

      setSummary(summaryRes.data);
      setTransactions(transactionsRes.data);
      setDailyStats(dailyRes.data);
      setIncomeBreakdown(incomeRes.data);
      setExpenseBreakdown(expenseRes.data);
    } catch (error) {
      console.error('Failed to fetch finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatGold = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}억`;
    } else if (value >= 10000) {
      return `${(value / 10000).toFixed(0)}만`;
    }
    return value.toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'MATCH': return '🏆';
      case 'STREAMING': return '📺';
      case 'TRANSFER': return '📝';
      case 'TRAINING': return '💪';
      case 'FACILITY': return '🏗️';
      default: return '💰';
    }
  };

  if (loading) {
    return (
      <div className="finance-container">
        <div className="loading">재정 정보를 불러오는 중...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="finance-container">
        <div className="error">재정 정보를 불러올 수 없습니다.</div>
      </div>
    );
  }

  const totalMonthlyIncome =
    summary.monthlyIncome.sponsors +
    summary.monthlyIncome.matches +
    summary.monthlyIncome.streaming +
    summary.monthlyIncome.merchandise;

  const totalMonthlyExpense = summary.monthlyExpense.salaries;
  const netIncome = totalMonthlyIncome - totalMonthlyExpense;

  return (
    <div className="finance-container">
      <h1>재정 현황</h1>

      <div className="finance-tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          개요
        </button>
        <button
          className={activeTab === 'transactions' ? 'active' : ''}
          onClick={() => setActiveTab('transactions')}
        >
          거래 내역
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* 잔액 카드 */}
          <div className="balance-cards">
            <div className="balance-card gold">
              <div className="balance-label">골드</div>
              <div className="balance-value">{formatGold(summary.balance.gold)}</div>
            </div>
            <div className="balance-card diamond">
              <div className="balance-label">다이아몬드</div>
              <div className="balance-value">{summary.balance.diamond.toLocaleString()}</div>
            </div>
            <div className={`balance-card ${netIncome >= 0 ? 'positive' : 'negative'}`}>
              <div className="balance-label">월 순이익</div>
              <div className="balance-value">
                {netIncome >= 0 ? '+' : ''}{formatGold(netIncome)}
              </div>
            </div>
          </div>

          {/* 월간 수입/지출 요약 */}
          <div className="finance-summary-grid">
            <div className="summary-card income">
              <h3>월간 수입</h3>
              <div className="summary-total">{formatGold(totalMonthlyIncome)}</div>
              <div className="summary-details">
                <div className="detail-item">
                  <span>스폰서</span>
                  <span>{formatGold(summary.monthlyIncome.sponsors)}</span>
                </div>
                <div className="detail-item">
                  <span>경기 수입</span>
                  <span>{formatGold(summary.monthlyIncome.matches)}</span>
                </div>
                <div className="detail-item">
                  <span>스트리밍</span>
                  <span>{formatGold(summary.monthlyIncome.streaming)}</span>
                </div>
                <div className="detail-item">
                  <span>굿즈 판매</span>
                  <span>{formatGold(summary.monthlyIncome.merchandise)}</span>
                </div>
              </div>
            </div>

            <div className="summary-card expense">
              <h3>월간 지출</h3>
              <div className="summary-total">{formatGold(totalMonthlyExpense)}</div>
              <div className="summary-details">
                <div className="detail-item">
                  <span>선수 급여</span>
                  <span>{formatGold(summary.monthlyExpense.salaries)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 차트 섹션 */}
          <div className="charts-section">
            {/* 일별 수입/지출 추이 */}
            <div className="chart-card full-width">
              <h3>최근 30일 수입/지출 추이</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="#888"
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={formatGold}
                    stroke="#888"
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: number) => formatGold(value)}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('ko-KR')}
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="수입"
                    stroke="#4CAF50"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="지출"
                    stroke="#f44336"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 수입 분석 파이 차트 */}
            <div className="chart-card">
              <h3>수입 구성</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={incomeBreakdown.filter(item => item.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {incomeBreakdown.map((_, index) => (
                      <Cell
                        key={`income-cell-${index}`}
                        fill={INCOME_COLORS[index % INCOME_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatGold(value)}
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 지출 분석 파이 차트 */}
            <div className="chart-card">
              <h3>지출 구성</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={expenseBreakdown.filter(item => item.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {expenseBreakdown.map((_, index) => (
                      <Cell
                        key={`expense-cell-${index}`}
                        fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatGold(value)}
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 순이익 바 차트 */}
            <div className="chart-card full-width">
              <h3>일별 순이익</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="#888"
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={formatGold}
                    stroke="#888"
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: number) => formatGold(value)}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('ko-KR')}
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }}
                  />
                  <Bar dataKey="net" name="순이익">
                    {dailyStats.map((entry, index) => (
                      <Cell
                        key={`net-cell-${index}`}
                        fill={entry.net >= 0 ? '#4CAF50' : '#f44336'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 통계 요약 */}
          <div className="stats-summary">
            <div className="stat-item">
              <span className="stat-label">이번 달 경기 수</span>
              <span className="stat-value">{summary.stats.matchCount}경기</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">이번 달 스트리밍</span>
              <span className="stat-value">{summary.stats.streamCount}회</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">현재 팬 수</span>
              <span className="stat-value">{summary.stats.fanCount.toLocaleString()}명</span>
            </div>
          </div>
        </>
      )}

      {activeTab === 'transactions' && (
        <div className="transactions-section">
          <h3>최근 거래 내역</h3>
          <div className="transactions-list">
            {transactions.length === 0 ? (
              <div className="no-transactions">거래 내역이 없습니다.</div>
            ) : (
              transactions.map((tx) => (
                <div
                  key={`${tx.type}-${tx.id}`}
                  className={`transaction-item ${tx.amount >= 0 ? 'income' : 'expense'}`}
                >
                  <div className="transaction-icon">
                    {getTransactionIcon(tx.type)}
                  </div>
                  <div className="transaction-info">
                    <div className="transaction-desc">{tx.description}</div>
                    <div className="transaction-date">
                      {new Date(tx.date).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div className={`transaction-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`}>
                    {tx.amount >= 0 ? '+' : ''}{formatGold(tx.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
