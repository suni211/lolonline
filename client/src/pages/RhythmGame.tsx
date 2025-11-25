import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/RhythmGame.css';
import RhythmGamePlay from '../components/RhythmGamePlay';

interface Song {
  id: number;
  title: string;
  artist: string;
  bpm: number;
  duration: number;
  difficulty: string;
  cover_image_url?: string;
  description?: string;
  music_url?: string;
}

interface Chart {
  id: number;
  song_id: number;
  difficulty: string;
  note_count: number;
}

const RhythmGame = () => {
  const [gameState, setGameState] = useState<'songSelect' | 'difficultySelect' | 'playing'>('songSelect');
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [loading, setLoading] = useState(true);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [noteSpeed, setNoteSpeed] = useState(1.0);  // 노트 내려오는 속도 (1.0 = 기본, 최대 9.0)

  useEffect(() => {
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const url = `${apiUrl}/api/rhythm-game/songs`;
      console.log('Fetching songs from:', url);
      const response = await axios.get(url);
      const songsData = Array.isArray(response.data) ? response.data : response.data.songs || [];
      setSongs(songsData);
      setLoading(false);
    } catch (error) {
      console.error('곡 목록 조회 실패:', error);
      setLoading(false);
      setSongs([]);
    }
  };

  const handleSongSelect = async (song: Song) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const url = `${apiUrl}/api/rhythm-game/songs/${song.id}`;
      console.log('Fetching charts from:', url);
      const response = await axios.get(url);
      // API는 { song, charts } 형식으로 반환
      const songData = response.data?.song || song;
      const chartsData = response.data?.charts || [];
      setSelectedSong(songData);  // 서버에서 받은 song 정보 사용 (music_url 포함)
      setCharts(Array.isArray(chartsData) ? chartsData : []);
      setGameState('difficultySelect');
    } catch (error) {
      console.error('악보 조회 실패:', error);
      setCharts([]);
    }
  };

  const handleChartSelect = (chart: Chart) => {
    console.log('📊 Chart selected:', chart);
    console.log('🎵 Current selectedSong:', selectedSong);
    setSelectedChart(chart);
    setGameState('playing');
  };

  const handleGameEnd = () => {
    setGameState('songSelect');
    setSelectedSong(null);
    setSelectedChart(null);
  };

  if (loading) {
    return <div className="rhythm-game-container">로딩 중...</div>;
  }

  return (
    <div className="rhythm-game-container">
      {/* 배경음악 토글 */}
      <div className="bgm-control">
        <button
          className={`bgm-toggle ${bgmEnabled ? 'on' : 'off'}`}
          onClick={() => setBgmEnabled(!bgmEnabled)}
        >
          🔊 배경음악 {bgmEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {gameState === 'songSelect' && (
        <div className="song-select-screen">
          <h1>🎵 리듬게임</h1>
          <p className="subtitle">즐길 곡을 선택하세요</p>
          <div className="songs-grid">
            {songs.map((song) => (
              <div
                key={song.id}
                className="song-card"
                onClick={() => handleSongSelect(song)}
              >
                {song.cover_image_url ? (
                  <img src={song.cover_image_url} alt={song.title} className="song-cover" />
                ) : (
                  <div className="song-cover-placeholder">🎵</div>
                )}
                <div className="song-info">
                  <h3>{song.title}</h3>
                  <p className="artist">{song.artist}</p>
                  <p className="meta">♪ {song.bpm} BPM • {Math.round(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gameState === 'difficultySelect' && selectedSong && (
        <div className="difficulty-select-screen">
          <h2>{selectedSong.title}</h2>
          <p className="artist">{selectedSong.artist}</p>
          <p className="subtitle">난이도를 선택하세요</p>

          <div className="difficulty-buttons">
            {charts.map((chart) => (
              <button
                key={chart.id}
                className={`difficulty-btn difficulty-${chart.difficulty.toLowerCase()}`}
                onClick={() => handleChartSelect(chart)}
              >
                <span className="difficulty-name">{chart.difficulty}</span>
                <span className="note-count">{chart.note_count} Notes</span>
              </button>
            ))}
          </div>

          {/* 노트 속도 조정 */}
          <div style={{ marginTop: '30px', padding: '20px', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
            <p style={{ marginBottom: '10px', fontSize: '14px' }}>⚡ 노트 속도: <strong>{noteSpeed.toFixed(1)}x</strong></p>
            <input
              type="range"
              min="1"
              max="9"
              step="0.1"
              value={noteSpeed}
              onChange={(e) => setNoteSpeed(parseFloat(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#f39c12' }}>
              1.0 = 느림 | 5.0 = 보통 | 9.0 = 매우 빠름
            </p>
          </div>

          <button
            className="back-btn"
            onClick={() => {
              setGameState('songSelect');
              setSelectedSong(null);
            }}
          >
            ← 돌아가기
          </button>
        </div>
      )}

      {gameState === 'playing' && selectedSong && selectedChart && (
        <RhythmGamePlay
          song={selectedSong}
          chart={selectedChart}
          bgmEnabled={bgmEnabled}
          noteSpeed={noteSpeed}
          onGameEnd={handleGameEnd}
        />
      )}
    </div>
  );
};

export default RhythmGame;
