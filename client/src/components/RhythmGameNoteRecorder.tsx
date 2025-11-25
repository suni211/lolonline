import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/RhythmGameNoteRecorder.css';

interface Song {
  id: number;
  title: string;
  artist: string;
  bpm: number;
  duration: number;
  music_url?: string;
}

interface RecordedNote {
  key_index: number;
  timing: number;
  duration: number;
}

const RhythmGameNoteRecorder = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('NORMAL');
  const [recordedNotes, setRecordedNotes] = useState<RecordedNote[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const keyPressRef = useRef<{ [key: number]: number | null }>({ 0: null, 1: null, 2: null, 3: null });

  const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD', 'INSANE'];
  const KEYS = [
    { index: 0, label: 'D / ←', key: 'd', color: '#3498db' },
    { index: 1, label: 'F', key: 'f', color: '#9b59b6' },
    { index: 2, label: 'J', key: 'j', color: '#e74c3c' },
    { index: 3, label: 'K / →', key: 'k', color: '#f39c12' }
  ];

  useEffect(() => {
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    try {
      const response = await axios.get('/api/rhythm-game/songs');
      const songsData = Array.isArray(response.data) ? response.data : response.data.songs || [];
      setSongs(songsData);
    } catch (error) {
      console.error('fetchSongs error:', error);
      setMessage('곡 목록 로드 실패');
      setSongs([]);
    }
  };

  const handleSongSelect = (song: Song) => {
    setSelectedSong(song);
    setRecordedNotes([]);
    setCurrentTime(0);
    setIsRecording(false);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const startRecording = () => {
    if (!selectedSong || !audioRef.current) return;

    setRecordedNotes([]);
    setCurrentTime(0);
    setIsRecording(true);
    audioRef.current.currentTime = 0;
    audioRef.current.play();

    const gameLoop = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime * 1000);

        // 곡이 끝났을 때
        if (audioRef.current.currentTime >= selectedSong.duration) {
          stopRecording();
          return;
        }
      }
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    setMessage('✅ 녹음 완료! 노트를 확인하고 수정한 후 저장하세요');
    setTimeout(() => setMessage(''), 3000);
  };

  const getKeyIndex = (key: string): number | null => {
    const keyConfig = KEYS.find(k => k.key === key || (key === 'arrowleft' && k.index === 0) || (key === 'arrowright' && k.index === 3));
    return keyConfig ? keyConfig.index : null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isRecording) return;

    const key = e.key.toLowerCase();
    const keyIndex = getKeyIndex(key);

    if (keyIndex === null) return;

    // 이미 이 키가 눌려있으면 무시 (동시 눌림 방지)
    if (keyPressRef.current[keyIndex] !== null) return;

    e.preventDefault();
    // 이 키의 누르기 시작 시간 기록
    keyPressRef.current[keyIndex] = currentTime;
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isRecording) return;

    const key = e.key.toLowerCase();
    const keyIndex = getKeyIndex(key);

    if (keyIndex === null || keyPressRef.current[keyIndex] === null) return;

    e.preventDefault();

    const startTime = keyPressRef.current[keyIndex]!;
    const endTime = currentTime;
    const duration = Math.max(0, endTime - startTime);

    const newNote: RecordedNote = {
      key_index: keyIndex,
      timing: Math.round(startTime),
      duration: Math.round(duration)
    };

    setRecordedNotes([...recordedNotes, newNote].sort((a, b) => a.timing - b.timing));

    // 키 누르기 상태 초기화
    keyPressRef.current[keyIndex] = null;
  };

  const removeNote = (index: number) => {
    setRecordedNotes(recordedNotes.filter((_, i) => i !== index));
  };

  const updateNote = (index: number, field: keyof RecordedNote, value: number) => {
    const updatedNotes = [...recordedNotes];
    updatedNotes[index] = { ...updatedNotes[index], [field]: value };
    setRecordedNotes(updatedNotes.sort((a, b) => a.timing - b.timing));
  };

  const saveChart = async () => {
    if (!selectedSong || recordedNotes.length === 0) {
      setMessage('곡과 노트를 추가해주세요');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/rhythm-game/charts', {
        songId: selectedSong.id,
        difficulty: selectedDifficulty,
        notes: recordedNotes
      });

      if (response.data.success) {
        setMessage(`✅ ${selectedDifficulty} 악보가 저장되었습니다! (${recordedNotes.length}개 노트)`);
        setRecordedNotes([]);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || '저장 실패');
    } finally {
      setLoading(false);
    }
  };

  const clearNotes = () => {
    if (window.confirm('모든 노트를 삭제하시겠습니까?')) {
      setRecordedNotes([]);
    }
  };

  return (
    <div className="rhythm-game-note-recorder" onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} tabIndex={0}>
      <h2>🎵 리듬게임 노트 녹음기</h2>

      <div className="recorder-layout">
        {/* 곡 선택 */}
        <div className="song-selector">
          <h3>곡 선택</h3>
          <div className="songs-list">
            {songs.map((song) => (
              <div
                key={song.id}
                className={`song-item ${selectedSong?.id === song.id ? 'selected' : ''}`}
                onClick={() => handleSongSelect(song)}
              >
                <div className="song-title">{song.title}</div>
                <div className="song-artist">{song.artist}</div>
                <div className="song-meta">♪ {song.bpm} BPM</div>
              </div>
            ))}
          </div>
        </div>

        {/* 녹음 컨트롤 */}
        {selectedSong && (
          <div className="recorder-section">
            <div className="recorder-info">
              <div className="current-song">
                <h4>{selectedSong.title}</h4>
                <p>{selectedSong.artist}</p>
              </div>

              <div className="recorder-controls">
                <div className="control-group">
                  <label>난이도</label>
                  <select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value)}>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="playback-info">
                  <div className="time-display">
                    {Math.floor(currentTime / 1000)}:
                    {Math.floor((currentTime % 1000) / 10)
                      .toString()
                      .padStart(2, '0')}
                  </div>
                  <div className="duration-display">
                    / {Math.floor(selectedSong.duration / 60)}:
                    {(selectedSong.duration % 60).toString().padStart(2, '0')}
                  </div>
                </div>

                <div className="note-count">
                  노트: {recordedNotes.length}개
                </div>
              </div>

              {/* 녹음 버튼 */}
              <div className="recording-buttons">
                {!isRecording ? (
                  <button onClick={startRecording} className="record-btn">
                    🔴 녹음 시작
                  </button>
                ) : (
                  <button onClick={stopRecording} className="stop-btn">
                    ⏹ 녹음 중지
                  </button>
                )}
              </div>

              {isRecording && (
                <div className="recording-indicator">
                  <div className="recording-dot"></div>
                  녹음 중... DFJK를 눌러 노트를 추가하세요
                </div>
              )}
            </div>

            {/* 키 안내 */}
            <div className="keys-guide">
              <p>⌨️ 키 설정</p>
              <div className="keys-grid">
                {KEYS.map((key) => (
                  <div key={key.index} className="key-guide-item" style={{ borderColor: key.color }}>
                    <span className="key-label" style={{ color: key.color }}>{key.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 노트 목록 */}
            {recordedNotes.length > 0 && (
              <div className="notes-list">
                <h4>녹음된 노트 ({recordedNotes.length})</h4>
                <div className="notes-table">
                  <div className="table-header">
                    <div className="col-time">시간 (ms)</div>
                    <div className="col-key">키</div>
                    <div className="col-duration">길이</div>
                    <div className="col-action">삭제</div>
                  </div>
                  {recordedNotes.map((note, idx) => (
                    <div key={idx} className="table-row">
                      <div className="col-time">
                        <input
                          type="number"
                          min="0"
                          value={note.timing}
                          onChange={(e) => updateNote(idx, 'timing', Number(e.target.value))}
                        />
                      </div>
                      <div className="col-key">
                        <select
                          value={note.key_index}
                          onChange={(e) => updateNote(idx, 'key_index', Number(e.target.value))}
                        >
                          {KEYS.map((k) => (
                            <option key={k.index} value={k.index}>{k.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-duration">
                        <input
                          type="number"
                          min="0"
                          value={note.duration}
                          onChange={(e) => updateNote(idx, 'duration', Number(e.target.value))}
                        />
                      </div>
                      <div className="col-action">
                        <button onClick={() => removeNote(idx)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="recorder-actions">
              <button onClick={saveChart} disabled={loading || recordedNotes.length === 0} className="save-btn">
                {loading ? '저장 중...' : '악보 저장'}
              </button>
              <button onClick={clearNotes} disabled={recordedNotes.length === 0} className="clear-btn">
                노트 모두 삭제
              </button>
            </div>

            {message && (
              <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 오디오 */}
      <audio ref={audioRef} src={selectedSong?.music_url} crossOrigin="anonymous" />

      {/* 사용 설명서 */}
      <div className="recorder-guide">
        <h3>📖 사용 설명</h3>
        <ul>
          <li><strong>곡 선택:</strong> 좌측에서 악보를 만들 곡을 선택합니다</li>
          <li><strong>난이도 설정:</strong> EASY / NORMAL / HARD / INSANE 중 하나를 선택합니다</li>
          <li><strong>녹음 시작:</strong> "🔴 녹음 시작" 버튼을 누르면 음악이 재생됩니다</li>
          <li><strong>노트 추가:</strong> 음악을 들으면서 <strong>D, F, J, K</strong> 키를 누르면 그 타이밍에 노트가 추가됩니다</li>
          <li><strong>녹음 중지:</strong> "⏹ 녹음 중지" 버튼을 누르거나 곡이 끝나면 자동 중지됩니다</li>
          <li><strong>노트 조정:</strong> 아래 테이블에서 각 노트의 정확한 시간(ms)과 길이를 수정할 수 있습니다</li>
          <li><strong>저장:</strong> 조정을 완료한 후 "악보 저장" 버튼으로 저장합니다</li>
        </ul>
        <p className="guide-tip">💡 팁: 한 번에 하나의 난이도씩 녹음하고 저장합니다</p>
      </div>
    </div>
  );
};

export default RhythmGameNoteRecorder;
