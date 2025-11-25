-- 선수 면담 테이블
CREATE TABLE IF NOT EXISTS player_interviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    player_card_id INT NOT NULL,
    -- 면담 타입: COMPLAINT(불만), PRAISE(칭찬), REQUEST(요청), ACHIEVEMENT(성취), CONCERN(우려), CELEBRATION(축하)
    interview_type ENUM('COMPLAINT', 'PRAISE', 'REQUEST', 'ACHIEVEMENT', 'CONCERN', 'CELEBRATION') NOT NULL,
    -- 발생 원인: LOSING_STREAK(연패), WINNING_STREAK(연승), BENCHED(벤치), INJURY(부상), MVP(MVP), CHAMPIONSHIP(우승) 등
    trigger_reason VARCHAR(100) NOT NULL,
    situation TEXT NOT NULL,  -- 상황 설명
    player_message TEXT NOT NULL,  -- 선수의 말
    player_mood ENUM('VERY_HAPPY', 'HAPPY', 'NEUTRAL', 'UPSET', 'ANGRY') DEFAULT 'NEUTRAL',
    -- 선택지 (JSON 배열)
    options JSON NOT NULL,
    -- 선택한 옵션 인덱스
    selected_option INT,
    -- 결과 (JSON: satisfaction_change, morale_change, etc.)
    result JSON,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (player_card_id) REFERENCES player_cards(id) ON DELETE CASCADE,
    INDEX idx_team_resolved (team_id, is_resolved),
    INDEX idx_created (created_at DESC)
);

-- 선수 만족도 히스토리 (면담 결과 추적용)
CREATE TABLE IF NOT EXISTS player_satisfaction_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_card_id INT NOT NULL,
    satisfaction INT NOT NULL,
    change_reason VARCHAR(200),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_card_id) REFERENCES player_cards(id) ON DELETE CASCADE,
    INDEX idx_player_date (player_card_id, created_at)
);
