import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent } from 'react';
import type { PlaybackState } from '../models/types';
import { formatTime } from '../utils/formatTime';
import { IconButton } from './IconButton';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon, ShuffleIcon, VolumeIcon } from './Icons';

const VOLUME_DELAY_MS = 150;

interface Props {
  playback: PlaybackState | null;
  positionMs: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShuffle: () => void;
  onSeek: (fraction: number) => void;
  onVolume: (percent: number) => void;
}

/** The "now playing" bar: song on the left, controls and progress in the middle, volume on the right. */
export function PlayerBar({ playback, positionMs, onTogglePlay, onNext, onPrevious, onShuffle, onSeek, onVolume }: Props) {
  const [volume, setVolume] = useState(60);
  const volumeBeforeMute = useRef(50);
  const isDraggingVolume = useRef(false);
  const volumeTimer = useRef(0);

  // Follow the real volume, unless the user is moving the slider.
  useEffect(() => {
    if (playback && !isDraggingVolume.current) setVolume(playback.volume);
  }, [playback]);

  function handleVolumeChange(event: ChangeEvent<HTMLInputElement>) {
    const percent = Number(event.target.value);
    setVolume(percent);
    isDraggingVolume.current = true;

    // Wait a moment after the slider stops so we don't spam Spotify.
    window.clearTimeout(volumeTimer.current);
    volumeTimer.current = window.setTimeout(() => {
      onVolume(percent);
      isDraggingVolume.current = false;
    }, VOLUME_DELAY_MS);
  }

  /** Clicking the speaker mutes, clicking again goes back to the previous volume. */
  function toggleMute() {
    if (volume > 0) volumeBeforeMute.current = volume;
    const next = volume > 0 ? 0 : volumeBeforeMute.current || 50;
    setVolume(next);
    onVolume(next);
  }

  function handleSeekClick(event: MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    onSeek((event.clientX - box.left) / box.width);
  }

  const track = playback?.track;
  const coverUrl = track?.album.images[0]?.url;
  const durationMs = playback?.durationMs ?? 0;
  const progress = durationMs ? (positionMs / durationMs) * 100 : 0;
  const volumeLevel = volume === 0 ? 'mute' : volume < 50 ? 'low' : 'high';

  return (
    <footer className="player">
      <div className="now-playing">
        <div className="cover" style={{ backgroundImage: coverUrl ? `url(${coverUrl})` : undefined }} />
        <div className="meta">
          <div className="track-title">{track?.name ?? 'Nothing playing'}</div>
          <div className="track-artist">
            {track ? track.artists.map((artist) => artist.name).join(', ') : 'Press Enter on a song'}
          </div>
        </div>
      </div>

      <div className="transport">
        <div className="controls">
          <IconButton label="Shuffle" isActive={playback?.isShuffled} onClick={onShuffle}><ShuffleIcon size={18} /></IconButton>
          <IconButton label="Previous" onClick={onPrevious}><PreviousIcon size={22} /></IconButton>
          <button className="play-pause" onClick={onTogglePlay} title="Play / Pause" aria-label="Play / Pause">
            {playback?.isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>
          <IconButton label="Next" onClick={onNext}><NextIcon size={22} /></IconButton>
        </div>

        <div className="seek-row">
          <span>{formatTime(positionMs)}</span>
          <div className="seek" onClick={handleSeekClick}>
            <div className="seek-track">
              <div className="seek-progress" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <span>{formatTime(durationMs)}</span>
        </div>
      </div>

      <div className="volume-block">
        <div className="volume">
          <IconButton label={volume === 0 ? 'Unmute' : 'Mute'} onClick={toggleMute}><VolumeIcon level={volumeLevel} size={18} /></IconButton>
          <input
            className="volume-slider"
            type="range"
            min={0}
            max={100}
            value={volume}
            style={{ '--value': `${volume}%` } as CSSProperties}
            onChange={handleVolumeChange}
            aria-label="Volume"
          />
        </div>
        <span className="device-name">{playback?.deviceName}</span>
      </div>
    </footer>
  );
}
