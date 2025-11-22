-- LPO 리그 시스템 마이그레이션

-- 1. teams 테이블 수정 - league 컬럼을 tier로 변경
ALTER TABLE teams MODIFY COLUMN league ENUM('SUPER', 'FIRST', 'SECOND') DEFAULT 'SECOND';

-- 2. teams 테이블에 is_ai 컬럼 추가
ALTER TABLE teams ADD COLUMN is_ai BOOLEAN DEFAULT FALSE;

-- 3. leagues 테이블 수정 - region을 tier로 변경
ALTER TABLE leagues MODIFY COLUMN region ENUM('SUPER', 'FIRST', 'SECOND') NOT NULL;

-- 4. 기존 데이터 정리
DELETE FROM league_participants;
DELETE FROM matches;
DELETE FROM league_standings;
DELETE FROM leagues;

-- 5. AI 팀 생성을 위한 AI 유저 생성
INSERT INTO users (username, password, email) VALUES ('AI_SYSTEM', 'not_a_real_password', 'ai@system.local')
ON DUPLICATE KEY UPDATE username = username;

-- 6. LPO 리그 생성 (시즌 1)
INSERT INTO leagues (name, region, season, current_month, status) VALUES
('LPO SUPER LEAGUE', 'SUPER', 1, 1, 'REGULAR'),
('LPO 1 LEAGUE', 'FIRST', 1, 1, 'REGULAR'),
('LPO 2 LEAGUE', 'SECOND', 1, 1, 'REGULAR');

-- 7. 승강제 테이블 생성
CREATE TABLE IF NOT EXISTS promotions_relegations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    season INT NOT NULL,
    team_id INT NOT NULL,
    from_tier ENUM('SUPER', 'FIRST', 'SECOND') NOT NULL,
    to_tier ENUM('SUPER', 'FIRST', 'SECOND') NOT NULL,
    type ENUM('PROMOTION', 'RELEGATION') NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 8. AI 팀 교체 기록 테이블
CREATE TABLE IF NOT EXISTS ai_team_replacements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ai_team_id INT NOT NULL,
    player_team_id INT NOT NULL,
    league_id INT NOT NULL,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    points INT DEFAULT 0,
    goal_difference INT DEFAULT 0,
    replaced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ai_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (player_team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
);
