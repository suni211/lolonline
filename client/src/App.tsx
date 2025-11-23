import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import CreateTeam from './pages/CreateTeam';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
// import Coaches from './pages/Coaches'; // 감독/코치 기능 제거
import Facilities from './pages/Facilities';
import Sponsors from './pages/Sponsors';
import Matches from './pages/Matches';
import Leagues from './pages/Leagues';
import Cup from './pages/Cup';
import TournamentHistory from './pages/TournamentHistory';
import Trades from './pages/Trades';
import Missions from './pages/Missions';
import TeamManagement from './pages/TeamManagement';
import Training from './pages/Training';
import Admin from './pages/Admin';
import MatchViewer from './pages/MatchViewer';
import Tactics from './pages/Tactics';
import Cards from './pages/Cards';
import Transfer from './pages/Transfer';
import FriendlyMatch from './pages/FriendlyMatch';
import LiveMatch from './pages/LiveMatch';
import TeamInfo from './pages/TeamInfo';
import Scout from './pages/Scout';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import GlobalChat from './components/GlobalChat';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/create-team"
            element={
              <ProtectedRoute requireTeam={false}>
                <CreateTeam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <>
                  <Layout />
                  <GlobalChat />
                </>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="players" element={<Players />} />
            <Route path="facilities" element={<Facilities />} />
            <Route path="matches" element={<Matches />} />
            <Route path="leagues" element={<Leagues />} />
            <Route path="cup" element={<Cup />} />
            <Route path="history" element={<TournamentHistory />} />
            <Route path="trades" element={<Trades />} />
            <Route path="missions" element={<Missions />} />
            <Route path="team" element={<TeamManagement />} />
            <Route path="training" element={<Training />} />
            <Route path="sponsors" element={<Sponsors />} />
            <Route path="admin" element={<Admin />} />
            <Route path="match/:matchId" element={<MatchViewer />} />
            <Route path="live/:matchId" element={<LiveMatch />} />
            <Route path="tactics" element={<Tactics />} />
            <Route path="cards" element={<Cards />} />
            <Route path="transfer" element={<Transfer />} />
            <Route path="friendly" element={<FriendlyMatch />} />
            <Route path="team-info" element={<TeamInfo />} />
            <Route path="scout" element={<Scout />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

