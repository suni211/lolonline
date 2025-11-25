import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/RhythmGameNoteEditor.css';

interface Song {
  id: number;
  title: string;
  artist: string;
  bpm: number;
  duration: number;
}

interface Note {
  id?: number;
  key_index: number;
  timing: number;
  duration: number;
}

const RhythmGameNoteEditor = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [notes, setNotes] = useState<Note[]>([]);
  const [bpm, setBpm] = useState(120);
  const [duration, setDuration] = useState(240);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD', 'INSANE'];
  const KEYS = [
    { index: 0, label: 'D / ←', color: '#3498db' },
    { index: 1, label: 'F', color: '#9b59b6' },
    { index: 2, label: 'J', color: '#e74c3c' },
    { index: 3, label: 'K / →', color: '#f39c12' }
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
    setBpm(song.bpm);
    setDuration(song.duration);
    setNotes([]);
  };

  const addNote = (keyIndex: number, timing: number) => {
    if (!selectedSong) return;

    const newNote: Note = {
      key_index: keyIndex,
      timing: Math.round(timing),
      duration: 0
    };
    setNotes([...notes, newNote].sort((a, b) => a.timing - b.timing));
  };

  const removeNote = (index: number) => {
    setNotes(notes.filter((_, i) => i !== index));
  };

  const updateNote = (index: number, field: keyof Note, value: number) => {
    const updatedNotes = [...notes];
    updatedNotes[index] = { ...updatedNotes[index], [field]: value };
    setNotes(updatedNotes.sort((a, b) => a.timing - b.timing));
  };

  const saveChart = async () => {
    if (!selectedSong || notes.length === 0) {
      setMessage('곡과 노트를 선택해주세요');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/rhythm-game/charts', {
        songId: selectedSong.id,
        difficulty,
        notes
      });

      if (response.data.success) {
        setMessage(`✅ ${difficulty} 악보가 저장되었습니다! (${notes.length}개 노트)`);
        setNotes([]);
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
      setNotes([]);
    }
  };

  const beatMs = (60 / bpm) * 1000; // 비트당 밀리초

  return (
    <div className="rhythm-game-note-editor">
      <h2>🎵 리듬게임 노트 에디터</h2>

      <div className="editor-layout">
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

        {/* 노트 에디터 */}
        {selectedSong && (
          <div className="note-editor">
            <div className="editor-controls">
              <div className="control-group">
                <label>난이도</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <label>BPM: {bpm}</label>
                <input
                  type="range"
                  min="60"
                  max="200"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                />
              </div>

              <div className="control-group">
                <label>곡 길이: {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</label>
              </div>

              <div className="note-count">
                노트: {notes.length}개
              </div>
            </div>

            {/* 타임라인 */}
            <div className="timeline-container">
              <div className="timeline-ruler">
                {/* 초 단위 마커 */}
                {Array.from({ length: Math.ceil(duration / 1000) + 1 }).map((_, i) => (
                  <div key={`second-${i}`} className="time-marker" style={{ left: `${(i * 1000 / duration) * 100}%` }}>
                    <div className="marker-label">{i}s</div>
                  </div>
                ))}

                {/* 비트 단위 마커 */}
                {Array.from({ length: Math.ceil((duration * 1000) / beatMs) }).map((_, i) => (
                  <div
                    key={`beat-${i}`}
                    className="beat-marker"
                    style={{ left: `${((i * beatMs) / (duration * 1000)) * 100}%` }}
                  />
                ))}
              </div>

              {/* 키 레인 */}
              <div className="keys-lanes">
                {KEYS.map((key) => (
                  <div
                    key={key.index}
                    className="key-lane"
                    style={{ backgroundColor: `${key.color}15` }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const percent = (e.clientX - rect.left) / rect.width;
                      const timing = percent * duration * 1000;
                      addNote(key.index, timing);
                    }}
                  >
                    <div className="lane-label" style={{ color: key.color }}>
                      {key.label}
                    </div>

                    {/* 노트 렌더링 */}
                    {notes
                      .filter((n) => n.key_index === key.index)
                      .map((note, idx) => {
                        const position = (note.timing / (duration * 1000)) * 100;
                        return (
                          <div
                            key={idx}
                            className="note-item"
                            style={{
                              left: `${position}%`,
                              backgroundColor: key.color,
                              cursor: 'pointer'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNote(notes.indexOf(note));
                            }}
                            title={`${(note.timing / 1000).toFixed(2)}s - 클릭하면 삭제`}
                          />
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>

            {/* 노트 세부 편집 */}
            {notes.length > 0 && (
              <div className="notes-detail">
                <h4>노트 목록 ({notes.length})</h4>
                <div className="notes-table">
                  <div className="table-header">
                    <div className="col-time">시간 (ms)</div>
                    <div className="col-key">키</div>
                    <div className="col-duration">길이</div>
                    <div className="col-action">삭제</div>
                  </div>
                  {notes.map((note, idx) => (
                    <div key={idx} className="table-row">
                      <div className="col-time">
                        <input
                          type="number"
                          min="0"
                          max={duration * 1000}
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
                            <option key={k.index} value={k.index}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-duration">
                        <input
                          type="number"
                          min="0"
                          value={note.duration}
                          onChange={(e) => updateNote(idx, 'duration', Number(e.target.value))}
                          placeholder="0 (단일 노트)"
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
            <div className="editor-actions">
              <button onClick={saveChart} disabled={loading || notes.length === 0} className="save-btn">
                {loading ? '저장 중...' : '악보 저장'}
              </button>
              <button onClick={clearNotes} disabled={notes.length === 0} className="clear-btn">
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

      {/* 사용 설명서 */}
      <div className="editor-guide">
        <h3>📖 사용 설명</h3>
        <ul>
          <li><strong>곡 선택:</strong> 좌측 목록에서 악보를 작성할 곡을 선택합니다</li>
          <li><strong>난이도:</strong> EASY / NORMAL / HARD / INSANE 중 하나를 선택합니다</li>
          <li><strong>BPM 조정:</strong> 슬라이더로 BPM을 조정할 수 있습니다 (곡의 박자 속도)</li>
          <li><strong>노트 추가:</strong> 타임라인의 원하는 위치를 클릭하여 노트를 추가합니다</li>
          <li><strong>노트 삭제:</strong> 추가된 노트를 클릭하면 삭제됩니다</li>
          <li><strong>세부 편집:</strong> 아래 테이블에서 각 노트의 정확한 시간(ms)과 길이를 편집할 수 있습니다</li>
          <li><strong>저장:</strong> 모든 노트를 추가한 후 "악보 저장" 버튼으로 저장합니다</li>
        </ul>
        <p className="guide-tip">💡 팁: 한 번에 하나의 난이도씩 저장합니다. 같은 곡의 다른 난이도는 별도로 작성해주세요</p>
      </div>
    </div>
  );
};

export default RhythmGameNoteEditor;
