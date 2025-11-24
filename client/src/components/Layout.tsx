import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import EventNotification from './EventNotification';
import './Layout.css';

export default function Layout() {
  const { team, logout } = useAuth();
  const location = useLocation();
  const [showEvents, setShowEvents] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30초마다 체크
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get('/api/events/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const handleEventClose = () => {
    setShowEvents(false);
    setUnreadCount(0);
  };

  const navItems = [
    { path: '/dashboard', label: '대시보드' },
    { path: '/players', label: '선수 관리' },
    { path: '/second-team', label: '2군' },
    { path: '/training', label: '훈련' },
    { path: '/mental', label: '멘탈/케미' },
    { path: '/tactics', label: '전략실' },
    { path: '/coaching', label: '코칭스태프' },
    { path: '/facilities', label: '구단 경영' },
    { path: '/sponsors', label: '스폰서' },
    { path: '/finance', label: '재정현황' },
    { path: '/fans-streaming', label: '팬/스트리밍' },
    { path: '/matches', label: '경기' },
    { path: '/friendly', label: '친선전' },
    { path: '/leagues', label: '리그' },
    { path: '/worlds', label: 'WORLDS' },
    { path: '/cup', label: '컵 대회' },
    { path: '/history', label: '대회 정보' },
    { path: '/transfer', label: '이적시장' },
    { path: '/loans', label: '임대시장' },
    { path: '/awards', label: '어워드' },
    { path: '/news', label: '뉴스' },
    { path: '/team-info', label: '팀 정보' },
    { path: '/missions', label: '미션' },
    { path: '/team', label: '팀 관리' },
  ];

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <h1 className="logo">LOLPRO ONLINE</h1>
          <div className="header-info">
            {team && (
              <>
                <span className="team-name">{team.name}</span>
                <span className="currency fans">{(team.fan_count || 1000).toLocaleString()}명</span>
                <span className="currency">{team.gold.toLocaleString()}원</span>
                <span className="currency energy">{team.diamond} 에너지</span>
                <button onClick={() => setShowEvents(true)} className="event-btn">
                  이벤트
                  {unreadCount > 0 && <span className="event-badge">{unreadCount}</span>}
                </button>
              </>
            )}
            <button onClick={logout} className="logout-btn">로그아웃</button>
          </div>
        </div>
      </header>
      <div className="layout-body">
        <nav className="sidebar">
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      {showEvents && <EventNotification onClose={handleEventClose} />}
    </div>
  );
}

