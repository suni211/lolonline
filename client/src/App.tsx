import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import Matches from './pages/Matches';
import Leagues from './pages/Leagues';
import Trades from './pages/Trades';
import Missions from './pages/Missions';
import TeamManagement from './pages/TeamManagement';
import Training from './pages/Training';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="players" element={<Players />} />
            <Route path="matches" element={<Matches />} />
            <Route path="leagues" element={<Leagues />} />
            <Route path="trades" element={<Trades />} />
            <Route path="missions" element={<Missions />} />
            <Route path="team" element={<TeamManagement />} />
            <Route path="training" element={<Training />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

