import pool from '../database/db.js';

async function addViperSong() {
  try {
    // 원딜의신 바이퍼 노래 추가
    const result = await pool.query(
      `INSERT INTO rhythm_songs (title, artist, bpm, duration, difficulty, music_url, bga_url, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        '원딜의신 바이퍼',
        'LOLPRO',
        160,
        180, // 3분
        'HARD',
        '/music/viper.mp3', // 음악 파일 경로
        '/bga/viper.mp4', // BGA 비디오 경로
        '전설적인 원딜 바이퍼의 플레이를 기념하는 곡'
      ]
    );

    const songId = result.insertId;
    console.log(`✅ 원딜의신 바이퍼 노래 추가 완료 (ID: ${songId})`);

    // 난이도별 차트 추가
    const difficulties = [
      { difficulty: 'EASY', noteCount: 200 },
      { difficulty: 'NORMAL', noteCount: 400 },
      { difficulty: 'HARD', noteCount: 650 },
      { difficulty: 'INSANE', noteCount: 1000 }
    ];

    for (const diff of difficulties) {
      const chartResult = await pool.query(
        `INSERT INTO rhythm_charts (song_id, difficulty, note_count)
         VALUES (?, ?, ?)`,
        [songId, diff.difficulty, diff.noteCount]
      );
      console.log(`✅ ${diff.difficulty} 차트 추가 완료 (ID: ${chartResult.insertId}, ${diff.noteCount} notes)`);
    }

    console.log('✅ 모든 작업 완료');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 노래 추가 실패:', error);
    process.exit(1);
  }
}

addViperSong();
