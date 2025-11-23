-- 새 시스템 추가 마이그레이션

-- 1. player_cards에 잠재력, 계약기간, 부상 필드 추가
ALTER TABLE player_cards
ADD COLUMN IF NOT EXISTS potential INT DEFAULT 50 CHECK (potential >= 1 AND potential <= 100),
ADD COLUMN IF NOT EXISTS contract_end_date DATETIME,
ADD COLUMN IF NOT EXISTS injury_status ENUM('NONE', 'MINOR', 'MODERATE', 'SEVERE') DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS injury_recovery_days INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS injury_started_at DATETIME;

-- 2. teams에 굿즈 판매 관련 필드 추가
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS merchandise_rate DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS merchandise_revenue BIGINT DEFAULT 0;

-- 3. 시즌 기록 테이블 (역대 시즌 우승, 순위, 상금)
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
);

-- 4. 시즌 상금 설정 테이블
CREATE TABLE IF NOT EXISTS season_prizes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    league_type ENUM('SUPER', 'FIRST', 'SECOND') NOT NULL,
    rank_position INT NOT NULL,
    prize_gold BIGINT NOT NULL,
    prize_diamond INT DEFAULT 0,
    UNIQUE KEY unique_league_rank (league_type, rank_position)
);

-- 기본 상금 설정 삽입
INSERT IGNORE INTO season_prizes (league_type, rank_position, prize_gold, prize_diamond) VALUES
-- SUPER 리그
('SUPER', 1, 500000000, 500),   -- 1위: 5억 + 500다이아
('SUPER', 2, 300000000, 300),   -- 2위: 3억 + 300다이아
('SUPER', 3, 200000000, 200),   -- 3위: 2억 + 200다이아
('SUPER', 4, 150000000, 100),   -- 4위: 1.5억 + 100다이아
('SUPER', 5, 100000000, 50),    -- 5위: 1억 + 50다이아
('SUPER', 6, 80000000, 30),
('SUPER', 7, 60000000, 20),
('SUPER', 8, 50000000, 10),
-- FIRST 리그
('FIRST', 1, 200000000, 200),
('FIRST', 2, 150000000, 150),
('FIRST', 3, 100000000, 100),
('FIRST', 4, 80000000, 50),
('FIRST', 5, 60000000, 30),
('FIRST', 6, 50000000, 20),
('FIRST', 7, 40000000, 10),
('FIRST', 8, 30000000, 5),
-- SECOND 리그
('SECOND', 1, 100000000, 100),
('SECOND', 2, 80000000, 80),
('SECOND', 3, 60000000, 60),
('SECOND', 4, 50000000, 30),
('SECOND', 5, 40000000, 20),
('SECOND', 6, 30000000, 10),
('SECOND', 7, 20000000, 5),
('SECOND', 8, 10000000, 0);

-- 5. 굿즈 판매 기록 테이블
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
);
