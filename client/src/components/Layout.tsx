import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

export default function Layout() {
  const { user, team, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: '대시보드' },
    { path: '/players', label: '선수 관리' },
    { path: '/training', label: '훈련' },
    { path: '/matches', label: '경기' },
    { path: '/leagues', label: '리그' },
    { path: '/trades', label: '이적 시장' },
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
                <span className="currency">골드: {team.gold.toLocaleString()}</span>
                <span className="currency">다이아: {team.diamond}</span>
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
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

