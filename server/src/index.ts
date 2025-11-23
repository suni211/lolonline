import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { Server } from 'socket.io';
import { createServer } from 'http';
import authRoutes from './routes/auth.js';
import teamRoutes from './routes/teams.js';
import playerRoutes from './routes/players.js';
import matchRoutes from './routes/matches.js';
import leagueRoutes from './routes/leagues.js';
import tradeRoutes from './routes/trades.js';
import missionRoutes from './routes/missions.js';
import friendlyMatchRoutes from './routes/friendlyMatches.js';
import combinationRoutes from './routes/combinations.js';
import trainingRoutes from './routes/training.js';
import contractNegotiationRoutes from './routes/contractNegotiations.js';
import coachRoutes from './routes/coaches.js';
import facilityRoutes, { initializeFacilityRevenue } from './routes/facilities.js';
import sponsorRoutes from './routes/sponsors.js';
import eventRoutes from './routes/events.js';
import adminRoutes from './routes/admin.js';
import tacticsRoutes from './routes/tactics.js';
// import packsRoutes from './routes/packs.js'; // 카드깡 제거, 스카우트로 대체
import transferRoutes from './routes/transfer.js';
import aiRoutes from './routes/ai.js';
import scoutRoutes from './routes/scout.js';
import cupRoutes from './routes/cup.js';
import { initializeDatabase } from './database/init.js';
import { ProPlayerService } from './services/proPlayerService.js';
import { initializeSeasonSystem } from './services/seasonService.js';
import { initializeMatchSimulation } from './services/matchSimulationService.js';
import { initializeInjurySystem } from './services/injuryService.js';
import { initializeConditionRecovery } from './services/conditionService.js';
import { initializeLeagueMatchService } from './services/leagueMatchService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*', // 개발 환경에서는 모든 origin 허용
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// uploads 폴더 정적 파일 서빙 (선수 이미지 등)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// IP 주소 추출을 위한 미들웨어
app.set('trust proxy', true);

// 라우트
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/contracts', contractNegotiationRoutes);
app.use('/api/coaches', coachRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/friendly-matches', friendlyMatchRoutes);
app.use('/api/combinations', combinationRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/sponsors', sponsorRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tactics', tacticsRoutes);
// app.use('/api/packs', packsRoutes); // 카드깡 제거, 스카우트로 대체
app.use('/api/transfer', transferRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/scout', scoutRoutes);
app.use('/api/cup', cupRoutes);

// Socket.IO 연결
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe_match', (matchId: number) => {
    socket.join(`match_${matchId}`);
  });

  socket.on('unsubscribe_match', (matchId: number) => {
    socket.leave(`match_${matchId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Socket.IO를 전역으로 사용할 수 있도록 설정
app.set('io', io);

const PORT = parseInt(process.env.PORT || '5000', 10);

// 데이터베이스 초기화 및 서버 시작
async function startServer() {
  try {
    await initializeDatabase();
    await initializeSeasonSystem();
    await initializeMatchSimulation(io);
    initializeInjurySystem();
    initializeConditionRecovery();
    initializeFacilityRevenue();
    initializeLeagueMatchService();

    // 프로 선수 및 선수팩 초기화
    await ProPlayerService.initializeProPlayers();
    await ProPlayerService.initializePlayerPacks();
    
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Server accessible at http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { io };

