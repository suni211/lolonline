-- 원딜의신 바이퍼 노래 추가
INSERT INTO rhythm_songs (title, artist, bpm, duration, difficulty, music_url, bga_url, description)
VALUES ('원딜의신 바이퍼', 'HanwhaLifeEsports', 196, 138, 'HARD', 'uploads/music/viper.mp3', 'uploads/bga/viper.mp4', '원딜의신 지려버려');

-- 차트 추가
INSERT INTO rhythm_charts (song_id, difficulty, note_count) VALUES (LAST_INSERT_ID(), 'EASY', 200);
INSERT INTO rhythm_charts (song_id, difficulty, note_count) VALUES (LAST_INSERT_ID(), 'NORMAL', 400);
INSERT INTO rhythm_charts (song_id, difficulty, note_count) VALUES (LAST_INSERT_ID(), 'HARD', 650);
INSERT INTO rhythm_charts (song_id, difficulty, note_count) VALUES (LAST_INSERT_ID(), 'INSANE', 1000);
