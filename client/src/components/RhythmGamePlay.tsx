import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/RhythmGame.css';

interface Song {
  id: number;
  title: string;
  artist: string;
  bpm: number;
  duration: number;
  music_url?: string;
}

interface Chart {
  id: number;
  note_count: number;
}

interface Note {
  id: number;
  key_index: number;
  timing: number;
  duration: number;
}

interface Judgment {
  type: 'PERFECT' | 'GOOD' | 'BAD' | 'MISS';
  timing: number;
}

interface RhythmGamePlayProps {
  song: Song;
  chart: Chart;
  bgmEnabled: boolean;
  noteSpeed: number;
  onGameEnd: () => void;
}

const RhythmGamePlay = ({ song, chart, bgmEnabled, noteSpeed, onGameEnd }: RhythmGamePlayProps) => {
  console.log('🎮 RhythmGamePlay received song:', song);
  console.log('🎵 song.music_url:', song?.music_url);
  console.log('📋 All song keys:', Object.keys(song || {}));
  const [notes, setNotes] = useState<Note[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [judgments, setJudgments] = useState({ perfect: 0, good: 0, bad: 0, miss: 0 });
  const [recentJudgment, setRecentJudgment] = useState<Judgment | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [actualDuration, setActualDuration] = useState(song.duration);
  const audioLoadStartTimeRef = useRef<number>(Date.now());

  const audioRef = useRef<HTMLAudioElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const gameFieldRef = useRef<HTMLDivElement>(null);
  const judgedNotesRef = useRef<Set<number>>(new Set());
  const notesRef = useRef<Note[]>([]);
  const heldLongNotesRef = useRef<Set<number>>(new Set()); // 현재 누르고 있는 롱노트

  // 현재 누르고 있는 키들 (시각적 피드백)
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  const [heldLongNotes, setHeldLongNotes] = useState<Set<number>>(new Set());

  // 점수 계산 공식
  const getScoreForJudgment = (type: string) => {
    switch (type) {
      case 'PERFECT': return 100;
      case 'GOOD': return 75;
      case 'BAD': return 50;
      case 'MISS': return 0;
      default: return 0;
    }
  };

  // 판정 계산 (현재 시간과 노트 타이밍 비교)
  const getJudgment = (timingDiff: number): string => {
    const absDiff = Math.abs(timingDiff);
    if (absDiff <= 50) return 'PERFECT';  // ±50ms
    if (absDiff <= 100) return 'GOOD';    // ±100ms
    if (absDiff <= 200) return 'BAD';     // ±200ms
    return 'MISS';
  };

  useEffect(() => {
    // 악보 노트 로드
    const fetchNotes = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const url = `${apiUrl}/api/rhythm-game/charts/${chart.id}/notes`;
        console.log('Fetching notes from:', url);
        const response = await axios.get(url);
        console.log('Notes response:', response.data);

        // API 응답 형식 처리
        let notesData = Array.isArray(response.data)
          ? response.data
          : response.data?.notes
          ? response.data.notes
          : [];

        console.log('Parsed notes:', notesData, 'count:', notesData.length);

        // 노트 타입별 집계
        const typeCount = {
          NORMAL: notesData.filter((n: any) => n.type === 'NORMAL').length,
          LONG: notesData.filter((n: any) => n.type === 'LONG').length,
          SLIDE: notesData.filter((n: any) => n.type === 'SLIDE').length,
          KEY_4_E: notesData.filter((n: any) => n.key_index === 4).length,
          KEY_5_I: notesData.filter((n: any) => n.key_index === 5).length,
        };
        console.log('Note type breakdown:', typeCount);

        setNotes(notesData);
        notesRef.current = notesData;
        setLoadingNotes(false);
      } catch (error) {
        console.error('노트 로드 실패:', error);
        setLoadingNotes(false);
        setNotes([]);
      }
    };

    fetchNotes();
  }, [chart.id]);

  useEffect(() => {
    if (!gameStarted || gameEnded) return;

    const gameLoop = () => {
      if (audioRef.current) {
        const currentSec = audioRef.current.currentTime;
        const currentMs = currentSec * 1000;
        setCurrentTime(currentMs); // 밀리초 단위

        // 자동 미스 처리: 판정선을 지난 노트들 (timingDiff <= -300ms 이상)
        notesRef.current.forEach(note => {
          if (!judgedNotesRef.current.has(note.id)) {
            const timingDiff = note.timing - currentMs;
            // 판정 범위를 완전히 벗어난 경우 (300ms 이상 경과)
            if (timingDiff <= -300) {
              judgedNotesRef.current.add(note.id);
              setCombo(0);
              setJudgments((prev) => ({ ...prev, miss: prev.miss + 1 }));
              setRecentJudgment({ type: 'MISS', timing: currentMs });
              setTimeout(() => setRecentJudgment(null), 200);
            }
          }
        });

        // 곡이 끝났으면 게임 종료
        if (currentSec >= actualDuration) {
          console.log('곡 종료:', currentSec, '>=', actualDuration);
          handleGameEnd();
          return;
        }
      }
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameEnded, actualDuration]);

  // 게임 시작 후 음악 재생
  useEffect(() => {
    if (!gameStarted || gameEnded || !bgmEnabled) return;

    // 약간의 지연 후 재생 (DOM 업데이트 후)
    const timer = setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(err => console.error('음악 재생 실패:', err));
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [gameStarted, bgmEnabled]);

  // 게임 시작
  const handleGameStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 음악이 준비되지 않았으면 시작하지 않음
    if (!audioReady || loadingNotes || audioError) {
      console.warn('게임 시작 불가: audioReady=', audioReady, 'loadingNotes=', loadingNotes, 'audioError=', audioError);
      return;
    }

    console.log('게임 시작: audioReady=', audioReady, 'loadingNotes=', loadingNotes);
    setGameStarted(true);

    // 게임 필드에 focus를 주어 키 입력 활성화 (useEffect에서 음악 재생)
    setTimeout(() => {
      if (gameFieldRef.current) {
        gameFieldRef.current.focus();
      }
    }, 50);
  };

  // 키 입력 처리
  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!gameStarted || gameEnded) return;

    let keyIndex = -1;
    switch (e.key.toLowerCase()) {
      case 'd':
      case 'arrowleft':
        keyIndex = 0;
        break;
      case 'f':
        keyIndex = 1;
        break;
      case 'j':
        keyIndex = 2;
        break;
      case 'k':
      case 'arrowright':
        keyIndex = 3;
        break;
      case 'e':
        keyIndex = 4;
        break;
      case 'i':
        keyIndex = 5;
        break;
      default:
        return;
    }

    // 키 누름 표시
    setPressedKeys(prev => new Set(prev).add(keyIndex));

    // 해당 키의 노트 찾기
    const targetNotes = notesRef.current.filter(
      (note) => note.key_index === keyIndex && !judgedNotesRef.current.has(note.id)
    );

    if (targetNotes.length === 0) return;

    // 일반 노트와 롱노트 분리
    const normalNotes = targetNotes.filter(n => n.duration === 0 || n.duration === undefined);
    const longNotes = targetNotes.filter(n => n.duration > 0);

    // 일반 노트 판정
    if (normalNotes.length > 0) {
      const closestNote = normalNotes.reduce((closest, note) => {
        const currentDiff = Math.abs(note.timing - currentTime);
        const closestDiff = Math.abs(closest.timing - currentTime);
        return currentDiff < closestDiff ? note : closest;
      });

      const timingDiff = closestNote.timing - currentTime;

      // 너무 먼 노트는 무시
      if (Math.abs(timingDiff) <= 300) {
        const judgmentType = getJudgment(timingDiff);
        judgedNotesRef.current.add(closestNote.id);

        // 점수 및 판정 업데이트
        const points = getScoreForJudgment(judgmentType);
        setScore((prev) => prev + points);

        if (judgmentType === 'MISS') {
          setCombo(0);
          setJudgments((prev) => ({ ...prev, miss: prev.miss + 1 }));
        } else {
          setCombo((prev) => prev + 1);
          setJudgments((prev) => ({
            ...prev,
            [judgmentType.toLowerCase()]: prev[judgmentType.toLowerCase() as keyof typeof prev] + 1
          }));
          setMaxCombo((prev) => Math.max(prev, combo + 1));
        }

        setRecentJudgment({ type: judgmentType as any, timing: currentTime });
        setTimeout(() => setRecentJudgment(null), 200);

        // 정확도 계산
        const totalJudgments = Object.values(judgments).reduce((a, b) => a + b, 0) + 1;
        const totalScore = score + points;
        const newAccuracy = (totalScore / (totalJudgments * 100)) * 100;
        setAccuracy(Math.min(100, newAccuracy));
      }
    }

    // 롱노트 처리
    if (longNotes.length > 0) {
      const closestLongNote = longNotes.reduce((closest, note) => {
        const currentDiff = Math.abs(note.timing - currentTime);
        const closestDiff = Math.abs(closest.timing - currentTime);
        return currentDiff < closestDiff ? note : closest;
      });

      const timingDiff = closestLongNote.timing - currentTime;

      // 롱노트 시작 근처에 있으면 잡음
      if (Math.abs(timingDiff) <= 300) {
        heldLongNotesRef.current.add(closestLongNote.id);
        setHeldLongNotes(prev => new Set(prev).add(closestLongNote.id));
        judgedNotesRef.current.add(closestLongNote.id);
      }
    }
  };

  // 키 해제 처리
  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let keyIndex = -1;
    switch (e.key.toLowerCase()) {
      case 'd':
      case 'arrowleft':
        keyIndex = 0;
        break;
      case 'f':
        keyIndex = 1;
        break;
      case 'j':
        keyIndex = 2;
        break;
      case 'k':
      case 'arrowright':
        keyIndex = 3;
        break;
      case 'e':
        keyIndex = 4;
        break;
      case 'i':
        keyIndex = 5;
        break;
      default:
        return;
    }

    // 키 해제 표시
    setPressedKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(keyIndex);
      return newSet;
    });

    // 롱노트 종료 처리
    const releasedLongNotes = Array.from(heldLongNotesRef.current).filter(noteId => {
      const note = notesRef.current.find(n => n.id === noteId);
      return note && note.key_index === keyIndex;
    });

    releasedLongNotes.forEach(noteId => {
      const note = notesRef.current.find(n => n.id === noteId);
      if (note) {
        const holdEndTime = note.timing + note.duration; // 롱노트 종료 시간
        const timingDiff = holdEndTime - currentTime;

        const judgmentType = getJudgment(timingDiff);
        const points = getScoreForJudgment(judgmentType);
        setScore((prev) => prev + points);

        if (judgmentType === 'MISS') {
          setCombo(0);
          setJudgments((prev) => ({ ...prev, miss: prev.miss + 1 }));
        } else {
          setCombo((prev) => prev + 1);
          setJudgments((prev) => ({
            ...prev,
            [judgmentType.toLowerCase()]: prev[judgmentType.toLowerCase() as keyof typeof prev] + 1
          }));
          setMaxCombo((prev) => Math.max(prev, combo + 1));
        }

        setRecentJudgment({ type: judgmentType as any, timing: currentTime });
        setTimeout(() => setRecentJudgment(null), 200);

        // 정확도 계산
        const totalJudgments = Object.values(judgments).reduce((a, b) => a + b, 0) + 1;
        const totalScore = score + points;
        const newAccuracy = (totalScore / (totalJudgments * 100)) * 100;
        setAccuracy(Math.min(100, newAccuracy));
      }

      heldLongNotesRef.current.delete(noteId);
    });

    setHeldLongNotes(prev => {
      const newSet = new Set(prev);
      releasedLongNotes.forEach(id => newSet.delete(id));
      return newSet;
    });
  };

  // 게임 종료
  const handleGameEnd = async () => {
    setGameEnded(true);
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // 결과 제출
    try {
      const teamId = parseInt(localStorage.getItem('teamId') || '0');
      const playerCardId = parseInt(localStorage.getItem('selectedPlayerCardId') || '0');

      if (teamId) {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const url = `${apiUrl}/api/rhythm-game/submit`;
        await axios.post(url, {
          teamId,
          playerCardId: playerCardId || null,
          chartId: chart.id,
          judgments,
          maxCombo,
          score,
          accuracy
        });
      }
    } catch (error) {
      console.error('결과 제출 실패:', error);
    }
  };

  // 단순한 노트 위치 계산
  // 노트의 낙하 속도 (픽셀/초)
  const BASE_FALL_SPEED = 400; // 400px/초 (1.0x 속도일 때)
  const pixelsPerSecond = BASE_FALL_SPEED * noteSpeed;

  // 판정선 위치 (게임 필드 하단에서 120px 위)
  const JUDGMENT_LINE_Y = 120;

  // 모든 노트를 항상 표시 (간단하게)
  const activeNotes = notes.filter(note => !judgedNotesRef.current.has(note.id));

  if (loadingNotes) {
    return <div className="rhythm-game-play">노트 로딩 중...</div>;
  }

  if (!gameStarted) {
    return (
      <div className="rhythm-game-play">
        <div className="game-start-screen">
          <h2>{song.title}</h2>
          <p className="artist">{song.artist}</p>
          <p className="info">♪ {song.bpm} BPM • {chart.note_count} Notes</p>

          {/* 타이밍 설명 */}
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'rgba(52, 152, 219, 0.2)', borderRadius: '8px', marginBottom: '20px' }}>
            <p style={{ fontSize: '14px', marginBottom: '10px' }}>⏱️ <strong>타이밍 판정</strong></p>
            <p style={{ fontSize: '12px', color: '#f39c12', marginBottom: '5px' }}>🟡 PERFECT: ±50ms (정확한 타이밍)</p>
            <p style={{ fontSize: '12px', color: '#3498db', marginBottom: '5px' }}>🔵 GOOD: ±100ms (거의 정확)</p>
            <p style={{ fontSize: '12px', color: '#e67e22', marginBottom: '5px' }}>🟠 BAD: ±200ms (늦음)</p>
            <p style={{ fontSize: '12px', color: '#e74c3c' }}>❌ MISS: 300ms 초과 (대실)</p>
          </div>

          {audioError && (
            <div style={{ color: '#e74c3c', marginBottom: '20px', padding: '10px', backgroundColor: 'rgba(231, 76, 60, 0.2)', borderRadius: '4px' }}>
              ⚠️ {audioError}
            </div>
          )}

          {!audioReady && !audioError && (
            <p style={{ color: '#f39c12', marginBottom: '20px' }}>🔄 음악 로드 중...</p>
          )}

          <div className="keys-info">
            <p>⌨️ 키 설정</p>
            <div className="keys-grid">
              <div className="key-row">
                <span className="key-btn">D / ←</span>
                <span className="key-btn">F</span>
                <span className="key-btn">J</span>
                <span className="key-btn">K / →</span>
              </div>
            </div>
          </div>

          {loadingNotes ? (
            <button className="start-btn" disabled={true} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
              노트 로드 중...
            </button>
          ) : !audioReady ? (
            <button className="start-btn" disabled={true} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
              음악 로드 대기 중...
            </button>
          ) : audioError ? (
            <button className="start-btn" disabled={true} style={{ opacity: 0.5, cursor: 'not-allowed', color: '#e74c3c' }}>
              음악 로드 실패
            </button>
          ) : (
            <button className="start-btn" onClick={handleGameStart} style={{ opacity: 1, cursor: 'pointer' }}>
              게임 시작
            </button>
          )}
        </div>

        {/* 오디오 - 항상 렌더링되어야 함 */}
        <audio
          ref={audioRef}
          src={song.music_url && song.music_url.startsWith('http')
            ? song.music_url
            : song.music_url && song.music_url.startsWith('/')
              ? window.location.origin + song.music_url
              : song.music_url}
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => {
            const audio = e.target as HTMLAudioElement;
            const duration = Math.round(audio.duration);
            const loadTime = Date.now() - audioLoadStartTimeRef.current;
            console.log('🎵 Audio metadata loaded:', {
              duration: `${duration}초`,
              loadTime: `${loadTime}ms (${(loadTime/1000).toFixed(2)}초)`,
              url: song.music_url
            });
            setActualDuration(duration);
          }}
          onCanPlay={() => {
            const loadTime = Date.now() - audioLoadStartTimeRef.current;
            console.log('✅ Audio ready to play:', `${loadTime}ms (${(loadTime/1000).toFixed(2)}초)`);
            setAudioReady(true);
          }}
          onError={(e) => {
            const error = (e.target as HTMLAudioElement).error;
            const errorMsg = `음악 로드 실패: ${error?.message || 'Unknown error'}`;
            console.error('❌', errorMsg, 'URL:', song.music_url);
            setAudioError(errorMsg);
          }}
          onLoadStart={() => {
            audioLoadStartTimeRef.current = Date.now();
            console.log('⏳ Audio loading started...', 'src:', (audioRef.current as any)?.src);
          }}
          onLoad={() => {
            console.log('📦 Audio load event');
          }}
        />
      </div>
    );
  }

  if (gameEnded) {
    return (
      <div className="rhythm-game-play">
        <div className="game-result-screen">
          <h2>게임 종료</h2>

          <div className="result-score">
            <div className="score-item">
              <span className="label">점수</span>
              <span className="value">{score}</span>
            </div>
            <div className="score-item">
              <span className="label">정확도</span>
              <span className="value">{accuracy.toFixed(1)}%</span>
            </div>
            <div className="score-item">
              <span className="label">최대 콤보</span>
              <span className="value">{maxCombo}</span>
            </div>
          </div>

          <div className="result-judgments">
            <div className="judgment-item perfect">
              <span>Perfect</span>
              <span className="count">{judgments.perfect}</span>
            </div>
            <div className="judgment-item good">
              <span>Good</span>
              <span className="count">{judgments.good}</span>
            </div>
            <div className="judgment-item bad">
              <span>Bad</span>
              <span className="count">{judgments.bad}</span>
            </div>
            <div className="judgment-item miss">
              <span>Miss</span>
              <span className="count">{judgments.miss}</span>
            </div>
          </div>

          <button className="result-btn" onClick={onGameEnd}>
            곡 선택으로 돌아가기
          </button>
        </div>

        {/* 오디오 - 항상 렌더링 */}
        <audio ref={audioRef} />
      </div>
    );
  }

  return (
    <div ref={gameFieldRef} className="rhythm-game-play" onKeyDown={handleKeyPress} onKeyUp={handleKeyUp} tabIndex={0}>
      {/* HUD */}
      <div className="game-hud">
        <div className="hud-item">
          <span className="label">점수</span>
          <span className="value">{score}</span>
        </div>
        <div className="hud-item">
          <span className="label">콤보</span>
          <span className="value">{combo}</span>
        </div>
        <div className="hud-item">
          <span className="label">정확도</span>
          <span className="value">{accuracy.toFixed(1)}%</span>
        </div>
        <div className="hud-item">
          <span className="label">시간</span>
          <span className="value">
            {Math.floor(currentTime / 1000 / 60)}:{Math.floor((currentTime / 1000) % 60)
              .toString()
              .padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* 게임 필드 */}
      <div className="game-field">
        {/* 노트 떨어지는 영역 */}
        <div className="notes-container">
          {activeNotes.map((note) => {
            // 노트가 판정선에 도달할 때까지 남은 시간 (밀리초)
            const msUntilJudgment = note.timing - currentTime;
            // 판정선에서의 노트 위치
            const noteBottom = JUDGMENT_LINE_Y + (msUntilJudgment / 1000) * pixelsPerSecond;

            // 롱노트 여부 (duration > 0이면 롱노트)
            const isLongNote = note.duration > 0;

            if (isLongNote) {
              // 롱노트: 길이가 duration에 비례
              const longNoteHeight = (note.duration / 1000) * pixelsPerSecond;
              // 롱노트의 끝 위치 (시작점 - 높이)
              const longNoteBottom = noteBottom - longNoteHeight;
              // 롱노트 눌림 상태
              const isHeld = heldLongNotes.has(note.id);

              return (
                <div
                  key={note.id}
                  className={`note long-note note-key-${note.key_index} ${isHeld ? 'held' : ''}`}
                  style={{
                    bottom: `${longNoteBottom}px`,
                    height: `${longNoteHeight}px`,
                    opacity: isHeld ? 1 : 0.8,
                    boxShadow: isHeld ? `inset 0 0 20px rgba(255, 255, 255, 0.5), 0 0 20px currentColor` : undefined
                  }}
                />
              );
            } else {
              // 일반 노트
              return (
                <div
                  key={note.id}
                  className={`note note-key-${note.key_index}`}
                  style={{
                    bottom: `${noteBottom}px`
                  }}
                />
              );
            }
          })}
        </div>

        {/* 판정선 */}
        <div className="judgment-line">
          <div className="judgment-line-bar" />
        </div>

        {/* 키 영역 */}
        <div className="keys-area">
          <div className={`key key-0 ${pressedKeys.has(0) ? 'pressed' : ''}`} style={{backgroundColor: pressedKeys.has(0) ? 'rgba(52, 152, 219, 0.8)' : ''}}>D</div>
          <div className={`key key-1 ${pressedKeys.has(1) ? 'pressed' : ''}`} style={{backgroundColor: pressedKeys.has(1) ? 'rgba(155, 89, 182, 0.8)' : ''}}>F</div>
          <div className={`key key-2 ${pressedKeys.has(2) ? 'pressed' : ''}`} style={{backgroundColor: pressedKeys.has(2) ? 'rgba(230, 126, 34, 0.8)' : ''}}>J</div>
          <div className={`key key-3 ${pressedKeys.has(3) ? 'pressed' : ''}`} style={{backgroundColor: pressedKeys.has(3) ? 'rgba(243, 156, 18, 0.8)' : ''}}>K</div>
        </div>
      </div>

      {/* 판정 피드백 */}
      {recentJudgment && (
        <>
          <div className={`judgment-feedback ${recentJudgment.type.toLowerCase()}`}>
            {recentJudgment.type}
          </div>
          {combo > 0 && (
            <div className="combo-feedback">
              Combo: {combo}
            </div>
          )}
        </>
      )}

      {/* 조기 종료 버튼 */}
      <button className="exit-btn" onClick={handleGameEnd}>
        ⏹ 종료
      </button>

      {/* 오디오 */}
      <audio
        ref={audioRef}
        src={song.music_url && song.music_url.startsWith('http')
          ? song.music_url
          : song.music_url && song.music_url.startsWith('/')
            ? window.location.origin + song.music_url
            : song.music_url}
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => {
          const audio = e.target as HTMLAudioElement;
          const duration = Math.round(audio.duration);
          const loadTime = Date.now() - audioLoadStartTimeRef.current;
          console.log('🎵 Audio metadata loaded:', {
            duration: `${duration}초`,
            loadTime: `${loadTime}ms (${(loadTime/1000).toFixed(2)}초)`,
            url: song.music_url
          });
          setActualDuration(duration);
        }}
        onCanPlay={() => {
          const loadTime = Date.now() - audioLoadStartTimeRef.current;
          console.log('✅ Audio ready to play:', `${loadTime}ms (${(loadTime/1000).toFixed(2)}초)`);
          setAudioReady(true);
        }}
        onError={(e) => {
          const error = (e.target as HTMLAudioElement).error;
          const errorMsg = `음악 로드 실패: ${error?.message || 'Unknown error'}`;
          console.error('❌', errorMsg, 'URL:', song.music_url);
          setAudioError(errorMsg);
        }}
        onLoadStart={() => {
          audioLoadStartTimeRef.current = Date.now();
          console.log('⏳ Audio loading started...', 'src:', (audioRef.current as any)?.src);
        }}
        onLoad={() => {
          console.log('📦 Audio load event');
        }}
      />
    </div>
  );
};

export default RhythmGamePlay;
