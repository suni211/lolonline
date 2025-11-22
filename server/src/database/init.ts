import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import { generateRegularSeasonMatches } from '../services/leagueService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 스키마 파일 경로 찾기 (빌드된 파일이 있으면 dist에서, 없으면 src에서 찾기)
const getSchemaPath = () => {
  const distPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(distPath)) {
    return distPath;
  }
  // dist에 없으면 src에서 찾기
  const srcPath = path.resolve(__dirname, '../../src/database/schema.sql');
  return srcPath;
};

export async function initializeDatabase() {
  try {
    // 스키마 파일 경로 찾기 (dist 또는 src에서)
    const schemaPath = getSchemaPath();
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // 스키마 실행
    const statements = schema.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim() && !statement.trim().startsWith('--')) {
        try {
          await pool.query(statement);
        } catch (error: any) {
          // 테이블이나 인덱스가 이미 존재하는 경우 무시
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_KEYNAME') {
            // 이미 존재하는 경우 무시
            continue;
          }
          throw error;
        }
      }
    }
    
    // 추가 인덱스 생성 (중복 체크)
    await createIndexesIfNotExists();
    
    // users 테이블에 registration_ip 컬럼 추가 (기존 테이블 업데이트)
    try {
      await pool.query('ALTER TABLE users ADD COLUMN registration_ip VARCHAR(45)');
      await pool.query('ALTER TABLE users ADD INDEX idx_registration_ip (registration_ip, created_at)');
      console.log('Added registration_ip column to users table');
    } catch (error: any) {
      // 컬럼이 이미 존재하는 경우 무시
      if (error.code !== 'ER_DUP_FIELDNAME' && error.code !== 'ER_DUP_KEYNAME') {
        console.error('Error adding registration_ip column:', error);
      }
    }

    // players 테이블에 nationality 컬럼 추가 (기존 테이블 업데이트)
    try {
      await pool.query('ALTER TABLE players ADD COLUMN nationality VARCHAR(50) DEFAULT "KR"');
      console.log('Added nationality column to players table');
    } catch (error: any) {
      // 컬럼이 이미 존재하는 경우 무시
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding nationality column:', error);
      }
    }
    
    console.log('Database initialized successfully');
    
    // 초기 리그 생성
    await createInitialLeagues();
  } catch (error: any) {
    if (error.code !== 'ER_TABLE_EXISTS_ERROR' && error.code !== 'ER_DUP_KEYNAME') {
      console.error('Database initialization error:', error);
      throw error;
    }
  }
}

// 인덱스 생성 (중복 체크)
async function createIndexesIfNotExists() {
  const indexes = [
    { name: 'idx_matches_status', table: 'matches', columns: 'status' },
    { name: 'idx_matches_scheduled', table: 'matches', columns: 'scheduled_at' },
    { name: 'idx_trades_status', table: 'trades', columns: 'status' },
    { name: 'idx_league_participants_rank', table: 'league_participants', columns: 'rank' }
  ];

  for (const idx of indexes) {
    try {
      // 인덱스 존재 여부 확인
      const result = await pool.query(
        `SELECT COUNT(*) as count 
         FROM information_schema.statistics 
         WHERE table_schema = DATABASE() 
         AND table_name = ? 
         AND index_name = ?`,
        [idx.table, idx.name]
      );

      if (result[0].count === 0) {
        await pool.query(`CREATE INDEX ${idx.name} ON ${idx.table}(${idx.columns})`);
      }
    } catch (error: any) {
      // 인덱스가 이미 존재하는 경우 무시
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.error(`Error creating index ${idx.name}:`, error);
      }
    }
  }
}

async function createInitialLeagues() {
  try {
    // EAST 리그 확인 및 생성
    const eastLeague = await pool.query(
      'SELECT * FROM leagues WHERE region = ? AND season = 1',
      ['EAST']
    );
    
    if (eastLeague.length === 0) {
      await pool.query(
        `INSERT INTO leagues (name, region, season, current_month, is_offseason, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['EAST LEAGUE', 'EAST', 1, 1, false, 'REGULAR']
      );
    }
    
    // WEST 리그 확인 및 생성
    const westLeague = await pool.query(
      'SELECT * FROM leagues WHERE region = ? AND season = 1',
      ['WEST']
    );
    
    if (westLeague.length === 0) {
      const westResult = await pool.query(
        `INSERT INTO leagues (name, region, season, current_month, is_offseason, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['WEST LEAGUE', 'WEST', 1, 1, false, 'REGULAR']
      );
      
      // 참가 팀이 있으면 경기 일정 생성
      const westParticipants = await pool.query(
        'SELECT COUNT(*) as count FROM league_participants WHERE league_id = ?',
        [westResult.insertId]
      );
      if (westParticipants[0].count >= 2) {
        await generateRegularSeasonMatches(westResult.insertId);
      }
    }

    // EAST 리그도 경기 일정 생성
    if (eastLeague.length > 0) {
      const eastParticipants = await pool.query(
        'SELECT COUNT(*) as count FROM league_participants WHERE league_id = ?',
        [eastLeague[0].id]
      );
      if (eastParticipants[0].count >= 2) {
        await generateRegularSeasonMatches(eastLeague[0].id);
      }
    }
    
    console.log('Initial leagues created');
  } catch (error) {
    console.error('Error creating initial leagues:', error);
  }
}

