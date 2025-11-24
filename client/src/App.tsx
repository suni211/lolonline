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
// import Training from './pages/Training'; // 훈련 시스템 제거 (자동 레벨업으로 대체)
import Admin from './pages/Admin';
import MatchViewer from './pages/MatchViewer';
import Tactics from './pages/Tactics';
import Transfer from './pages/Transfer';
import News from './pages/News';
import FriendlyMatch from './pages/FriendlyMatch';
import LiveMatch from './pages/LiveMatch';
import TeamInfo from './pages/TeamInfo';
import PlayerProfile from './pages/PlayerProfile';
import FansStreaming from './pages/FansStreaming';
import SecondTeam from './pages/SecondTeam';
import CoachManagement from './pages/CoachManagement';
import MentalChemistry from './pages/MentalChemistry';
import LoanMarket from './pages/LoanMarket';
import Awards from './pages/Awards';
import Worlds from './pages/Worlds';
import Finance from './pages/Finance';
import Community from './pages/Community';
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
            {/* <Route path="training" element={<Training />} /> */}
            {/* 훈련 시스템 제거 (자동 레벨업으로 대체) */}
            <Route path="sponsors" element={<Sponsors />} />
            <Route path="admin" element={<Admin />} />
            <Route path="match/:matchId" element={<MatchViewer />} />
            <Route path="live/:matchId" element={<LiveMatch />} />
            <Route path="tactics" element={<Tactics />} />
            <Route path="transfer" element={<Transfer />} />
            <Route path="news" element={<News />} />
            <Route path="community" element={<Community />} />
            <Route path="friendly" element={<FriendlyMatch />} />
            <Route path="team-info" element={<TeamInfo />} />
            <Route path="player/:playerId" element={<PlayerProfile />} />
            <Route path="fans-streaming" element={<FansStreaming />} />
            <Route path="second-team" element={<SecondTeam />} />
            <Route path="coaching" element={<CoachManagement />} />
            <Route path="mental" element={<MentalChemistry />} />
            <Route path="loans" element={<LoanMarket />} />
            <Route path="awards" element={<Awards />} />
            <Route path="worlds" element={<Worlds />} />
            <Route path="finance" element={<Finance />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

