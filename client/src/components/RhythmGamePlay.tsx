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
  onGameEnd: () => void;
}

const RhythmGamePlay = ({ song, chart, bgmEnabled, onGameEnd }: RhythmGamePlayProps) => {
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
        setCurrentTime(currentSec * 1000); // 밀리초 단위

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
    let keyName = '';
    switch (e.key.toLowerCase()) {
      case 'd':
      case 'arrowleft':
        keyIndex = 0;
        keyName = 'D';
        break;
      case 'f':
        keyIndex = 1;
        keyName = 'F';
        break;
      case 'j':
        keyIndex = 2;
        keyName = 'J';
        break;
      case 'k':
      case 'arrowright':
        keyIndex = 3;
        keyName = 'K';
        break;
      case 'e':
        keyIndex = 4;  // E: DF 연결 (빨간색)
        keyName = 'E';
        break;
      case 'i':
        keyIndex = 5;  // I: JK 연결 (파란색)
        keyName = 'I';
        break;
      default:
        return;
    }

    // 해당 키의 노트 찾기
    const targetNotes = notes.filter(
      (note) => note.key_index === keyIndex && !judgedNotesRef.current.has(note.id)
    );

    if (keyIndex >= 4) {
      console.log(`Key pressed: ${keyName} (${keyIndex}), target notes:`, targetNotes.length);
    }

    if (targetNotes.length === 0) return;

    // 가장 가까운 노트 판정
    const closestNote = targetNotes.reduce((closest, note) => {
      const currentDiff = Math.abs(note.timing - currentTime);
      const closestDiff = Math.abs(closest.timing - currentTime);
      return currentDiff < closestDiff ? note : closest;
    });

    const timingDiff = closestNote.timing - currentTime;

    // 너무 먼 노트는 무시
    if (Math.abs(timingDiff) > 300) return;

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

  // 활성 노트 (현재 떨어지는 노트들)
  // currentTime이 음수가 될 수 없으므로, 최대 3초 앞의 노트들만 표시
  const activeNotes = notes.filter(
    (note) =>
      note.timing >= Math.max(0, currentTime - 500) && // 500ms 이전 (최소 0)
      note.timing <= currentTime + 3000 && // 3초 이후
      !judgedNotesRef.current.has(note.id)
  );

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
    <div ref={gameFieldRef} className="rhythm-game-play" onKeyDown={handleKeyPress} tabIndex={0}>
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
            const notePosition = ((note.timing - currentTime) / 1000) * 100; // 픽셀 단위
            return (
              <div
                key={note.id}
                className={`note note-key-${note.key_index}`}
                style={{
                  bottom: `${notePosition}px`,
                  animation: 'none'
                }}
              />
            );
          })}
        </div>

        {/* 판정선 */}
        <div className="judgment-line">
          <div className="judgment-line-bar" />
        </div>

        {/* 키 영역 */}
        <div className="keys-area">
          <div className="key key-0">D</div>
          <div className="key key-1">F</div>
          <div className="key key-4 slide-key-red">E</div>
          <div className="key key-2">J</div>
          <div className="key key-3">K</div>
          <div className="key key-5 slide-key-blue">I</div>
        </div>
      </div>

      {/* 판정 피드백 */}
      {recentJudgment && (
        <div className={`judgment-feedback ${recentJudgment.type.toLowerCase()}`}>
          {recentJudgment.type}
        </div>
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
