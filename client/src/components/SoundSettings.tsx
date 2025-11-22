import { useState, useEffect } from 'react';
import { soundManager } from '../utils/soundManager';
import './SoundSettings.css';

export default function SoundSettings() {
  const [musicVolume, setMusicVolume] = useState(50);
  const [soundVolume, setSoundVolume] = useState(70);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    soundManager.setMusicVolume(musicVolume / 100);
    soundManager.setSoundVolume(soundVolume / 100);
    soundManager.setMusicEnabled(musicEnabled);
    soundManager.setSoundEnabled(soundEnabled);
  }, [musicVolume, soundVolume, musicEnabled, soundEnabled]);

  return (
    <div className="sound-settings">
      <h3>사운드 설정</h3>
      <div className="sound-control">
        <label>
          <input
            type="checkbox"
            checked={musicEnabled}
            onChange={(e) => setMusicEnabled(e.target.checked)}
          />
          브금 활성화
        </label>
        {musicEnabled && (
          <div className="volume-control">
            <label>브금 볼륨: {musicVolume}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume}
              onChange={(e) => setMusicVolume(parseInt(e.target.value))}
            />
          </div>
        )}
      </div>
      <div className="sound-control">
        <label>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => setSoundEnabled(e.target.checked)}
          />
          효과음 활성화
        </label>
        {soundEnabled && (
          <div className="volume-control">
            <label>효과음 볼륨: {soundVolume}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={soundVolume}
              onChange={(e) => setSoundVolume(parseInt(e.target.value))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

