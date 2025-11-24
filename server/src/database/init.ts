import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import { generateRegularSeasonMatches } from '../services/leagueService.js';
import { getAllPlayers } from './playerRosters.js';

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

    // players 테이블에 새로운 스탯 컬럼 추가 (개인의지 스탯)
    const newStats = ['leadership', 'adaptability', 'consistency', 'work_ethic'];
    for (const stat of newStats) {
      try {
        await pool.query(`ALTER TABLE players ADD COLUMN ${stat} INT DEFAULT 50 CHECK (${stat} >= 1 AND ${stat} <= 300)`);
        console.log(`Added ${stat} column to players table`);
      } catch (error: any) {
        if (error.code !== 'ER_DUP_FIELDNAME') {
          console.error(`Error adding ${stat} column:`, error);
        }
      }
    }

    // player_condition_history 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS player_condition_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          player_id INT NOT NULL,
          condition_value INT NOT NULL CHECK (condition_value >= 0 AND condition_value <= 100),
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
          INDEX idx_player_date (player_id, recorded_at)
        )
      `);
      console.log('Player condition history table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating player_condition_history table:', error);
      }
    }

    // coaches 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS coaches (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL,
          nationality VARCHAR(50) NOT NULL DEFAULT 'KR',
          role ENUM('HEAD_COACH', 'ASSISTANT_COACH') NOT NULL,
          scouting_ability INT DEFAULT 50 CHECK (scouting_ability >= 1 AND scouting_ability <= 100),
          training_boost DECIMAL(3,2) DEFAULT 1.0 CHECK (training_boost >= 0.5 AND training_boost <= 2.0),
          salary BIGINT DEFAULT 0,
          contract_expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Coaches table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating coaches table:', error);
      }
    }

    // coach_ownership 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS coach_ownership (
          id INT PRIMARY KEY AUTO_INCREMENT,
          coach_id INT NOT NULL,
          team_id INT NOT NULL,
          acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          UNIQUE KEY unique_coach_team (coach_id, team_id)
        )
      `);
      console.log('Coach ownership table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating coach_ownership table:', error);
      }
    }

    // team_facilities 테이블 확장
    try {
      await pool.query('ALTER TABLE team_facilities ADD COLUMN revenue_per_hour BIGINT DEFAULT 0');
      await pool.query('ALTER TABLE team_facilities ADD COLUMN maintenance_cost BIGINT DEFAULT 0');
      console.log('Extended team_facilities table');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error extending team_facilities table:', error);
      }
    }

    // contract_negotiations 테이블이 없으면 생성 (기존 DB 업데이트)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS contract_negotiations (
          id INT PRIMARY KEY AUTO_INCREMENT,
          player_id INT NOT NULL,
          team_id INT NOT NULL,
          annual_salary BIGINT NOT NULL,
          contract_years INT DEFAULT 1 CHECK (contract_years >= 1 AND contract_years <= 5),
          signing_bonus BIGINT DEFAULT 0,
          status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTER_OFFER', 'EXPIRED') DEFAULT 'PENDING',
          ai_response_type ENUM('ACCEPT', 'REJECT', 'COUNTER') DEFAULT NULL,
          ai_counter_salary BIGINT,
          ai_counter_years INT,
          ai_counter_bonus BIGINT,
          negotiation_round INT DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          responded_at DATETIME,
          expires_at DATETIME,
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          INDEX idx_player_team (player_id, team_id),
          INDEX idx_status (status)
        )
      `);
      console.log('Contract negotiations table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating contract_negotiations table:', error);
      }
    }
    
    // player_cards 테이블에 personality 컬럼 추가
    try {
      await pool.query(`ALTER TABLE player_cards ADD COLUMN personality ENUM('LEADER', 'REBELLIOUS', 'CALM', 'EMOTIONAL', 'COMPETITIVE') DEFAULT 'CALM'`);
      console.log('Added personality column to player_cards table');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding personality column:', error);
      }
    }

    // player_chat_history 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS player_chat_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          player_id INT NOT NULL,
          team_id INT NOT NULL,
          user_message TEXT NOT NULL,
          ai_response TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player_id) REFERENCES player_cards(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          INDEX idx_player_team (player_id, team_id)
        )
      `);
      console.log('Player chat history table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating player_chat_history table:', error);
      }
    }

    // team_meeting_history 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS team_meeting_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          team_id INT NOT NULL,
          topic VARCHAR(255) NOT NULL,
          result TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          INDEX idx_team (team_id)
        )
      `);
      console.log('Team meeting history table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating team_meeting_history table:', error);
      }
    }

    // player_events 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS player_events (
          id INT PRIMARY KEY AUTO_INCREMENT,
          player_id INT NOT NULL,
          team_id INT NOT NULL,
          event_type ENUM('CONFLICT', 'MOTIVATION', 'SLUMP', 'BREAKTHROUGH') NOT NULL,
          title VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          effect_stat VARCHAR(50),
          effect_value INT DEFAULT 0,
          resolved BOOLEAN DEFAULT false,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved_at DATETIME,
          FOREIGN KEY (player_id) REFERENCES player_cards(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          INDEX idx_player_team (player_id, team_id),
          INDEX idx_event_type (event_type)
        )
      `);
      console.log('Player events table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating player_events table:', error);
      }
    }

    // contract_negotiations 테이블에 AI 대사 컬럼 추가
    try {
      await pool.query(`ALTER TABLE contract_negotiations ADD COLUMN ai_dialogue TEXT`);
      console.log('Added ai_dialogue column to contract_negotiations table');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding ai_dialogue column:', error);
      }
    }

    // contract_negotiations 테이블에 추가 컬럼
    try {
      await pool.query(`ALTER TABLE contract_negotiations ADD COLUMN player_response_salary BIGINT`);
      await pool.query(`ALTER TABLE contract_negotiations ADD COLUMN player_response_years INT`);
      await pool.query(`ALTER TABLE contract_negotiations ADD COLUMN player_response_bonus BIGINT`);
      await pool.query(`ALTER TABLE contract_negotiations ADD COLUMN transfer_fee BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE contract_negotiations ADD COLUMN owner_team_id INT`);
      console.log('Added additional columns to contract_negotiations table');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        // 일부 컬럼은 이미 있을 수 있음
      }
    }

    // teams 테이블에 morale 컬럼 추가
    try {
      await pool.query(`ALTER TABLE teams ADD COLUMN morale INT DEFAULT 50 CHECK (morale >= 0 AND morale <= 100)`);
      console.log('Added morale column to teams table');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding morale column:', error);
      }
    }

    // 팀 약자 컬럼 추가
    try {
      await pool.query(`ALTER TABLE teams ADD COLUMN abbreviation VARCHAR(5)`);
      console.log('Added abbreviation column to teams table');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding morale column:', error);
      }
    }

    // scout_history 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scout_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          team_id INT NOT NULL,
          pro_player_id INT NOT NULL,
          result ENUM('SUCCESS', 'FAILED') NOT NULL,
          cost BIGINT NOT NULL,
          dialogue TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          FOREIGN KEY (pro_player_id) REFERENCES pro_players(id) ON DELETE CASCADE,
          INDEX idx_team (team_id),
          INDEX idx_result (result)
        )
      `);
      console.log('Scout history table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating scout_history table:', error);
      }
    }

    // scouters 테이블 생성 (스카우터 시스템)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scouters (
          id INT PRIMARY KEY AUTO_INCREMENT,
          team_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          star_rating INT NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
          specialty VARCHAR(50),
          hired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          INDEX idx_team (team_id)
        )
      `);
      console.log('Scouters table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating scouters table:', error);
      }
    }

    // scouter_discoveries 테이블 생성 (스카우터가 발굴한 선수)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scouter_discoveries (
          id INT PRIMARY KEY AUTO_INCREMENT,
          scouter_id INT,
          team_id INT NOT NULL,
          pro_player_id INT NOT NULL,
          scouter_name VARCHAR(100),
          scouter_star INT,
          discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          signed BOOLEAN DEFAULT false,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          FOREIGN KEY (pro_player_id) REFERENCES pro_players(id) ON DELETE CASCADE,
          INDEX idx_team (team_id)
        )
      `);
      console.log('Scouter discoveries table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating scouter_discoveries table:', error);
      }
    }

    // scouter_discoveries에 스카우터 정보 컬럼 추가
    try {
      await pool.query(`ALTER TABLE scouter_discoveries ADD COLUMN scouter_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE scouter_discoveries ADD COLUMN scouter_star INT`);
      console.log('Added scouter info columns to scouter_discoveries');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        // 이미 존재하면 무시
      }
    }

    // scouter_discoveries에 성격 및 스탯 컬럼 추가 (협상용)
    try {
      await pool.query(`ALTER TABLE scouter_discoveries ADD COLUMN personality VARCHAR(20)`);
      await pool.query(`ALTER TABLE scouter_discoveries ADD COLUMN mental INT`);
      await pool.query(`ALTER TABLE scouter_discoveries ADD COLUMN teamfight INT`);
      await pool.query(`ALTER TABLE scouter_discoveries ADD COLUMN focus INT`);
      await pool.query(`ALTER TABLE scouter_discoveries ADD COLUMN laning INT`);
      console.log('Added personality and stats columns to scouter_discoveries');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        // 이미 존재하면 무시
      }
    }

    // cup_tournaments 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cup_tournaments (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL,
          season INT NOT NULL,
          status ENUM('UPCOMING', 'ROUND_32', 'ROUND_16', 'QUARTER', 'SEMI', 'FINAL', 'COMPLETED') DEFAULT 'UPCOMING',
          prize_pool BIGINT DEFAULT 100000000,
          winner_team_id INT,
          trophy_image VARCHAR(500),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
          INDEX idx_cup_season (season)
        )
      `);
      // trophy_image 컬럼 추가 (기존 테이블용)
      try {
        await pool.query(`ALTER TABLE cup_tournaments ADD COLUMN trophy_image VARCHAR(500)`);
      } catch (e) {
        // 이미 존재하면 무시
      }
      console.log('Cup tournaments table created/verified');

      // leagues 테이블에 trophy_image 컬럼 추가
      try {
        await pool.query(`ALTER TABLE leagues ADD COLUMN trophy_image VARCHAR(500)`);
      } catch (e) {
        // 이미 존재하면 무시
      }
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating cup_tournaments table:', error);
      }
    }

    // cup_matches 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cup_matches (
          id INT PRIMARY KEY AUTO_INCREMENT,
          cup_id INT NOT NULL,
          round ENUM('ROUND_32', 'ROUND_16', 'QUARTER', 'SEMI', 'FINAL') NOT NULL,
          match_number INT NOT NULL,
          home_team_id INT NOT NULL,
          away_team_id INT NOT NULL,
          home_score INT DEFAULT 0,
          away_score INT DEFAULT 0,
          winner_team_id INT,
          scheduled_at DATETIME NOT NULL,
          status ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'SCHEDULED',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (cup_id) REFERENCES cup_tournaments(id) ON DELETE CASCADE,
          FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE,
          FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE,
          FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
          INDEX idx_cup_round (cup_id, round),
          INDEX idx_cup_schedule (scheduled_at)
        )
      `);
      console.log('Cup matches table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating cup_matches table:', error);
      }
    }

    // special_sponsors 테이블 생성 (1부 전용)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS special_sponsors (
          id INT PRIMARY KEY AUTO_INCREMENT,
          team_id INT NOT NULL,
          sponsor_name VARCHAR(100) NOT NULL,
          bonus_gold BIGINT NOT NULL,
          bonus_diamond INT DEFAULT 0,
          start_season INT NOT NULL,
          end_season INT NOT NULL,
          claimed BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          INDEX idx_sponsor_team (team_id),
          INDEX idx_sponsor_season (start_season, end_season)
        )
      `);
      console.log('Special sponsors table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating special_sponsors table:', error);
      }
    }

    // regular_sponsors 테이블 생성 (2부/3부용)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS regular_sponsors (
          id INT PRIMARY KEY AUTO_INCREMENT,
          team_id INT NOT NULL,
          sponsor_name VARCHAR(100) NOT NULL,
          bonus_gold BIGINT NOT NULL,
          bonus_diamond INT DEFAULT 0,
          season INT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          INDEX idx_regular_sponsor_team (team_id),
          INDEX idx_regular_sponsor_season (season)
        )
      `);
      console.log('Regular sponsors table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating regular_sponsors table:', error);
      }
    }

    // game_settings 테이블 생성 (게임 상태 저장)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS game_settings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          setting_key VARCHAR(100) NOT NULL UNIQUE,
          setting_value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_setting_key (setting_key)
        )
      `);
      console.log('Game settings table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating game_settings table:', error);
      }
    }

    // player_cards에 잠재력, 계약기간, 부상 필드 추가
    try {
      await pool.query(`ALTER TABLE player_cards ADD COLUMN potential INT DEFAULT 50`);
      console.log('Added potential column to player_cards');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding potential column:', error);
      }
    }

    try {
      await pool.query(`ALTER TABLE player_cards ADD COLUMN contract_end_date DATETIME`);
      console.log('Added contract_end_date column to player_cards');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding contract_end_date column:', error);
      }
    }

    try {
      await pool.query(`ALTER TABLE player_cards ADD COLUMN injury_status ENUM('NONE', 'MINOR', 'MODERATE', 'SEVERE') DEFAULT 'NONE'`);
      await pool.query(`ALTER TABLE player_cards ADD COLUMN injury_recovery_days INT DEFAULT 0`);
      await pool.query(`ALTER TABLE player_cards ADD COLUMN injury_started_at DATETIME`);
      console.log('Added injury columns to player_cards');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        // 이미 존재하면 무시
      }
    }

    // teams에 굿즈 판매 관련 필드 추가
    try {
      await pool.query(`ALTER TABLE teams ADD COLUMN merchandise_rate DECIMAL(3,2) DEFAULT 1.0`);
      await pool.query(`ALTER TABLE teams ADD COLUMN merchandise_revenue BIGINT DEFAULT 0`);
      console.log('Added merchandise columns to teams');
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        // 이미 존재하면 무시
      }
    }

    // season_history 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS season_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          season INT NOT NULL,
          league_id INT NOT NULL,
          team_id INT NOT NULL,
          final_rank INT NOT NULL,
          wins INT DEFAULT 0,
          losses INT DEFAULT 0,
          points INT DEFAULT 0,
          prize_money BIGINT DEFAULT 0,
          is_champion BOOLEAN DEFAULT FALSE,
          is_playoff_winner BOOLEAN DEFAULT FALSE,
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          INDEX idx_season_team (season, team_id),
          INDEX idx_season_league (season, league_id)
        )
      `);
      console.log('Season history table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating season_history table:', error);
      }
    }

    // season_prizes 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS season_prizes (
          id INT PRIMARY KEY AUTO_INCREMENT,
          league_type ENUM('SUPER', 'FIRST', 'SECOND') NOT NULL,
          rank_position INT NOT NULL,
          prize_gold BIGINT NOT NULL,
          prize_diamond INT DEFAULT 0,
          UNIQUE KEY unique_league_rank (league_type, rank_position)
        )
      `);

      // 기본 상금 설정
      const defaultPrizes = [
        ['SUPER', 1, 500000000, 500], ['SUPER', 2, 300000000, 300], ['SUPER', 3, 200000000, 200],
        ['SUPER', 4, 150000000, 100], ['SUPER', 5, 100000000, 50], ['SUPER', 6, 80000000, 30],
        ['SUPER', 7, 60000000, 20], ['SUPER', 8, 50000000, 10],
        ['FIRST', 1, 200000000, 200], ['FIRST', 2, 150000000, 150], ['FIRST', 3, 100000000, 100],
        ['FIRST', 4, 80000000, 50], ['FIRST', 5, 60000000, 30], ['FIRST', 6, 50000000, 20],
        ['FIRST', 7, 40000000, 10], ['FIRST', 8, 30000000, 5],
        ['SECOND', 1, 100000000, 100], ['SECOND', 2, 80000000, 80], ['SECOND', 3, 60000000, 60],
        ['SECOND', 4, 50000000, 30], ['SECOND', 5, 40000000, 20], ['SECOND', 6, 30000000, 10],
        ['SECOND', 7, 20000000, 5], ['SECOND', 8, 10000000, 0]
      ];

      for (const prize of defaultPrizes) {
        try {
          await pool.query(
            `INSERT IGNORE INTO season_prizes (league_type, rank_position, prize_gold, prize_diamond) VALUES (?, ?, ?, ?)`,
            prize
          );
        } catch (e) {
          // 이미 존재하면 무시
        }
      }
      console.log('Season prizes table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating season_prizes table:', error);
      }
    }

    // merchandise_sales 테이블 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS merchandise_sales (
          id INT PRIMARY KEY AUTO_INCREMENT,
          team_id INT NOT NULL,
          sale_date DATE NOT NULL,
          units_sold INT DEFAULT 0,
          revenue BIGINT DEFAULT 0,
          fan_count_at_time BIGINT,
          merchandise_level INT,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          INDEX idx_team_date (team_id, sale_date)
        )
      `);
      console.log('Merchandise sales table created/verified');
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('Error creating merchandise_sales table:', error);
      }
    }

    console.log('Database initialized successfully');

    // 초기 리그 생성
    await createInitialLeagues();

    // 초기 선수 생성
    await createInitialPlayers();
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
    // SOUTH 리그 확인 및 생성
    const southLeague = await pool.query(
      'SELECT * FROM leagues WHERE region = ? AND season = 1',
      ['SOUTH']
    );

    if (southLeague.length === 0) {
      await pool.query(
        `INSERT INTO leagues (name, region, season, current_month, is_offseason, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['LPO SOUTH', 'SOUTH', 1, 1, false, 'REGULAR']
      );
    }

    // NORTH 리그 확인 및 생성
    const northLeague = await pool.query(
      'SELECT * FROM leagues WHERE region = ? AND season = 1',
      ['NORTH']
    );

    if (northLeague.length === 0) {
      const northResult = await pool.query(
        `INSERT INTO leagues (name, region, season, current_month, is_offseason, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['LPO NORTH', 'NORTH', 1, 1, false, 'REGULAR']
      );

      // 참가 팀이 있으면 경기 일정 생성
      const northParticipants = await pool.query(
        'SELECT COUNT(*) as count FROM league_participants WHERE league_id = ?',
        [northResult.insertId]
      );
      if (northParticipants[0].count >= 2) {
        await generateRegularSeasonMatches(northResult.insertId);
      }
    }

    // SOUTH 리그도 경기 일정 생성
    if (southLeague.length > 0) {
      const southParticipants = await pool.query(
        'SELECT COUNT(*) as count FROM league_participants WHERE league_id = ?',
        [southLeague[0].id]
      );
      if (southParticipants[0].count >= 2) {
        await generateRegularSeasonMatches(southLeague[0].id);
      }
    }

    console.log('Initial leagues created');
  } catch (error) {
    console.error('Error creating initial leagues:', error);
  }
}

// 초기 선수 생성
async function createInitialPlayers() {
  try {
    // 이미 선수가 있는지 확인
    const existingPlayers = await pool.query('SELECT COUNT(*) as count FROM players');
    if (existingPlayers[0].count > 0) {
      console.log('Players already exist, skipping initial player creation');
      return;
    }

    // 제공된 가상 선수들
    const virtualPlayers = [
      { name: 'Leadingsquash68', position: 'TOP' as const, nationality: 'KR' },
      { name: 'GaeNald', position: 'MID' as const, nationality: 'JP' },
      { name: 'Vilrain', position: 'SUPPORT' as const, nationality: 'KR' },
      { name: 'Onsoo', position: 'JUNGLE' as const, nationality: 'KR' },
      { name: 't1romance', position: 'MID' as const, nationality: 'KR' },
      { name: '03261592630', position: 'ADC' as const, nationality: 'KR' },
      { name: 'SquidFriend1', position: 'MID' as const, nationality: 'KR' },
      { name: 'DOKyuN', position: 'ADC' as const, nationality: 'CN' },
      { name: 'CGG', position: 'SUPPORT' as const, nationality: 'RU' },
      { name: 'KIO', position: 'MID' as const, nationality: 'KR' },
      { name: 'Pizza', position: 'ADC' as const, nationality: 'KR' },
      { name: 'Yebin', position: 'MID' as const, nationality: 'KR' },
      { name: 'LHW', position: 'JUNGLE' as const, nationality: 'CN' },
      { name: 'Hyeseong', position: 'ADC' as const, nationality: 'KR' },
      { name: 'SoSo', position: 'MID' as const, nationality: 'KR' },
      { name: 'MS1005', position: 'TOP' as const, nationality: 'KR' },
      { name: 'Laving', position: 'TOP' as const, nationality: 'KR' },
      { name: 'Mato', position: 'SUPPORT' as const, nationality: 'KR' },
      { name: 'Frost', position: 'SUPPORT' as const, nationality: 'KR' },
      { name: 'JeongMin', position: 'ADC' as const, nationality: 'KR' },
      { name: 'JUNHYUNG', position: 'JUNGLE' as const, nationality: 'KR' },
    ];

    // 모든 리그 선수들 가져오기 (중복 제거됨)
    const allLeaguePlayers = getAllPlayers();
    
    // 가상 선수와 리그 선수 합치기 (중복 제거)
    const allPlayersMap = new Map<string, typeof virtualPlayers[0]>();
    
    // 먼저 가상 선수 추가
    for (const player of virtualPlayers) {
      allPlayersMap.set(player.name, player);
    }
    
    // 리그 선수 추가 (가상 선수와 이름이 겹치지 않는 경우만)
    for (const player of allLeaguePlayers) {
      if (!allPlayersMap.has(player.name)) {
        allPlayersMap.set(player.name, player);
      }
    }
    
    const initialPlayers = Array.from(allPlayersMap.values());

    // 포지션별 스탯 특화
    const positionStats: Record<string, { mental: number; teamfight: number; focus: number; laning: number }> = {
      'TOP': { mental: 0.2, teamfight: 0.3, focus: 0.25, laning: 0.25 },
      'JUNGLE': { mental: 0.25, teamfight: 0.3, focus: 0.3, laning: 0.15 },
      'MID': { mental: 0.2, teamfight: 0.25, focus: 0.3, laning: 0.25 },
      'ADC': { mental: 0.15, teamfight: 0.35, focus: 0.25, laning: 0.25 },
      'SUPPORT': { mental: 0.3, teamfight: 0.25, focus: 0.25, laning: 0.2 }
    };

    for (const player of initialPlayers) {
      // 오버롤 280-480 사이 랜덤 (기본 선수는 조금 더 높은 스탯)
      const baseOverall = 280 + Math.floor(Math.random() * 200);
      const statWeights = positionStats[player.position];
      const mental = Math.floor(baseOverall * statWeights.mental) + Math.floor(Math.random() * 20);
      const teamfight = Math.floor(baseOverall * statWeights.teamfight) + Math.floor(Math.random() * 20);
      const focus = Math.floor(baseOverall * statWeights.focus) + Math.floor(Math.random() * 20);
      const laning = baseOverall - mental - teamfight - focus;

          // 개인의지 스탯 랜덤 생성 (50-150 사이)
          const leadership = 50 + Math.floor(Math.random() * 100);
          const adaptability = 50 + Math.floor(Math.random() * 100);
          const consistency = 50 + Math.floor(Math.random() * 100);
          const workEthic = 50 + Math.floor(Math.random() * 100);

          await pool.query(
            `INSERT INTO players (name, nationality, position, mental, teamfight, focus, laning, leadership, adaptability, consistency, work_ethic, level, exp_to_next) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 100)`,
            [
              player.name,
              player.nationality,
              player.position,
              Math.min(mental, 300),
              Math.min(teamfight, 300),
              Math.min(focus, 300),
              Math.min(laning, 300),
              Math.min(leadership, 300),
              Math.min(adaptability, 300),
              Math.min(consistency, 300),
              Math.min(workEthic, 300)
            ]
          );
    }

    console.log(`Created ${initialPlayers.length} initial players`);
    
    // 나머지 선수들은 이적시장에만 등록 (소유되지 않은 상태로 생성)
    // 실제 로스터 선수들은 나중에 추가 가능하도록 구조 유지
    // 현재는 기본 선수만 생성하고, 나머지는 스카우팅으로 생성됨
    
  } catch (error: any) {
    console.error('Error creating initial players:', error);
    // 초기 선수 생성 실패는 치명적이지 않으므로 계속 진행
  }
}

