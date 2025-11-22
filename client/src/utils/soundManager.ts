// 사운드 매니저 - OGG 파일 지원

class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private music: HTMLAudioElement | null = null;
  private musicVolume: number = 0.5;
  private soundVolume: number = 0.7;
  private musicEnabled: boolean = true;
  private soundEnabled: boolean = true;

  // 사운드 로드
  loadSound(name: string, path: string) {
    const audio = new Audio(path);
    audio.preload = 'auto';
    this.sounds.set(name, audio);
  }

  // 사운드 재생
  playSound(name: string, volume: number = 1) {
    if (!this.soundEnabled) return;

    const sound = this.sounds.get(name);
    if (sound) {
      const audio = sound.cloneNode() as HTMLAudioElement;
      audio.volume = this.soundVolume * volume;
      audio.play().catch(err => console.error('Sound play error:', err));
    }
  }

  // 브금 재생
  playMusic(path: string, loop: boolean = true) {
    if (!this.musicEnabled) return;

    if (this.music) {
      this.music.pause();
      this.music = null;
    }

    this.music = new Audio(path);
    this.music.volume = this.musicVolume;
    this.music.loop = loop;
    this.music.play().catch(err => console.error('Music play error:', err));
  }

  // 브금 정지
  stopMusic() {
    if (this.music) {
      this.music.pause();
      this.music = null;
    }
  }

  // 볼륨 설정
  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.music) {
      this.music.volume = this.musicVolume;
    }
  }

  setSoundVolume(volume: number) {
    this.soundVolume = Math.max(0, Math.min(1, volume));
  }

  // 음악/사운드 활성화/비활성화
  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled && this.music) {
      this.music.pause();
    }
  }

  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  // 사운드 정지
  stopSound(name: string) {
    const sound = this.sounds.get(name);
    if (sound) {
      sound.pause();
      sound.currentTime = 0;
    }
  }
}

export const soundManager = new SoundManager();

// 기본 사운드 경로 (사용자가 추가할 수 있도록)
// public/sounds/ 폴더에 OGG 파일을 넣으면 됩니다
if (typeof window !== 'undefined') {
  // 강화 사운드
  soundManager.loadSound('upgrade_success', '/sounds/upgrade_success.ogg');
  soundManager.loadSound('upgrade_fail', '/sounds/upgrade_fail.ogg');
  
  // 클릭 사운드
  soundManager.loadSound('click', '/sounds/click.ogg');
  
  // 경기 사운드
  soundManager.loadSound('kill', '/sounds/kill.ogg');
  soundManager.loadSound('tower', '/sounds/tower.ogg');
  soundManager.loadSound('dragon', '/sounds/dragon.ogg');
  soundManager.loadSound('baron', '/sounds/baron.ogg');
  
  // 메인 브금 (사용자가 추가)
  // soundManager.playMusic('/sounds/main_bgm.ogg');
}

