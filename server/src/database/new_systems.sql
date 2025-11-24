-- 새로운 시스템 테이블들

-- 0. 외래 키 체크 비활성화
SET FOREIGN_KEY_CHECKS = 0;

-- 리그 테이블 region 컬럼 업데이트 (SOUTH/NORTH만 사용)
ALTER TABLE leagues MODIFY COLUMN region ENUM('SOUTH', 'NORTH') NOT NULL;

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

    -- 팀 전술 설정
    teamfight_style ENUM('FIGHT_FIRST', 'OBJECTIVE_FIRST') DEFAULT 'FIGHT_FIRST',
    split_formation ENUM('STANDARD', '1-3-1', '1-4', '4-1') DEFAULT 'STANDARD',
    aggression_level ENUM('PASSIVE', 'BALANCED', 'AGGRESSIVE') DEFAULT 'BALANCED',
    priority_objective ENUM('DRAGON', 'BARON', 'TOWER') DEFAULT 'DRAGON',
    early_game_strategy ENUM('FARM', 'GANK', 'INVADE') DEFAULT 'FARM',

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

-- 기본 코치 데이터 (200명)
INSERT INTO coaches (name, nationality, coach_type, skill_level, salary, experience_years, specialty) VALUES
-- HEAD 코치들 (35명)
('03261592630', 'KR', 'HEAD', 70, 15000000, 5, '전체 팀 운영'),
('Paronoa', 'US', 'HEAD', 80, 25000000, 8, '국제 경험'),
('MasterMind', 'KR', 'HEAD', 85, 30000000, 10, '챔피언십 경험'),
('StormLeader', 'CN', 'HEAD', 75, 20000000, 6, '공격적 운영'),
('CalmGeneral', 'KR', 'HEAD', 65, 12000000, 4, '안정적 운영'),
('TacticalGenius', 'KR', 'HEAD', 90, 35000000, 12, '전술 마스터'),
('VeteranCoach', 'US', 'HEAD', 82, 28000000, 9, '베테랑 경험'),
('RisingStar', 'KR', 'HEAD', 68, 14000000, 3, '신예 감독'),
('ChampionMaker', 'CN', 'HEAD', 88, 32000000, 11, '우승 경험'),
('SteadyHand', 'JP', 'HEAD', 72, 16000000, 5, '안정적 리더십'),
('AggressiveCoach', 'KR', 'HEAD', 76, 19000000, 6, '공격적 스타일'),
('DefenseMaster', 'EU', 'HEAD', 74, 17000000, 5, '수비적 전략'),
('RookieTrainer', 'KR', 'HEAD', 62, 10000000, 2, '신인 육성'),
('MetaKing', 'CN', 'HEAD', 79, 23000000, 7, '메타 적응'),
('TeamBuilder', 'US', 'HEAD', 77, 21000000, 7, '팀 빌딩'),
('ClutchCoach', 'KR', 'HEAD', 83, 27000000, 8, '결정적 순간'),
('AnalyticalMind', 'JP', 'HEAD', 71, 15000000, 4, '분석적 접근'),
('PassionateLeader', 'KR', 'HEAD', 69, 13000000, 4, '열정적 리더'),
('CoolHead', 'EU', 'HEAD', 73, 16000000, 5, '냉철한 판단'),
('StrategistPrime', 'CN', 'HEAD', 81, 26000000, 8, '전략의 달인'),
('YoungProdigy', 'KR', 'HEAD', 64, 11000000, 2, '젊은 천재'),
('WiseSage', 'US', 'HEAD', 86, 31000000, 10, '현명한 조언'),
('BoldLeader', 'KR', 'HEAD', 75, 18000000, 6, '과감한 결정'),
('PatientCoach', 'JP', 'HEAD', 70, 14000000, 4, '인내심 있는 지도'),
('AdaptiveGenius', 'CN', 'HEAD', 78, 22000000, 7, '적응력 천재'),
('MotivatorPro', 'KR', 'HEAD', 67, 12000000, 3, '동기부여 전문'),
('TournamentAce', 'EU', 'HEAD', 84, 29000000, 9, '토너먼트 전문'),
('RegularKing', 'US', 'HEAD', 72, 15000000, 5, '정규시즌 강자'),
('PlayoffMaster', 'KR', 'HEAD', 80, 24000000, 8, '플레이오프 전문'),
('DraftGenius', 'CN', 'HEAD', 76, 19000000, 6, '드래프트 천재'),
('SynergyBuilder', 'JP', 'HEAD', 71, 14000000, 4, '시너지 구축'),
('PressureHandler', 'KR', 'HEAD', 74, 17000000, 5, '압박 관리'),
('LongTermPlanner', 'EU', 'HEAD', 69, 13000000, 4, '장기 계획'),
('QuickAdapter', 'US', 'HEAD', 73, 16000000, 5, '빠른 적응'),
('TeamMotivator', 'KR', 'HEAD', 66, 11000000, 3, '팀 사기 진작'),

-- STRATEGY 코치들 (35명)
('Vilrain', 'KR', 'STRATEGY', 65, 10000000, 3, '밴픽 전략'),
('CGG', 'CN', 'STRATEGY', 75, 18000000, 6, 'LPL 스타일'),
('DraftKing', 'KR', 'STRATEGY', 80, 22000000, 7, '메타 분석'),
('BluePrint', 'EU', 'STRATEGY', 70, 15000000, 5, '전략 설계'),
('ChessPlayer', 'KR', 'STRATEGY', 60, 8000000, 2, '초반 전략'),
('PickBanPro', 'US', 'STRATEGY', 78, 20000000, 6, '밴픽 마스터'),
('LateGameExpert', 'CN', 'STRATEGY', 73, 16000000, 5, '후반 전략'),
('EarlyAggressor', 'KR', 'STRATEGY', 68, 12000000, 4, '초반 압박'),
('ObjectiveKing', 'JP', 'STRATEGY', 76, 19000000, 6, '오브젝트 전략'),
('TeamfightCoach', 'EU', 'STRATEGY', 72, 15000000, 5, '한타 전략'),
('SplitPushGuru', 'KR', 'STRATEGY', 67, 11000000, 3, '스플릿 전략'),
('VisionMaster', 'CN', 'STRATEGY', 74, 17000000, 5, '시야 장악'),
('RotationExpert', 'US', 'STRATEGY', 71, 14000000, 4, '로테이션'),
('ComboCreator', 'KR', 'STRATEGY', 69, 13000000, 4, '조합 설계'),
('CounterPicker', 'JP', 'STRATEGY', 77, 19000000, 6, '카운터 픽'),
('FlexPickPro', 'EU', 'STRATEGY', 70, 14000000, 4, '플렉스 픽'),
('BanSpecialist', 'CN', 'STRATEGY', 66, 10000000, 3, '밴 전문가'),
('CompBuilder', 'KR', 'STRATEGY', 75, 18000000, 6, '조합 구성'),
('MacroMaster', 'US', 'STRATEGY', 79, 21000000, 7, '매크로 전략'),
('MicroCoach', 'JP', 'STRATEGY', 64, 9000000, 2, '미시적 전략'),
('AdaptiveStrat', 'KR', 'STRATEGY', 72, 15000000, 5, '상황 적응'),
('AggressivePlay', 'CN', 'STRATEGY', 68, 12000000, 4, '공격적 플레이'),
('DefensiveStrat', 'EU', 'STRATEGY', 67, 11000000, 3, '수비적 전략'),
('BalancedApproach', 'KR', 'STRATEGY', 70, 14000000, 4, '균형잡힌 전략'),
('RiskTaker', 'US', 'STRATEGY', 73, 16000000, 5, '과감한 전략'),
('SafePlayer', 'JP', 'STRATEGY', 65, 10000000, 3, '안정적 전략'),
('CreativeStrat', 'CN', 'STRATEGY', 76, 18000000, 6, '창의적 전략'),
('TextbookCoach', 'KR', 'STRATEGY', 63, 8000000, 2, '정석 전략'),
('UnorthodoxPlan', 'EU', 'STRATEGY', 74, 17000000, 5, '파격적 전략'),
('PatienceStrat', 'US', 'STRATEGY', 69, 13000000, 4, '인내의 전략'),
('QuickDecision', 'KR', 'STRATEGY', 71, 14000000, 4, '빠른 판단'),
('LongGamePlan', 'JP', 'STRATEGY', 66, 10000000, 3, '장기전 전략'),
('BlitzStrat', 'CN', 'STRATEGY', 77, 19000000, 6, '속공 전략'),
('SiegeExpert', 'KR', 'STRATEGY', 68, 12000000, 4, '공성 전략'),
('PokeCompGuru', 'EU', 'STRATEGY', 72, 15000000, 5, '견제 조합'),

-- MENTAL 코치들 (35명)
('LeadingSquash68', 'KR', 'MENTAL', 60, 8000000, 2, '멘탈 케어'),
('ZenMaster', 'JP', 'MENTAL', 75, 16000000, 6, '명상 지도'),
('MindHealer', 'KR', 'MENTAL', 70, 12000000, 4, '스트레스 관리'),
('PeaceKeeper', 'US', 'MENTAL', 65, 10000000, 3, '팀 화합'),
('SoulDoctor', 'KR', 'MENTAL', 55, 6000000, 1, '신인 멘탈 관리'),
('CalmInfluence', 'CN', 'MENTAL', 72, 14000000, 5, '차분한 영향력'),
('PositiveVibes', 'EU', 'MENTAL', 68, 11000000, 3, '긍정적 분위기'),
('StressRelief', 'KR', 'MENTAL', 64, 9000000, 2, '스트레스 해소'),
('FocusTrainer', 'US', 'MENTAL', 73, 15000000, 5, '집중력 훈련'),
('ConfidenceBuilder', 'JP', 'MENTAL', 69, 12000000, 4, '자신감 구축'),
('AnxietyHelper', 'KR', 'MENTAL', 66, 10000000, 3, '불안감 해소'),
('TeamBonding', 'CN', 'MENTAL', 71, 13000000, 4, '팀 결속'),
('MoodManager', 'EU', 'MENTAL', 62, 8000000, 2, '분위기 관리'),
('MotivationPro', 'US', 'MENTAL', 74, 16000000, 5, '동기부여'),
('PressureCure', 'KR', 'MENTAL', 70, 12000000, 4, '압박감 해소'),
('RelaxationGuru', 'JP', 'MENTAL', 67, 11000000, 3, '이완 훈련'),
('EmotionalCoach', 'CN', 'MENTAL', 63, 9000000, 2, '감정 조절'),
('MindfulnessEx', 'KR', 'MENTAL', 76, 17000000, 6, '마음챙김'),
('CommunicationPro', 'EU', 'MENTAL', 68, 11000000, 3, '소통 전문'),
('ConflictSolver', 'US', 'MENTAL', 72, 14000000, 5, '갈등 해결'),
('TrustBuilder', 'KR', 'MENTAL', 65, 10000000, 3, '신뢰 구축'),
('ResilienceCoach', 'JP', 'MENTAL', 71, 13000000, 4, '회복탄력성'),
('OptimismPro', 'CN', 'MENTAL', 64, 9000000, 2, '낙관적 사고'),
('CrisisManager', 'EU', 'MENTAL', 73, 15000000, 5, '위기 관리'),
('GroupDynamics', 'KR', 'MENTAL', 67, 11000000, 3, '집단 역학'),
('IndividualCare', 'US', 'MENTAL', 66, 10000000, 3, '개인 케어'),
('PerformanceAnx', 'JP', 'MENTAL', 69, 12000000, 4, '경기 불안'),
('SlumpBuster', 'CN', 'MENTAL', 74, 16000000, 5, '슬럼프 탈출'),
('PeakPerform', 'KR', 'MENTAL', 77, 18000000, 6, '최고 컨디션'),
('BalanceLife', 'EU', 'MENTAL', 63, 8000000, 2, '일상 균형'),
('SleepCoach', 'US', 'MENTAL', 65, 10000000, 3, '수면 관리'),
('NutritionMind', 'KR', 'MENTAL', 62, 8000000, 2, '영양과 정신'),
('HolisticCare', 'JP', 'MENTAL', 70, 13000000, 4, '전인적 케어'),
('WellnessExpert', 'CN', 'MENTAL', 68, 11000000, 3, '웰니스 전문'),
('BurnoutPrev', 'KR', 'MENTAL', 71, 14000000, 4, '번아웃 예방'),

-- PHYSICAL 코치들 (35명)
('Valaon', 'KR', 'PHYSICAL', 55, 7000000, 2, '체력 관리'),
('IronBody', 'KR', 'PHYSICAL', 70, 12000000, 5, '피지컬 트레이닝'),
('FlexMaster', 'US', 'PHYSICAL', 65, 9000000, 3, '유연성 훈련'),
('EnduranceX', 'CN', 'PHYSICAL', 60, 8000000, 2, '지구력 강화'),
('QuickReflex', 'KR', 'PHYSICAL', 75, 14000000, 6, '반응속도 훈련'),
('StrengthCoach', 'JP', 'PHYSICAL', 68, 11000000, 4, '근력 훈련'),
('CardioKing', 'EU', 'PHYSICAL', 63, 8000000, 2, '유산소 운동'),
('CoreTrainer', 'US', 'PHYSICAL', 66, 10000000, 3, '코어 훈련'),
('AgilityPro', 'KR', 'PHYSICAL', 72, 13000000, 5, '민첩성 훈련'),
('BalanceExpert', 'CN', 'PHYSICAL', 64, 9000000, 2, '균형감각'),
('PostureCoach', 'JP', 'PHYSICAL', 67, 10000000, 3, '자세 교정'),
('BreathingGuru', 'KR', 'PHYSICAL', 61, 7000000, 2, '호흡법'),
('WarmupPro', 'EU', 'PHYSICAL', 58, 6000000, 1, '준비운동'),
('CooldownEx', 'US', 'PHYSICAL', 59, 6000000, 1, '정리운동'),
('InjuryPrev', 'CN', 'PHYSICAL', 73, 14000000, 5, '부상 예방'),
('RehabCoach', 'KR', 'PHYSICAL', 71, 12000000, 4, '재활 훈련'),
('HandExercise', 'JP', 'PHYSICAL', 69, 11000000, 4, '손 운동'),
('WristCare', 'EU', 'PHYSICAL', 74, 15000000, 5, '손목 관리'),
('NeckStretch', 'US', 'PHYSICAL', 62, 8000000, 2, '목 스트레칭'),
('BackHealth', 'KR', 'PHYSICAL', 70, 12000000, 4, '허리 건강'),
('EyeExercise', 'CN', 'PHYSICAL', 65, 9000000, 3, '눈 운동'),
('ShoulderFlex', 'JP', 'PHYSICAL', 63, 8000000, 2, '어깨 유연성'),
('FingerAgility', 'KR', 'PHYSICAL', 76, 16000000, 6, '손가락 민첩'),
('ReactionDrill', 'EU', 'PHYSICAL', 68, 10000000, 3, '반응 훈련'),
('StaminaBuilder', 'US', 'PHYSICAL', 67, 10000000, 3, '체력 증진'),
('RecoveryPro', 'CN', 'PHYSICAL', 72, 13000000, 5, '회복 전문'),
('EnergyManager', 'KR', 'PHYSICAL', 64, 9000000, 2, '에너지 관리'),
('SleepOptimize', 'JP', 'PHYSICAL', 66, 10000000, 3, '수면 최적화'),
('NutritionFit', 'EU', 'PHYSICAL', 69, 11000000, 4, '영양 관리'),
('HydrationPro', 'US', 'PHYSICAL', 57, 5000000, 1, '수분 관리'),
('CircuitTrainer', 'KR', 'PHYSICAL', 71, 12000000, 4, '서킷 트레이닝'),
('HIITCoach', 'CN', 'PHYSICAL', 68, 10000000, 3, 'HIIT 훈련'),
('YogaForGamers', 'JP', 'PHYSICAL', 65, 9000000, 3, '게이머 요가'),
('PilatesCoach', 'KR', 'PHYSICAL', 63, 8000000, 2, '필라테스'),
('MobilityExpert', 'EU', 'PHYSICAL', 70, 12000000, 4, '가동성 훈련'),

-- ANALYST 코치들 (35명)
('Delpinium', 'KR', 'ANALYST', 70, 9000000, 4, '상대 분석'),
('GaeNald', 'JP', 'ANALYST', 65, 11000000, 4, '데이터 분석'),
('StatGuru', 'KR', 'ANALYST', 80, 18000000, 7, '통계 전문가'),
('VODHunter', 'EU', 'ANALYST', 75, 15000000, 5, 'VOD 분석'),
('MetaReader', 'KR', 'ANALYST', 60, 7000000, 2, '메타 리딩'),
('PatternSeeker', 'CN', 'ANALYST', 70, 12000000, 4, '패턴 분석'),
('DataWizard', 'US', 'ANALYST', 78, 17000000, 6, '데이터 마법사'),
('NumberCruncher', 'KR', 'ANALYST', 72, 13000000, 5, '숫자 분석'),
('TrendSpotter', 'JP', 'ANALYST', 68, 10000000, 3, '트렌드 발견'),
('OpponentExpert', 'EU', 'ANALYST', 74, 14000000, 5, '상대팀 전문'),
('MatchReviewer', 'CN', 'ANALYST', 66, 9000000, 3, '경기 리뷰'),
('ProPlayerWatch', 'KR', 'ANALYST', 71, 12000000, 4, '프로 분석'),
('DraftAnalyst', 'US', 'ANALYST', 73, 14000000, 5, '드래프트 분석'),
('WinrateCalc', 'JP', 'ANALYST', 67, 10000000, 3, '승률 계산'),
('DamageAnalyst', 'EU', 'ANALYST', 69, 11000000, 4, '딜량 분석'),
('GoldTracker', 'KR', 'ANALYST', 64, 8000000, 2, '골드 추적'),
('ObjectiveTimer', 'CN', 'ANALYST', 76, 15000000, 5, '오브젝트 타이밍'),
('MapAnalyst', 'US', 'ANALYST', 70, 12000000, 4, '맵 분석'),
('ChampionData', 'JP', 'ANALYST', 68, 10000000, 3, '챔피언 데이터'),
('ItemBuildPro', 'KR', 'ANALYST', 63, 8000000, 2, '아이템 분석'),
('RuneAnalyst', 'EU', 'ANALYST', 62, 7000000, 2, '룬 분석'),
('PatchExpert', 'CN', 'ANALYST', 77, 16000000, 6, '패치 분석'),
('ScrimReviewer', 'US', 'ANALYST', 71, 12000000, 4, '스크림 리뷰'),
('SoloQTracker', 'KR', 'ANALYST', 65, 9000000, 3, '솔로랭 추적'),
('TeamfightAnal', 'JP', 'ANALYST', 72, 13000000, 5, '한타 분석'),
('LaningPhase', 'EU', 'ANALYST', 69, 11000000, 4, '라인전 분석'),
('JungleTracker', 'CN', 'ANALYST', 74, 14000000, 5, '정글 동선'),
('WardAnalyst', 'KR', 'ANALYST', 66, 9000000, 3, '와드 분석'),
('CommsReview', 'US', 'ANALYST', 67, 10000000, 3, '콜 리뷰'),
('MistakeSpotter', 'JP', 'ANALYST', 73, 14000000, 5, '실수 발견'),
('ImprovementPlan', 'EU', 'ANALYST', 70, 12000000, 4, '개선점 도출'),
('StrengthFinder', 'KR', 'ANALYST', 68, 10000000, 3, '강점 분석'),
('WeaknessFix', 'CN', 'ANALYST', 75, 15000000, 5, '약점 보완'),
('EfficiencyPro', 'US', 'ANALYST', 71, 12000000, 4, '효율성 분석'),
('ComparisonEx', 'KR', 'ANALYST', 64, 8000000, 2, '비교 분석'),

-- DOCTOR 코치들 (25명)
('Asharosa', 'KR', 'DOCTOR', 75, 12000000, 6, '부상 치료'),
('HandDoctor', 'KR', 'DOCTOR', 80, 20000000, 8, '손목 전문'),
('EyeCare', 'JP', 'DOCTOR', 70, 14000000, 5, '시력 관리'),
('BackHealer', 'US', 'DOCTOR', 65, 10000000, 3, '척추 관리'),
('SleepExpert', 'KR', 'DOCTOR', 60, 8000000, 2, '수면 관리'),
('NeckSpecialist', 'CN', 'DOCTOR', 72, 15000000, 5, '목 전문'),
('ShoulderDoc', 'EU', 'DOCTOR', 68, 12000000, 4, '어깨 치료'),
('PhysioTherapy', 'US', 'DOCTOR', 76, 18000000, 6, '물리치료'),
('SportsDoctor', 'KR', 'DOCTOR', 78, 19000000, 7, '스포츠 의학'),
('NutritionDoc', 'JP', 'DOCTOR', 67, 11000000, 3, '영양 의학'),
('MentalHealth', 'CN', 'DOCTOR', 73, 16000000, 5, '정신건강'),
('GeneralCare', 'EU', 'DOCTOR', 64, 9000000, 2, '일반 건강'),
('PreventiveMed', 'KR', 'DOCTOR', 71, 14000000, 4, '예방 의학'),
('EmergencyDoc', 'US', 'DOCTOR', 74, 17000000, 5, '응급 처치'),
('RehabDoctor', 'JP', 'DOCTOR', 69, 13000000, 4, '재활 의학'),
('ChronicCare', 'CN', 'DOCTOR', 66, 10000000, 3, '만성질환'),
('PainManager', 'EU', 'DOCTOR', 70, 14000000, 4, '통증 관리'),
('PostureMedic', 'KR', 'DOCTOR', 63, 8000000, 2, '자세 교정'),
('StressRelief', 'US', 'DOCTOR', 68, 12000000, 4, '스트레스 해소'),
('HealthScreen', 'JP', 'DOCTOR', 65, 10000000, 3, '건강검진'),
('ImmunityBoost', 'CN', 'DOCTOR', 67, 11000000, 3, '면역력 강화'),
('VitaminPro', 'EU', 'DOCTOR', 61, 7000000, 2, '비타민 관리'),
('HolisticMed', 'KR', 'DOCTOR', 72, 15000000, 5, '통합 의학'),
('SportsPsych', 'US', 'DOCTOR', 75, 17000000, 6, '스포츠 심리'),
('WellnessDoc', 'JP', 'DOCTOR', 69, 13000000, 4, '웰니스 의학')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 플레이오프 부전승 팀 (1위, 2위는 준결승 직행)
CREATE TABLE IF NOT EXISTS playoff_byes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    playoff_id INT NOT NULL,
    team_id INT NOT NULL,
    seed INT NOT NULL,  -- 1 = 1위, 2 = 2위
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playoff_id) REFERENCES playoffs(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_playoff_bye (playoff_id, team_id)
);

-- WORLDS 진출팀 (리그별 상위 4팀)
CREATE TABLE IF NOT EXISTS worlds_qualifiers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    playoff_id INT NOT NULL,
    league_id INT NOT NULL,
    team_id INT NOT NULL,
    position INT NOT NULL,  -- 1 = 우승, 2 = 준우승, 3 = 3위, 4 = 4위
    season INT NOT NULL,
    qualified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playoff_id) REFERENCES playoffs(id) ON DELETE CASCADE,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_worlds_qualifier (playoff_id, team_id)
);

-- playoffs 테이블 status 컬럼에 WILDCARD 추가
ALTER TABLE playoffs MODIFY COLUMN status ENUM('UPCOMING', 'WILDCARD', 'QUARTER', 'SEMI', 'FINAL', 'COMPLETED') DEFAULT 'UPCOMING';

-- 외래 키 체크 다시 활성화
SET FOREIGN_KEY_CHECKS = 1;
