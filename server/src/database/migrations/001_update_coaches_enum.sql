-- Migration: Recreate coaches table with proper schema

-- 1. 기존 coaches 데이터 백업
CREATE TABLE IF NOT EXISTS coaches_backup AS SELECT * FROM coaches;

-- 2. 외래키 제약 조건 비활성화
SET FOREIGN_KEY_CHECKS=0;

-- 3. 기존 코치 소유권 테이블 삭제
DROP TABLE IF EXISTS coach_ownership;

-- 4. 기존 coaches 테이블 삭제
DROP TABLE IF EXISTS coaches;

-- 5. 올바른 스키마로 coaches 테이블 재생성
CREATE TABLE coaches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    nationality VARCHAR(50) NOT NULL DEFAULT 'KR',
    role ENUM('HEAD', 'STRATEGY', 'MENTAL', 'PHYSICAL', 'ANALYST', 'DOCTOR', 'HEAD_COACH', 'ASSISTANT_COACH') NOT NULL DEFAULT 'HEAD',
    scouting_ability INT DEFAULT 50 CHECK (scouting_ability >= 1 AND scouting_ability <= 100),
    training_boost DECIMAL(3,2) DEFAULT 1.0 CHECK (training_boost >= 0.5 AND training_boost <= 2.0),
    salary BIGINT DEFAULT 0,
    contract_expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_available BOOLEAN DEFAULT TRUE
);

-- 6. coach_ownership 테이블 재생성
CREATE TABLE coach_ownership (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coach_id INT NOT NULL,
    team_id INT NOT NULL,
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_coach_team (coach_id, team_id)
);

-- 7. 외래키 제약 조건 활성화
SET FOREIGN_KEY_CHECKS=1;

-- 완료
SELECT 'Coaches table recreated successfully!' AS status;
