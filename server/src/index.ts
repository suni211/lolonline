import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import teamRoutes from './routes/teams';
import playerRoutes from './routes/players';
import matchRoutes from './routes/matches';
import leagueRoutes from './routes/leagues';
import tradeRoutes from './routes/trades';
import missionRoutes from './routes/missions';
import friendlyMatchRoutes from './routes/friendlyMatches';
import combinationRoutes from './routes/combinations';
import trainingRoutes from './routes/training';
import { initializeDatabase } from './database/init';
import { initializeSeasonSystem } from './services/seasonService';
import { initializeMatchSimulation } from './services/matchSimulationService';
import { initializeInjurySystem } from './services/injuryService';
import { initializeConditionRecovery } from './services/conditionService';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 5000;

// 데이터베이스 초기화 및 서버 시작
async function startServer() {
  try {
    await initializeDatabase();
    await initializeSeasonSystem();
    await initializeMatchSimulation(io);
    initializeInjurySystem();
    initializeConditionRecovery();
    
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { io };

