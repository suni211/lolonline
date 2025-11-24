import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireTeam?: boolean;
}

export default function ProtectedRoute({ children, requireTeam = true }: ProtectedRouteProps) {
  const { token, team, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 어드민은 팀 없이도 접근 가능
  const isAdmin = user?.isAdmin || false;

  // 팀이 필요한 페이지인데 팀이 없으면 팀 생성 페이지로 이동 (어드민 제외)
  if (requireTeam && !team && !isAdmin && location.pathname !== '/create-team') {
    return <Navigate to="/create-team" replace />;
  }

  // 팀 생성 페이지인데 이미 팀이 있거나 어드민이면 대시보드로 이동
  if (!requireTeam && (team || isAdmin) && location.pathname === '/create-team') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

