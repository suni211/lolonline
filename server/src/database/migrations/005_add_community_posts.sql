-- 커뮤니티 게시글 테이블
CREATE TABLE IF NOT EXISTS community_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    author_nickname VARCHAR(100) NOT NULL,
    post_type ENUM('MATCH_REVIEW', 'MATCH_REACTION', 'PLAYER_PRAISE', 'TEAM_DISCUSSION', 'GENERAL') DEFAULT 'GENERAL',
    content TEXT NOT NULL,
    match_id INT NULL,
    likes INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL,
    INDEX idx_team_created (team_id, created_at DESC),
    INDEX idx_match (match_id)
);
