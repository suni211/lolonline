-- LOLPRO ONLINE 데이터베이스 스키마

-- 유저 테이블
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- 팀 테이블
CREATE TABLE IF NOT EXISTS teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    league ENUM('EAST', 'WEST') NOT NULL,
    logo_url VARCHAR(255),
    team_color VARCHAR(7) DEFAULT '#1E3A8A',
    home_stadium VARCHAR(100),
    gold BIGINT DEFAULT 100000,
    diamond INT DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_team (user_id)
);

-- 선수 테이블
CREATE TABLE IF NOT EXISTS players (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    position ENUM('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT') NOT NULL,
    mental INT DEFAULT 1 CHECK (mental >= 1 AND mental <= 300),
    teamfight INT DEFAULT 1 CHECK (teamfight >= 1 AND teamfight <= 300),
    focus INT DEFAULT 1 CHECK (focus >= 1 AND focus <= 300),
    laning INT DEFAULT 1 CHECK (laning >= 1 AND laning <= 300),
    level INT DEFAULT 1,
    exp INT DEFAULT 0,
    exp_to_next INT DEFAULT 100,
    stat_points INT DEFAULT 0,
    condition INT DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
    satisfaction INT DEFAULT 50 CHECK (satisfaction >= 0 AND satisfaction <= 100),
    contract_fee BIGINT DEFAULT 0,
    contract_expires_at DATETIME,
    uniform_level INT DEFAULT 0 CHECK (uniform_level >= 0 AND uniform_level <= 10),
    uniform_expires_at DATETIME,
    awakening_level INT DEFAULT 0 CHECK (awakening_level >= 0 AND awakening_level <= 3),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_position (position),
    INDEX idx_overall (mental, teamfight, focus, laning)
);

-- 선수 소유 테이블
CREATE TABLE IF NOT EXISTS player_ownership (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_id INT NOT NULL,
    team_id INT NOT NULL,
    is_starter BOOLEAN DEFAULT FALSE,
    is_benched BOOLEAN DEFAULT FALSE,
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_player_team (player_id, team_id)
);

-- 선수 스킬 테이블
CREATE TABLE IF NOT EXISTS player_skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_id INT NOT NULL,
    skill_name VARCHAR(100) NOT NULL,
    skill_level INT DEFAULT 1 CHECK (skill_level >= 1 AND skill_level <= 10),
    skill_points INT DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- 장비 테이블
CREATE TABLE IF NOT EXISTS equipment (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    player_id INT,
    type ENUM('HEADSET', 'KEYBOARD', 'MOUSE', 'MOUSEPAD') NOT NULL,
    name VARCHAR(100) NOT NULL,
    grade ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY') DEFAULT 'COMMON',
    level INT DEFAULT 1,
    stat_bonus JSON,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
);

-- 팀 시설 테이블
CREATE TABLE IF NOT EXISTS team_facilities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    facility_type ENUM('TRAINING', 'MEDICAL', 'SCOUTING') NOT NULL,
    level INT DEFAULT 1,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_team_facility (team_id, facility_type)
);

-- 리그 테이블
CREATE TABLE IF NOT EXISTS leagues (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    region ENUM('EAST', 'WEST') NOT NULL,
    season INT NOT NULL,
    current_month INT NOT NULL CHECK (current_month >= 1 AND current_month <= 12),
    is_offseason BOOLEAN DEFAULT FALSE,
    status ENUM('REGULAR', 'PLAYOFF', 'WORLDS', 'OFFSEASON') DEFAULT 'REGULAR',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_league_season (region, season)
);

-- 리그 참가 테이블
CREATE TABLE IF NOT EXISTS league_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    league_id INT NOT NULL,
    team_id INT NOT NULL,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    points INT DEFAULT 0,
    goal_difference INT DEFAULT 0,
    rank INT,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_league_team (league_id, team_id)
);

-- 경기 테이블
CREATE TABLE IF NOT EXISTS matches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    league_id INT,
    home_team_id INT NOT NULL,
    away_team_id INT NOT NULL,
    match_type ENUM('REGULAR', 'PLAYOFF', 'WORLDS', 'FRIENDLY') DEFAULT 'REGULAR',
    round INT,
    status ENUM('SCHEDULED', 'LIVE', 'FINISHED') DEFAULT 'SCHEDULED',
    home_score INT DEFAULT 0,
    away_score INT DEFAULT 0,
    scheduled_at DATETIME NOT NULL,
    started_at DATETIME,
    finished_at DATETIME,
    match_data JSON,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_match_type (match_type)
);

-- 경기 통계 테이블
CREATE TABLE IF NOT EXISTS match_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    match_id INT NOT NULL,
    player_id INT NOT NULL,
    team_id INT NOT NULL,
    kills INT DEFAULT 0,
    deaths INT DEFAULT 0,
    assists INT DEFAULT 0,
    gold_earned INT DEFAULT 0,
    damage_dealt INT DEFAULT 0,
    vision_score INT DEFAULT 0,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 경기 이벤트 테이블
CREATE TABLE IF NOT EXISTS match_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    match_id INT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_time INT NOT NULL,
    description TEXT,
    event_data JSON,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- 플레이오프 브래킷 테이블
CREATE TABLE IF NOT EXISTS playoff_brackets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    league_id INT NOT NULL,
    round ENUM('QUARTERFINAL', 'SEMIFINAL', 'FINAL') NOT NULL,
    match_id INT,
    team1_id INT,
    team2_id INT,
    winner_id INT,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL,
    FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (winner_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- 트레이드/이적 테이블
CREATE TABLE IF NOT EXISTS trades (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_id INT NOT NULL,
    seller_team_id INT NOT NULL,
    buyer_team_id INT,
    trade_type ENUM('MARKET', 'TRANSFER') NOT NULL,
    price_gold BIGINT,
    price_diamond INT,
    status ENUM('LISTED', 'SOLD', 'CANCELLED') DEFAULT 'LISTED',
    listed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sold_at DATETIME,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- 재화 거래 테이블
CREATE TABLE IF NOT EXISTS currency_exchanges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    exchange_type ENUM('GOLD_TO_DIAMOND', 'DIAMOND_TO_GOLD') NOT NULL,
    amount INT NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    result_amount INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 미션 테이블
CREATE TABLE IF NOT EXISTS missions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mission_type ENUM('DAILY', 'WEEKLY') NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    reward_gold BIGINT DEFAULT 0,
    reward_diamond INT DEFAULT 0,
    reward_player_card BOOLEAN DEFAULT FALSE,
    reward_uniform_card BOOLEAN DEFAULT FALSE,
    target_value INT,
    target_type VARCHAR(50),
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 미션 진행 테이블
CREATE TABLE IF NOT EXISTS mission_progress (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mission_id INT NOT NULL,
    team_id INT NOT NULL,
    progress INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at DATETIME,
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_mission_team (mission_id, team_id)
);

-- 출석 보상 테이블
CREATE TABLE IF NOT EXISTS attendance_rewards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    day INT NOT NULL,
    reward_gold BIGINT DEFAULT 0,
    reward_diamond INT DEFAULT 0,
    reward_type VARCHAR(50),
    claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 출석 기록 테이블
CREATE TABLE IF NOT EXISTS attendance_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    consecutive_days INT DEFAULT 1,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_team_date (team_id, attendance_date)
);

-- 선수 조합 보상 테이블
CREATE TABLE IF NOT EXISTS player_combinations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    combination_name VARCHAR(100) NOT NULL,
    required_player_ids JSON NOT NULL,
    reward_gold BIGINT DEFAULT 0,
    reward_diamond INT DEFAULT 0,
    reward_description TEXT
);

-- 선수 조합 완성 테이블
CREATE TABLE IF NOT EXISTS combination_completions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    combination_id INT NOT NULL,
    team_id INT NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (combination_id) REFERENCES player_combinations(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_combination_team (combination_id, team_id)
);

-- 리더보드 테이블
CREATE TABLE IF NOT EXISTS leaderboards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    league_id INT NOT NULL,
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    total_points INT DEFAULT 0,
    season INT NOT NULL,
    rank INT,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    UNIQUE KEY unique_team_league_season (team_id, league_id, season)
);

-- 인덱스 추가
CREATE INDEX idx_players_overall ON players(mental + teamfight + focus + laning);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_scheduled ON matches(scheduled_at);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_league_participants_rank ON league_participants(rank);

