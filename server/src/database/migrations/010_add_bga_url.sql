-- BGA (Background Animation) URL 컬럼 추가
ALTER TABLE rhythm_songs ADD COLUMN IF NOT EXISTS bga_url VARCHAR(500) AFTER music_url;
