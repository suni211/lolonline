import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db';
import { generateRegularSeasonMatches } from '../services/leagueService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // 스키마 실행
    const statements = schema.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }
    
    console.log('Database initialized successfully');
    
    // 초기 리그 생성
    await createInitialLeagues();
  } catch (error: any) {
    if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
      console.error('Database initialization error:', error);
      throw error;
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

