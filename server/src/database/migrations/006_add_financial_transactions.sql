-- 재정 거래 내역 테이블 (모든 금전 거래를 기록)
CREATE TABLE IF NOT EXISTS financial_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    transaction_type ENUM('INCOME', 'EXPENSE') NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'MATCH_WIN', 'MATCH_LOSE', 'STREAMING', 'TRANSFER', 'TRAINING', 'FACILITY', 'SPONSOR', 'MERCHANDISE', 'SALARY' 등
    amount BIGINT NOT NULL,
    description TEXT,
    reference_id INT NULL, -- match_id, player_card_id 등 참조 ID
    reference_type VARCHAR(50) NULL, -- 'match', 'player', 'facility' 등
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_team_date (team_id, created_at DESC),
    INDEX idx_type_date (transaction_type, created_at DESC),
    INDEX idx_category (category)
);
