-- LOLPRO ONLINE 데이터베이스 스키마

-- 유저 테이블
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    email VARCHAR(100) UNIQUE,
    google_id VARCHAR(255) UNIQUE,
    profile_picture VARCHAR(500),
    registration_ip VARCHAR(45),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    INDEX idx_registration_ip (registration_ip, created_at),
    INDEX idx_google_id (google_id)
);

-- 팀 테이블
CREATE TABLE IF NOT EXISTS teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    league ENUM('SUPER', 'FIRST', 'SECOND') DEFAULT 'SECOND',
    logo_url VARCHAR(255),
    team_color VARCHAR(7) DEFAULT '#1E3A8A',
    home_stadium VARCHAR(100),
    gold BIGINT DEFAULT 100000000,
    diamond INT DEFAULT 100,
    fan_count BIGINT DEFAULT 1000,
    fan_morale INT DEFAULT 50 CHECK (fan_morale >= 0 AND fan_morale <= 100),
    ticket_price INT DEFAULT 1000 CHECK (ticket_price >= 500 AND ticket_price <= 50000),
    is_ai BOOLEAN DEFAULT FALSE,
    free_contracts_used INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_team (user_id)
);

-- 선수 테이블
CREATE TABLE IF NOT EXISTS players (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    nationality VARCHAR(50) NOT NULL DEFAULT 'KR',
    position ENUM('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT') NOT NULL,
    -- 성격 유형
    personality ENUM('LEADER', 'LONER', 'TEAMPLAYER', 'HOTHEAD', 'CALM', 'GREEDY', 'HUMBLE', 'PRANKSTER') DEFAULT 'CALM',
    -- 직접 올릴 수 있는 스탯 (4개)
    mental INT DEFAULT 1 CHECK (mental >= 1 AND mental <= 300),
    teamfight INT DEFAULT 1 CHECK (teamfight >= 1 AND teamfight <= 300),
    focus INT DEFAULT 1 CHECK (focus >= 1 AND focus <= 300),
    laning INT DEFAULT 1 CHECK (laning >= 1 AND laning <= 300),
    -- 개인의지에 달린 스탯 (4개)
    leadership INT DEFAULT 50 CHECK (leadership >= 1 AND leadership <= 300),
    adaptability INT DEFAULT 50 CHECK (adaptability >= 1 AND adaptability <= 300),
    consistency INT DEFAULT 50 CHECK (consistency >= 1 AND consistency <= 300),
    work_ethic INT DEFAULT 50 CHECK (work_ethic >= 1 AND work_ethic <= 300),
    level INT DEFAULT 1,
    exp INT DEFAULT 0,
    exp_to_next INT DEFAULT 100,
    stat_points INT DEFAULT 0,
    player_condition INT DEFAULT 100 CHECK (player_condition >= 0 AND player_condition <= 100),
    satisfaction INT DEFAULT 50 CHECK (satisfaction >= 0 AND satisfaction <= 100),
    contract_fee BIGINT DEFAULT 0,
    contract_expires_at DATETIME,
    uniform_level INT DEFAULT 0 CHECK (uniform_level >= 0 AND uniform_level <= 10),
    uniform_expires_at DATETIME,
    injury_status ENUM('NONE', 'MINOR', 'MODERATE', 'SEVERE') DEFAULT 'NONE',
    injury_recovery_days INT DEFAULT 0,
    injury_started_at DATETIME,
    face_image VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_position (position),
    INDEX idx_overall (mental, teamfight, focus, laning, leadership, adaptability, consistency, work_ethic)
);

-- 팀 이벤트 테이블
CREATE TABLE IF NOT EXISTS team_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    event_type ENUM('CONFLICT', 'CELEBRATION', 'PRANK', 'INJURY', 'BONUS', 'SCANDAL', 'INTERVIEW', 'TEAMBUILDING') NOT NULL,
    player_id INT,
    player2_id INT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    effect_type ENUM('MORALE', 'CONDITION', 'SATISFACTION', 'GOLD', 'FAN') DEFAULT 'MORALE',
    effect_value INT DEFAULT 0,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (player2_id) REFERENCES players(id) ON DELETE SET NULL,
    INDEX idx_team_date (team_id, created_at)
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

-- 선수 훈련 기록 테이블
CREATE TABLE IF NOT EXISTS player_training (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_id INT NOT NULL,
    team_id INT NOT NULL,
    training_type ENUM('INDIVIDUAL', 'TEAM') NOT NULL,
    stat_type ENUM('MENTAL', 'TEAMFIGHT', 'FOCUS', 'LANING') NOT NULL,
    exp_gained INT DEFAULT 0,
    stat_increase INT DEFAULT 0,
    trained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
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
    facility_type ENUM('TRAINING', 'MEDICAL', 'SCOUTING', 'STADIUM', 'MERCHANDISE', 'RESTAURANT', 'ACCOMMODATION', 'MEDIA', 'GAMING_HOUSE', 'BROADCAST_STUDIO', 'FAN_ZONE', 'ANALYTICS_CENTER') NOT NULL,
    level INT DEFAULT 1,
    revenue_per_hour BIGINT DEFAULT 0,
    maintenance_cost BIGINT DEFAULT 0,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_team_facility (team_id, facility_type)
);

-- 스폰서 테이블
CREATE TABLE IF NOT EXISTS sponsors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    tier ENUM('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND') NOT NULL,
    base_payment BIGINT NOT NULL,
    bonus_per_win BIGINT DEFAULT 0,
    contract_duration_months INT DEFAULT 6,
    min_team_rank INT DEFAULT 10,
    min_wins INT DEFAULT 0,
    description TEXT,
    logo_url VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 팀 스폰서 계약 테이블
CREATE TABLE IF NOT EXISTS team_sponsors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    sponsor_id INT NOT NULL,
    monthly_payment BIGINT NOT NULL,
    bonus_per_win BIGINT DEFAULT 0,
    contract_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    contract_end DATETIME NOT NULL,
    status ENUM('ACTIVE', 'EXPIRED', 'TERMINATED') DEFAULT 'ACTIVE',
    total_earnings BIGINT DEFAULT 0,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE CASCADE,
    INDEX idx_team_status (team_id, status)
);

-- 재정 기록 테이블
CREATE TABLE IF NOT EXISTS financial_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    record_type ENUM('INCOME', 'EXPENSE') NOT NULL,
    category ENUM('MATCH_WIN', 'SPONSOR', 'FACILITY', 'PLAYER_SALARY', 'COACH_SALARY', 'TRANSFER_FEE', 'FACILITY_UPGRADE', 'FACILITY_MAINTENANCE', 'OTHER') NOT NULL,
    amount BIGINT NOT NULL,
    description VARCHAR(255),
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_team_date (team_id, recorded_at),
    INDEX idx_team_type (team_id, record_type)
);

-- 선수 컨디션 기록 테이블 (그래프용)
CREATE TABLE IF NOT EXISTS player_condition_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_id INT NOT NULL,
    condition_value INT NOT NULL CHECK (condition_value >= 0 AND condition_value <= 100),
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    INDEX idx_player_date (player_id, recorded_at)
);

-- 감독 테이블
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
);

-- 감독 소유 테이블
CREATE TABLE IF NOT EXISTS coach_ownership (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coach_id INT NOT NULL,
    team_id INT NOT NULL,
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_coach_team (coach_id, team_id)
);

-- 리그 테이블
CREATE TABLE IF NOT EXISTS leagues (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    region ENUM('EAST', 'WEST', 'SUPER', 'FIRST', 'SECOND') NOT NULL,
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
    cs INT DEFAULT 0,
    gold_earned INT DEFAULT 0,
    damage_dealt INT DEFAULT 0,
    damage_taken INT DEFAULT 0,
    vision_score INT DEFAULT 0,
    wards_placed INT DEFAULT 0,
    wards_destroyed INT DEFAULT 0,
    turret_kills INT DEFAULT 0,
    first_blood BOOLEAN DEFAULT FALSE,
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

-- 연봉협상 테이블
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

-- 인덱스 추가 (IF NOT EXISTS는 MariaDB에서 지원하지 않으므로 별도 처리 필요)
-- idx_players_overall은 표현식 인덱스를 지원하지 않으므로 제거 (이미 idx_overall 복합 인덱스가 있음)
-- 인덱스는 init.ts에서 중복 체크 후 생성

-- 프로 선수 테이블 (실제 선수 데이터)
CREATE TABLE IF NOT EXISTS pro_players (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    team VARCHAR(100) NOT NULL,
    position ENUM('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT') NOT NULL,
    league VARCHAR(50) NOT NULL,
    nationality VARCHAR(50) NOT NULL DEFAULT 'KR',
    base_ovr INT NOT NULL CHECK (base_ovr >= 1 AND base_ovr <= 100),
    card_type ENUM('NORMAL', 'SEASON') DEFAULT 'NORMAL',
    is_active BOOLEAN DEFAULT TRUE,
    face_image VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pro_team (team),
    INDEX idx_pro_league (league),
    INDEX idx_pro_position (position)
);

-- 선수 카드 테이블 (뽑은 카드)
CREATE TABLE IF NOT EXISTS player_cards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pro_player_id INT NULL,  -- NULL이면 AI 가상 선수
    team_id INT,
    card_type ENUM('NORMAL', 'SEASON') DEFAULT 'NORMAL',
    -- 스탯 (1~200)
    mental INT DEFAULT 1 CHECK (mental >= 1 AND mental <= 200),
    teamfight INT DEFAULT 1 CHECK (teamfight >= 1 AND teamfight <= 200),
    focus INT DEFAULT 1 CHECK (focus >= 1 AND focus <= 200),
    laning INT DEFAULT 1 CHECK (laning >= 1 AND laning <= 200),
    -- 계산된 OVR
    ovr INT DEFAULT 1,
    -- 팀컬러
    team_color_id INT,
    team_color_name VARCHAR(100),
    -- 스타터 여부
    is_starter BOOLEAN DEFAULT FALSE,
    -- 계약 (시즌당)
    is_contracted BOOLEAN DEFAULT FALSE,
    contract_season INT DEFAULT NULL,
    contract_cost BIGINT DEFAULT 1000000,
    -- 상세 계약 조건
    annual_salary BIGINT DEFAULT 0,
    contract_years INT DEFAULT 1,
    signing_bonus BIGINT DEFAULT 0,
    championship_bonus BIGINT DEFAULT 0,  -- 우승 보너스
    mvp_bonus BIGINT DEFAULT 0,           -- MVP 보너스
    match_win_bonus BIGINT DEFAULT 0,     -- 경기당 승리 보너스
    relegation_clause BOOLEAN DEFAULT FALSE,  -- 강등 시 계약 해지
    contract_expires_at DATETIME NULL,
    -- 성장
    level INT DEFAULT 1,
    exp INT DEFAULT 0,
    -- AI 가상 선수용
    ai_player_name VARCHAR(100) NULL,
    ai_position VARCHAR(20) NULL,
    personality VARCHAR(50) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pro_player_id) REFERENCES pro_players(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    INDEX idx_card_team (team_id),
    INDEX idx_card_ovr (ovr)
);

-- 기존 테이블 마이그레이션 (AI 가상 선수 지원)
-- ALTER TABLE player_cards MODIFY pro_player_id INT NULL;
-- ALTER TABLE player_cards ADD COLUMN ai_player_name VARCHAR(100) NULL;
-- ALTER TABLE player_cards ADD COLUMN ai_position VARCHAR(20) NULL;

-- 계약 조건 마이그레이션
-- ALTER TABLE player_cards ADD COLUMN annual_salary BIGINT DEFAULT 0;
-- ALTER TABLE player_cards ADD COLUMN contract_years INT DEFAULT 1;
-- ALTER TABLE player_cards ADD COLUMN signing_bonus BIGINT DEFAULT 0;
-- ALTER TABLE player_cards ADD COLUMN championship_bonus BIGINT DEFAULT 0;
-- ALTER TABLE player_cards ADD COLUMN mvp_bonus BIGINT DEFAULT 0;
-- ALTER TABLE player_cards ADD COLUMN match_win_bonus BIGINT DEFAULT 0;
-- ALTER TABLE player_cards ADD COLUMN relegation_clause BOOLEAN DEFAULT FALSE;
-- ALTER TABLE player_cards ADD COLUMN contract_expires_at DATETIME NULL;

-- 선수팩 테이블
CREATE TABLE IF NOT EXISTS player_packs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    price_gold BIGINT DEFAULT 0,
    price_diamond INT DEFAULT 0,
    description TEXT,
    pack_type ENUM('NORMAL', 'PREMIUM', 'LEGEND') DEFAULT 'NORMAL',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 팩 개봉 기록 테이블
CREATE TABLE IF NOT EXISTS pack_openings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    pack_id INT NOT NULL,
    player_card_id INT NOT NULL,
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (pack_id) REFERENCES player_packs(id) ON DELETE CASCADE,
    FOREIGN KEY (player_card_id) REFERENCES player_cards(id) ON DELETE CASCADE
);

-- 프로팀 컬러 테이블 (T1, GEN, DRX 등)
CREATE TABLE IF NOT EXISTS pro_team_colors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_name VARCHAR(100) NOT NULL UNIQUE,
    color_code VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
    league VARCHAR(50) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pro_team_name (team_name)
);

-- 이적시장 테이블
CREATE TABLE IF NOT EXISTS transfer_market (
    id INT PRIMARY KEY AUTO_INCREMENT,
    card_id INT NOT NULL,
    seller_team_id INT NOT NULL,
    asking_price BIGINT NOT NULL,
    status ENUM('LISTED', 'SOLD', 'CANCELLED') DEFAULT 'LISTED',
    listed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sold_at DATETIME,
    buyer_team_id INT,
    FOREIGN KEY (card_id) REFERENCES player_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_listed_at (listed_at)
);

-- 이적 요청 테이블 (다른 팀 선수에게 이적 요청)
CREATE TABLE IF NOT EXISTS transfer_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    card_id INT NOT NULL,
    seller_team_id INT NOT NULL,
    buyer_team_id INT NOT NULL,
    offer_price BIGINT NOT NULL,
    status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTER', 'CANCELLED', 'EXPIRED') DEFAULT 'PENDING',
    counter_price BIGINT NULL,
    message TEXT NULL,
    response_message TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (card_id) REFERENCES player_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_seller (seller_team_id, status),
    INDEX idx_buyer (buyer_team_id, status),
    INDEX idx_expires (expires_at)
);

-- 팀 전술 테이블
CREATE TABLE IF NOT EXISTS team_tactics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL UNIQUE,
    -- 한타 스타일 (싸움 후 오브젝트 vs 오브젝트 후 싸움)
    teamfight_style ENUM('FIGHT_FIRST', 'OBJECTIVE_FIRST') DEFAULT 'FIGHT_FIRST',
    -- 스플릿 포메이션
    split_formation ENUM('1-3-1', '1-4-0', '0-5-0') DEFAULT '0-5-0',
    -- 공격성향 (경기 중 조절 가능)
    aggression_level ENUM('VERY_AGGRESSIVE', 'AGGRESSIVE', 'NORMAL', 'DEFENSIVE', 'VERY_DEFENSIVE') DEFAULT 'NORMAL',
    -- 우선순위 오브젝트
    priority_objective ENUM('DRAGON', 'BARON', 'TOWER', 'TEAMFIGHT') DEFAULT 'DRAGON',
    -- 초반 전략
    early_game_strategy ENUM('AGGRESSIVE', 'STANDARD', 'SCALING') DEFAULT 'STANDARD',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 포지션별 전술 테이블
CREATE TABLE IF NOT EXISTS position_tactics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    position ENUM('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT') NOT NULL,
    -- 탑 전술: SPLITPUSH(스플릿), TEAMFIGHT(한타), TANK(탱킹)
    -- 정글 전술: GANK(갱킹), FARM(파밍), INVADE(인베)
    -- 미드 전술: ROAM(로밍), LANE_DOMINANCE(라인주도), FARM(파밍)
    -- 원딜 전술: AGGRESSIVE(공격적), SAFE(안전), UTILITY(유틸)
    -- 서폿 전술: ENGAGE(이니시), PEEL(필), ROAM(로밍)
    playstyle VARCHAR(50) NOT NULL,
    -- 추가 설정
    risk_level ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM',
    priority_target ENUM('CARRY', 'TANK', 'SUPPORT', 'NEAREST') DEFAULT 'NEAREST',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_team_position (team_id, position)
);

-- 경기 중 전술 변경 기록
CREATE TABLE IF NOT EXISTS match_tactic_changes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    match_id INT NOT NULL,
    team_id INT NOT NULL,
    game_time INT NOT NULL,
    change_type ENUM('AGGRESSION', 'FORMATION', 'OBJECTIVE') NOT NULL,
    old_value VARCHAR(50),
    new_value VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_match_team (match_id, team_id)
);

-- 컵 토너먼트 테이블
CREATE TABLE IF NOT EXISTS cup_tournaments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    season INT NOT NULL,
    status ENUM('UPCOMING', 'ROUND_32', 'ROUND_16', 'QUARTER', 'SEMI', 'FINAL', 'COMPLETED') DEFAULT 'UPCOMING',
    prize_pool BIGINT DEFAULT 100000000,
    winner_team_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    INDEX idx_cup_season (season)
);

-- 컵 경기 테이블
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
);

-- 플레이오프 테이블
CREATE TABLE IF NOT EXISTS playoffs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    league_id INT NOT NULL,
    season INT NOT NULL,
    status ENUM('UPCOMING', 'QUARTER', 'SEMI', 'FINAL', 'COMPLETED') DEFAULT 'UPCOMING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    INDEX idx_playoff_league (league_id, season)
);

-- 플레이오프 경기 테이블
CREATE TABLE IF NOT EXISTS playoff_matches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    playoff_id INT NOT NULL,
    round ENUM('QUARTER', 'SEMI', 'FINAL') NOT NULL,
    match_number INT NOT NULL,
    home_team_id INT NOT NULL,
    away_team_id INT NOT NULL,
    home_score INT DEFAULT 0,
    away_score INT DEFAULT 0,
    winner_team_id INT,
    scheduled_at DATETIME NOT NULL,
    status ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'SCHEDULED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playoff_id) REFERENCES playoffs(id) ON DELETE CASCADE,
    FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    INDEX idx_playoff_round (playoff_id, round)
);

-- 스페셜 스폰서 테이블 (1부 전용, 0.001% 확률, 3시즌 유지)
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
);

-- 일반 스폰서 테이블 (2부/3부, 팬수 기반, 1시즌 유지, 최대 2개)
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
);

-- 뉴스 테이블
CREATE TABLE IF NOT EXISTS news (
    id INT PRIMARY KEY AUTO_INCREMENT,
    -- 뉴스 타입: MATCH_HIGHLIGHT, PLAYER_CONFLICT, TRANSFER_RUMOR, TRANSFER_OFFICIAL, TEAM_NEWS
    news_type ENUM('MATCH_HIGHLIGHT', 'PLAYER_CONFLICT', 'TRANSFER_RUMOR', 'TRANSFER_OFFICIAL', 'TEAM_NEWS', 'LEAGUE_NEWS') NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    -- 관련 엔티티
    team_id INT NULL,
    player_id INT NULL,
    match_id INT NULL,
    -- 이적 루머용
    source_team_id INT NULL,
    target_team_id INT NULL,
    -- 루머 -> 오피셜 연결
    rumor_id INT NULL,
    -- 신뢰도 (루머용, 1-100)
    credibility INT DEFAULT 50,
    -- 공개 여부
    is_published BOOLEAN DEFAULT TRUE,
    -- 하이라이트 종류 (MVP, PENTAKILL, COMEBACK 등)
    highlight_type VARCHAR(50) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (player_id) REFERENCES pro_players(id) ON DELETE SET NULL,
    FOREIGN KEY (source_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (target_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    INDEX idx_news_type (news_type),
    INDEX idx_news_created (created_at DESC),
    INDEX idx_news_team (team_id)
);

