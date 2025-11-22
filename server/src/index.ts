import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import { initializeDatabase } from './database/init.js';
import { initializeSeasonSystem } from './services/seasonService.js';
import { initializeMatchSimulation } from './services/matchSimulationService.js';
import { initializeInjurySystem } from './services/injuryService.js';
import { initializeConditionRecovery } from './services/conditionService.js';

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

// IP 주소 추출을 위한 미들웨어
app.set('trust proxy', true);

// 라우트
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/friendly-matches', friendlyMatchRoutes);
app.use('/api/combinations', combinationRoutes);
app.use('/api/training', trainingRoutes);

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

