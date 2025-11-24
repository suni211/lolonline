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
// import trainingRoutes from './routes/training.js'; // 훈련 시스템 제거 (자동 레벨업으로 대체)
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
import newsRoutes from './routes/news.js';
import streamingRoutes from './routes/streaming.js';
import fansRoutes from './routes/fans.js';
import academyRoutes from './routes/academy.js';
import mentalRoutes from './routes/mental.js';
import loansRoutes from './routes/loans.js';
import awardsRoutes from './routes/awards.js';
import leagueStructureRoutes from './routes/leagueStructure.js';
import financeRoutes from './routes/finance.js';
import communityRoutes from './routes/community.js';
import { initializeDatabase } from './database/init.js';
import { ProPlayerService } from './services/proPlayerService.js';
import { initializeSeasonSystem } from './services/seasonService.js';
import { initializeMatchSimulation } from './services/matchSimulationService.js';
import { initializeInjurySystem } from './services/injuryService.js';
import { initializeConditionRecovery } from './services/conditionService.js';
import { initializeLeagueMatchService } from './services/leagueMatchService.js';
import { initializeMerchandiseSystem } from './services/merchandiseService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
export const io = new Server(httpServer, {
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
// app.use('/api/training', trainingRoutes); // 훈련 시스템 제거 (자동 레벨업으로 대체)
app.use('/api/sponsors', sponsorRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tactics', tacticsRoutes);
// app.use('/api/packs', packsRoutes); // 카드깡 제거, 스카우트로 대체
app.use('/api/transfer', transferRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/scout', scoutRoutes);
app.use('/api/cup', cupRoutes);
app.use('/api/streaming', streamingRoutes);
app.use('/api/fans', fansRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/mental', mentalRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/awards', awardsRoutes);
app.use('/api/league-structure', leagueStructureRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/community', communityRoutes);

// 경기별 접속자 관리
const matchViewers: Map<number, Map<string, string>> = new Map();

// 전역 채팅 접속자 관리
const globalChatViewers: Map<string, string> = new Map();

// Socket.IO 연결
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe_match', (matchId: number) => {
    socket.join(`match_${matchId}`);
  });

  socket.on('unsubscribe_match', (matchId: number) => {
    socket.leave(`match_${matchId}`);
  });

  // 경기 참가 (채팅용)
  socket.on('join_match', (data: { matchId: number; username: string }) => {
    const { matchId, username } = data;
    socket.join(`match_${matchId}`);

    // 접속자 추가
    if (!matchViewers.has(matchId)) {
      matchViewers.set(matchId, new Map());
    }
    matchViewers.get(matchId)!.set(socket.id, username);

    // 접속자 목록 전송
    const viewers = Array.from(matchViewers.get(matchId)!.values());
    io.to(`match_${matchId}`).emit('viewers_update', viewers);

    // 입장 메시지
    io.to(`match_${matchId}`).emit('chat_message', {
      type: 'system',
      username: 'System',
      message: `${username}님이 입장했습니다.`,
      timestamp: Date.now()
    });
  });

  // 경기 퇴장
  socket.on('leave_match', (matchId: number) => {
    socket.leave(`match_${matchId}`);

    if (matchViewers.has(matchId)) {
      const username = matchViewers.get(matchId)!.get(socket.id);
      matchViewers.get(matchId)!.delete(socket.id);

      if (username) {
        const viewers = Array.from(matchViewers.get(matchId)!.values());
        io.to(`match_${matchId}`).emit('viewers_update', viewers);
        io.to(`match_${matchId}`).emit('chat_message', {
          type: 'system',
          username: 'System',
          message: `${username}님이 퇴장했습니다.`,
          timestamp: Date.now()
        });
      }
    }
  });

  // 채팅 메시지
  socket.on('send_chat', (data: { matchId: number; message: string }) => {
    const { matchId, message } = data;

    if (!matchViewers.has(matchId)) return;
    const username = matchViewers.get(matchId)!.get(socket.id);
    if (!username) return;

    io.to(`match_${matchId}`).emit('chat_message', {
      type: 'user',
      username,
      message,
      timestamp: Date.now()
    });
  });

  // 전역 채팅 참가
  socket.on('join_global_chat', (data: { username: string }) => {
    const { username } = data;
    socket.join('global_chat');
    globalChatViewers.set(socket.id, username);

    const viewers = Array.from(globalChatViewers.values());
    io.to('global_chat').emit('global_viewers_update', viewers);

    io.to('global_chat').emit('global_chat_message', {
      type: 'system',
      username: 'System',
      message: `${username}님이 입장했습니다.`,
      timestamp: Date.now()
    });
  });

  // 전역 채팅 퇴장
  socket.on('leave_global_chat', () => {
    const username = globalChatViewers.get(socket.id);
    if (username) {
      globalChatViewers.delete(socket.id);
      socket.leave('global_chat');

      const viewers = Array.from(globalChatViewers.values());
      io.to('global_chat').emit('global_viewers_update', viewers);

      io.to('global_chat').emit('global_chat_message', {
        type: 'system',
        username: 'System',
        message: `${username}님이 퇴장했습니다.`,
        timestamp: Date.now()
      });
    }
  });

  // 전역 채팅 메시지
  socket.on('send_global_chat', (data: { message: string }) => {
    const username = globalChatViewers.get(socket.id);
    if (!username) return;

    io.to('global_chat').emit('global_chat_message', {
      type: 'user',
      username,
      message: data.message,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // 모든 경기에서 해당 소켓 제거
    matchViewers.forEach((viewers, matchId) => {
      if (viewers.has(socket.id)) {
        const username = viewers.get(socket.id);
        viewers.delete(socket.id);

        if (username) {
          const viewerList = Array.from(viewers.values());
          io.to(`match_${matchId}`).emit('viewers_update', viewerList);
          io.to(`match_${matchId}`).emit('chat_message', {
            type: 'system',
            username: 'System',
            message: `${username}님이 퇴장했습니다.`,
            timestamp: Date.now()
          });
        }
      }
    });

    // 전역 채팅에서 제거
    if (globalChatViewers.has(socket.id)) {
      const username = globalChatViewers.get(socket.id);
      globalChatViewers.delete(socket.id);

      if (username) {
        const viewers = Array.from(globalChatViewers.values());
        io.to('global_chat').emit('global_viewers_update', viewers);
        io.to('global_chat').emit('global_chat_message', {
          type: 'system',
          username: 'System',
          message: `${username}님이 퇴장했습니다.`,
          timestamp: Date.now()
        });
      }
    }
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
    initializeMerchandiseSystem();

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

