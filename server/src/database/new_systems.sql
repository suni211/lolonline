-- 새로운 시스템 테이블들

-- 0. 외래 키 체크 비활성화
SET FOREIGN_KEY_CHECKS = 0;

-- 기존 테이블 삭제
DROP TABLE IF EXISTS team_coaches;
DROP TABLE IF EXISTS coaches;
DROP TABLE IF EXISTS youth_players;
DROP TABLE IF EXISTS youth_academy;
DROP TABLE IF EXISTS player_mental_states;
DROP TABLE IF EXISTS player_relationships;
DROP TABLE IF EXISTS team_tactics;
DROP TABLE IF EXISTS player_loans;
DROP TABLE IF EXISTS season_awards;
DROP TABLE IF EXISTS player_streams;
DROP TABLE IF EXISTS worlds_matches;
DROP TABLE IF EXISTS worlds_participants;
DROP TABLE IF EXISTS worlds_tournaments;
DROP TABLE IF EXISTS promotion_matches;
DROP TABLE IF EXISTS facility_costs;

-- 1. 스트리밍/콘텐츠 시스템
CREATE TABLE IF NOT EXISTS player_streams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_card_id INT NOT NULL,
    team_id INT NOT NULL,
    stream_date DATE NOT NULL,
    duration_hours INT DEFAULT 2,
    viewers INT DEFAULT 0,
    income BIGINT DEFAULT 0,
    male_fans_gained INT DEFAULT 0,
    female_fans_gained INT DEFAULT 0,
    condition_loss INT DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_card_id) REFERENCES player_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_stream_player (player_card_id),
    INDEX idx_stream_date (stream_date)
);

-- 2. 시즌 어워드
CREATE TABLE IF NOT EXISTS season_awards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    season INT NOT NULL,
    award_type ENUM('MVP', 'ROOKIE', 'TOP_SCORER', 'ASSIST_KING', 'BEST_SUPPORT', 'BEST_JUNGLER') NOT NULL,
    player_card_id INT NOT NULL,
    team_id INT NOT NULL,
    stats_value INT DEFAULT 0,
    prize_gold BIGINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_card_id) REFERENCES player_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_season_award (season, award_type)
);

-- 3. 임대 시스템
CREATE TABLE IF NOT EXISTS player_loans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_card_id INT NOT NULL,
    from_team_id INT NOT NULL,
    to_team_id INT NOT NULL,
    loan_fee BIGINT DEFAULT 0,
    salary_share_percent INT DEFAULT 50,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_card_id) REFERENCES player_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (from_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (to_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_loan_status (status),
    INDEX idx_loan_dates (start_date, end_date)
);

-- 4. 전술 시스템
CREATE TABLE IF NOT EXISTS team_tactics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL UNIQUE,
    -- 플레이스타일 (1-100 스케일)
    aggression INT DEFAULT 50,          -- 공격성 (낮음=후반 스케일, 높음=초반 공격)
    teamfight_focus INT DEFAULT 50,     -- 한타 집중도
    objective_priority INT DEFAULT 50,   -- 오브젝트 우선순위
    vision_control INT DEFAULT 50,       -- 시야 장악

    -- 라인별 전략
    top_style ENUM('TANK', 'CARRY', 'SPLIT') DEFAULT 'TANK',
    jungle_style ENUM('GANKER', 'FARMER', 'INVADER') DEFAULT 'GANKER',
    mid_style ENUM('ROAM', 'LANE', 'ASSASSIN') DEFAULT 'LANE',
    adc_style ENUM('EARLY', 'LATE', 'UTILITY') DEFAULT 'LATE',
    support_style ENUM('ENGAGE', 'ENCHANTER', 'ROAM') DEFAULT 'ENGAGE',

    -- 특수 전술
    first_blood_priority BOOLEAN DEFAULT FALSE,
    dragon_priority BOOLEAN DEFAULT TRUE,
    baron_priority BOOLEAN DEFAULT TRUE,

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 5. 선수 멘탈/관계 시스템
CREATE TABLE IF NOT EXISTS player_relationships (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player1_id INT NOT NULL,
    player2_id INT NOT NULL,
    team_id INT NOT NULL,
    relationship_type ENUM('FRIEND', 'RIVAL', 'NEUTRAL', 'CONFLICT') DEFAULT 'NEUTRAL',
    relationship_value INT DEFAULT 50,  -- 0-100
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES player_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES player_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_relationship (player1_id, player2_id)
);

CREATE TABLE IF NOT EXISTS player_mental_states (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_card_id INT NOT NULL,
    morale INT DEFAULT 70,              -- 사기 (0-100)
    stress INT DEFAULT 30,              -- 스트레스 (0-100)
    confidence INT DEFAULT 50,          -- 자신감 (0-100)
    team_satisfaction INT DEFAULT 70,   -- 팀 만족도 (0-100)
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (player_card_id) REFERENCES player_cards(id) ON DELETE CASCADE,
    UNIQUE KEY unique_mental (player_card_id)
);

-- 6. 팬 시스템 (성별 분류)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS male_fans INT DEFAULT 1000;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS female_fans INT DEFAULT 1000;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS merchandise_sales BIGINT DEFAULT 0;

-- 7. 유스 아카데미
CREATE TABLE IF NOT EXISTS youth_academy (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    level INT DEFAULT 1,
    capacity INT DEFAULT 5,
    training_quality INT DEFAULT 50,
    scouting_range INT DEFAULT 1,       -- 1=지역, 2=전국, 3=해외
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_academy (team_id)
);

CREATE TABLE IF NOT EXISTS youth_players (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    position ENUM('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT') NOT NULL,
    age INT DEFAULT 16,
    potential INT DEFAULT 50,           -- 잠재력 (1-100)
    current_overall INT DEFAULT 30,
    mental INT DEFAULT 30,
    teamfight INT DEFAULT 30,
    focus INT DEFAULT 30,
    laning INT DEFAULT 30,
    training_progress INT DEFAULT 0,
    graduation_ready BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_youth_team (team_id)
);

-- 8. 코치 시스템
CREATE TABLE IF NOT EXISTS coaches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    nationality VARCHAR(50) DEFAULT 'KR',
    coach_type ENUM('HEAD', 'STRATEGY', 'MENTAL', 'PHYSICAL', 'ANALYST', 'DOCTOR') NOT NULL,
    skill_level INT DEFAULT 50,         -- 능력치 (1-100)
    salary BIGINT DEFAULT 5000000,
    experience_years INT DEFAULT 1,
    specialty VARCHAR(100),             -- 전문 분야
    is_available BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_coaches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    coach_id INT NOT NULL,
    contract_start DATE NOT NULL,
    contract_end DATE NOT NULL,
    monthly_salary BIGINT NOT NULL,
    status ENUM('ACTIVE', 'TERMINATED') DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
    INDEX idx_team_coach (team_id, status)
);

-- 9. 리그 구조 변경 (LPO SOUTH/NORTH)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS region ENUM('SOUTH', 'NORTH') DEFAULT 'SOUTH';

-- WORLDS 토너먼트
CREATE TABLE IF NOT EXISTS worlds_tournaments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    season INT NOT NULL,
    status ENUM('PENDING', 'ONGOING', 'FINISHED') DEFAULT 'PENDING',
    prize_pool BIGINT DEFAULT 2500000000,  -- 25억
    start_date DATE,
    champion_team_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (champion_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    UNIQUE KEY unique_worlds_season (season)
);

CREATE TABLE IF NOT EXISTS worlds_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    worlds_id INT NOT NULL,
    team_id INT NOT NULL,
    region ENUM('SOUTH', 'NORTH') NOT NULL,
    seed INT NOT NULL,                  -- 1-4
    eliminated BOOLEAN DEFAULT FALSE,
    final_rank INT,
    FOREIGN KEY (worlds_id) REFERENCES worlds_tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_worlds_team (worlds_id, team_id)
);

CREATE TABLE IF NOT EXISTS worlds_matches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    worlds_id INT NOT NULL,
    round ENUM('QUARTER', 'SEMI', 'FINAL') NOT NULL,
    match_number INT NOT NULL,
    team1_id INT,
    team2_id INT,
    team1_score INT DEFAULT 0,
    team2_score INT DEFAULT 0,
    winner_id INT,
    scheduled_at DATETIME,
    status ENUM('PENDING', 'LIVE', 'FINISHED') DEFAULT 'PENDING',
    FOREIGN KEY (worlds_id) REFERENCES worlds_tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (winner_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- 승격/강등전
CREATE TABLE IF NOT EXISTS promotion_matches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    season INT NOT NULL,
    region ENUM('SOUTH', 'NORTH') NOT NULL,
    first_div_team_id INT NOT NULL,
    second_div_team_id INT NOT NULL,
    first_div_score INT DEFAULT 0,
    second_div_score INT DEFAULT 0,
    winner_id INT,
    promoted BOOLEAN DEFAULT FALSE,     -- 2부팀이 승격했는지
    scheduled_at DATETIME,
    status ENUM('PENDING', 'LIVE', 'FINISHED') DEFAULT 'PENDING',
    FOREIGN KEY (first_div_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (second_div_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- 시설 비용 테이블 (프론트엔드 표시용)
CREATE TABLE IF NOT EXISTS facility_costs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    facility_type VARCHAR(50) NOT NULL,
    level INT NOT NULL,
    upgrade_cost BIGINT NOT NULL,
    maintenance_cost BIGINT NOT NULL,
    description VARCHAR(255),
    UNIQUE KEY unique_facility_level (facility_type, level)
);

-- 기본 시설 비용 데이터
INSERT INTO facility_costs (facility_type, level, upgrade_cost, maintenance_cost, description) VALUES
('TRAINING', 1, 5000000, 500000, '기본 훈련 시설'),
('TRAINING', 2, 10000000, 1000000, '향상된 훈련 시설'),
('TRAINING', 3, 20000000, 2000000, '고급 훈련 시설'),
('TRAINING', 4, 40000000, 4000000, '최첨단 훈련 시설'),
('TRAINING', 5, 80000000, 8000000, '월드클래스 훈련 시설'),
('MEDICAL', 1, 3000000, 300000, '기본 의료 시설'),
('MEDICAL', 2, 6000000, 600000, '향상된 의료 시설'),
('MEDICAL', 3, 12000000, 1200000, '고급 의료 시설'),
('MEDICAL', 4, 24000000, 2400000, '최첨단 의료 시설'),
('MEDICAL', 5, 48000000, 4800000, '월드클래스 의료 시설'),
('GAMING', 1, 8000000, 800000, '기본 게이밍 시설'),
('GAMING', 2, 16000000, 1600000, '향상된 게이밍 시설'),
('GAMING', 3, 32000000, 3200000, '고급 게이밍 시설'),
('GAMING', 4, 64000000, 6400000, '최첨단 게이밍 시설'),
('GAMING', 5, 128000000, 12800000, '월드클래스 게이밍 시설'),
('DORMITORY', 1, 4000000, 400000, '기본 숙소'),
('DORMITORY', 2, 8000000, 800000, '향상된 숙소'),
('DORMITORY', 3, 16000000, 1600000, '고급 숙소'),
('DORMITORY', 4, 32000000, 3200000, '최첨단 숙소'),
('DORMITORY', 5, 64000000, 6400000, '월드클래스 숙소'),
('ACADEMY', 1, 10000000, 1000000, '기본 아카데미'),
('ACADEMY', 2, 20000000, 2000000, '향상된 아카데미'),
('ACADEMY', 3, 40000000, 4000000, '고급 아카데미'),
('ACADEMY', 4, 80000000, 8000000, '최첨단 아카데미'),
('ACADEMY', 5, 160000000, 16000000, '월드클래스 아카데미')
ON DUPLICATE KEY UPDATE upgrade_cost = VALUES(upgrade_cost), maintenance_cost = VALUES(maintenance_cost);

-- 기본 코치 데이터
INSERT INTO coaches (name, nationality, coach_type, skill_level, salary, experience_years, specialty) VALUES
-- HEAD 코치들
('03261592630', 'KR', 'HEAD', 70, 15000000, 5, '전체 팀 운영'),
('Paronoa', 'US', 'HEAD', 80, 25000000, 8, '국제 경험'),
('MasterMind', 'KR', 'HEAD', 85, 30000000, 10, '챔피언십 경험'),
('StormLeader', 'CN', 'HEAD', 75, 20000000, 6, '공격적 운영'),
('CalmGeneral', 'KR', 'HEAD', 65, 12000000, 4, '안정적 운영'),

-- STRATEGY 코치들
('Vilrain', 'KR', 'STRATEGY', 65, 10000000, 3, '밴픽 전략'),
('CGG', 'CN', 'STRATEGY', 75, 18000000, 6, 'LPL 스타일'),
('DraftKing', 'KR', 'STRATEGY', 80, 22000000, 7, '메타 분석'),
('BluePrint', 'EU', 'STRATEGY', 70, 15000000, 5, '전략 설계'),
('ChessPlayer', 'KR', 'STRATEGY', 60, 8000000, 2, '초반 전략'),

-- MENTAL 코치들
('LeadingSquash68', 'KR', 'MENTAL', 60, 8000000, 2, '멘탈 케어'),
('ZenMaster', 'JP', 'MENTAL', 75, 16000000, 6, '명상 지도'),
('MindHealer', 'KR', 'MENTAL', 70, 12000000, 4, '스트레스 관리'),
('PeaceKeeper', 'US', 'MENTAL', 65, 10000000, 3, '팀 화합'),
('SoulDoctor', 'KR', 'MENTAL', 55, 6000000, 1, '신인 멘탈 관리'),

-- PHYSICAL 코치들
('Valaon', 'KR', 'PHYSICAL', 55, 7000000, 2, '체력 관리'),
('IronBody', 'KR', 'PHYSICAL', 70, 12000000, 5, '피지컬 트레이닝'),
('FlexMaster', 'US', 'PHYSICAL', 65, 9000000, 3, '유연성 훈련'),
('EnduranceX', 'CN', 'PHYSICAL', 60, 8000000, 2, '지구력 강화'),
('QuickReflex', 'KR', 'PHYSICAL', 75, 14000000, 6, '반응속도 훈련'),

-- ANALYST 코치들
('Delpinium', 'KR', 'ANALYST', 70, 9000000, 4, '상대 분석'),
('GaeNald', 'JP', 'ANALYST', 65, 11000000, 4, '데이터 분석'),
('StatGuru', 'KR', 'ANALYST', 80, 18000000, 7, '통계 전문가'),
('VODHunter', 'EU', 'ANALYST', 75, 15000000, 5, 'VOD 분석'),
('MetaReader', 'KR', 'ANALYST', 60, 7000000, 2, '메타 리딩'),
('PatternSeeker', 'CN', 'ANALYST', 70, 12000000, 4, '패턴 분석'),

-- DOCTOR 코치들
('Asharosa', 'KR', 'DOCTOR', 75, 12000000, 6, '부상 치료'),
('HandDoctor', 'KR', 'DOCTOR', 80, 20000000, 8, '손목 전문'),
('EyeCare', 'JP', 'DOCTOR', 70, 14000000, 5, '시력 관리'),
('BackHealer', 'US', 'DOCTOR', 65, 10000000, 3, '척추 관리'),
('SleepExpert', 'KR', 'DOCTOR', 60, 8000000, 2, '수면 관리')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 외래 키 체크 다시 활성화
SET FOREIGN_KEY_CHECKS = 1;
