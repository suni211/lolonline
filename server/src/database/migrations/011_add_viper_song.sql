-- 원딜의신 바이퍼 노래 추가
INSERT INTO rhythm_songs (title, artist, bpm, duration, difficulty, music_url, bga_url, description)
VALUES ('원딜의신 바이퍼', 'LOLPRO', 160, 180, 'HARD', '/music/viper.mp3', '/bga/viper.mp4', '전설적인 원딜 바이퍼의 플레이를 기념하는 곡');

-- 차트 추가 (songId는 수동으로 확인 후 변경 필요)
-- INSERT INTO rhythm_charts (song_id, difficulty, note_count) VALUES (LAST_INSERT_ID(), 'EASY', 200);
-- INSERT INTO rhythm_charts (song_id, difficulty, note_count) VALUES (LAST_INSERT_ID(), 'NORMAL', 400);
-- INSERT INTO rhythm_charts (song_id, difficulty, note_count) VALUES (LAST_INSERT_ID(), 'HARD', 650);
-- INSERT INTO rhythm_charts (song_id, difficulty, note_count) VALUES (LAST_INSERT_ID(), 'INSANE', 1000);
