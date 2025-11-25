-- 리듬게임 6키 시스템 지원 추가
-- rhythm_notes 테이블에 타입과 슬라이드 경로 추가

-- 1. 키 범위 확장 (0-5로 변경)
ALTER TABLE rhythm_notes DROP CHECK rhythm_notes_chk_1;
ALTER TABLE rhythm_notes ADD CONSTRAINT key_index_range CHECK (key_index >= 0 AND key_index <= 5);

-- 2. 노트 타입 컬럼 추가
ALTER TABLE rhythm_notes ADD COLUMN type ENUM('NORMAL', 'LONG', 'SLIDE') DEFAULT 'NORMAL' AFTER duration;

-- 3. 슬라이드 경로 컬럼 추가
ALTER TABLE rhythm_notes ADD COLUMN slide_path JSON AFTER type;

-- 기존 노트들은 NORMAL 타입으로 설정됨 (DEFAULT 'NORMAL')
