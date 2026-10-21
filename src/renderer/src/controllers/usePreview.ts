import { useCallback, useEffect, useRef, useState } from 'react';
import type { Device, PlaybackState, Track } from '../models/types';
import { fetchDevices, pausePlayback, setDeviceVolume, startPlayback } from '../models/playbackService';
import { ApiError } from '../models/spotifyApi';

const START_FRACTION = 0.3;         // the preview starts 30% into the song
const DEBOUNCE_MS = 700;            // wait until you stop scrolling
const REAL_PLAYBACK_GRACE_MS = 2500; // Spotify's state lags behind, so ignore it briefly after a preview starts

interface Options {
  enabled: boolean;
  volume: number;  // 0 to 100
  seconds: number; // how long a preview plays
  track: Track | undefined; // the song in the middle of the preview row
  playback: PlaybackState | null;
  isVisible: boolean;
}

interface Session {
  deviceId: string;
  originalVolume: number; // restored when the preview ends
  trackId: string;
  startedAt: number;
  isSounding: boolean;
}

const pickDevice = (devices: Device[]) =>
  devices.find((d) => d.is_active && d.id) ?? devices.find((d) => d.type === 'Computer' && d.id) ?? devices.find((d) => d.id);

/**
 * When nothing is playing, plays a short, quiet part of the song in the middle of the preview row.
 * It lowers the Spotify device's volume while it plays and puts it back afterwards.
 */
export function usePreview({ enabled, volume, seconds, track, playback, isVisible }: Options) {
  const [isActive, setIsActive] = useState(false); // true from the first preview until real playback starts
  const session = useRef<Session | null>(null);
  const endTimer = useRef(0);
  const attempt = useRef(0);        // lets a newer preview cancel an older one that is still starting
  const isBlocked = useRef(false);  // set when Spotify refuses (free accounts), so we stop trying

  // The newest values, for use inside timers.
  const latest = useRef({ volume, seconds, playback, isVisible });
  latest.current = { volume, seconds, playback, isVisible };

  /** Stops the sound and puts the volume back. */
  const endSnippet = useCallback(async () => {
    window.clearTimeout(endTimer.current);
    const current = session.current;
    if (!current || !current.isSounding) return;

    current.isSounding = false;
    await pausePlayback(current.deviceId).catch(() => {});
    await setDeviceVolume(current.originalVolume, current.deviceId).catch(() => {});
  }, []);

  /** Ends the preview completely. Call it before real playback so the volume is normal again. */
  const stop = useCallback(async () => {
    attempt.current++;
    await endSnippet();
    session.current = null;
    setIsActive(false);
  }, [endSnippet]);

  const start = useCallback(async (target: Track) => {
    const run = ++attempt.current;
    const previous = session.current;
    let device: Device | undefined;
    let originalVolume = 50;

    try {
      const devices = await fetchDevices();
      if (run !== attempt.current) return;

      // Switching from one preview to the next: the volume is still low, so keep the saved one.
      device = previous?.isSounding ? devices.find((d) => d.id === previous.deviceId) : pickDevice(devices);
      if (!device?.id) return;
      originalVolume = previous?.isSounding ? previous.originalVolume : device.volume_percent ?? 50;

      await setDeviceVolume(latest.current.volume, device.id);
      if (run === attempt.current) {
        await startPlayback(
          { uris: [target.uri], position_ms: Math.floor((target.duration_ms ?? 0) * START_FRACTION) },
          device.id
        );
      }

      if (run !== attempt.current) {
        // Cancelled while starting: undo what we did.
        await pausePlayback(device.id).catch(() => {});
        await setDeviceVolume(originalVolume, device.id).catch(() => {});
        return;
      }

      session.current = { deviceId: device.id, originalVolume, trackId: target.id, startedAt: Date.now(), isSounding: true };
      setIsActive(true);
      window.clearTimeout(endTimer.current);
      endTimer.current = window.setTimeout(() => void endSnippet(), latest.current.seconds * 1000);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) isBlocked.current = true; // previews need Premium
      if (device?.id) await setDeviceVolume(originalVolume, device.id).catch(() => {});
    }
  }, [endSnippet]);

  // A different song in the middle of the row: preview it, if nothing real is playing.
  useEffect(() => {
    if (!enabled || !track || isBlocked.current) return;

    const timer = setTimeout(() => {
      const { isVisible: visible, playback: current } = latest.current;
      const isIdle = current === null || session.current !== null;
      if (visible && isIdle) void start(track);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [track?.id, enabled, start]);

  // Turning previews off, or closing the overlay, ends them.
  useEffect(() => {
    if (!enabled || !isVisible) void stop();
  }, [enabled, isVisible, stop]);

  // If a real song starts playing (for example from the Spotify app), leave the preview alone.
  useEffect(() => {
    const current = session.current;
    if (!current || !playback || !playback.isPlaying) return;
    if (Date.now() - current.startedAt < REAL_PLAYBACK_GRACE_MS) return;

    const isOurPreview = current.isSounding && playback.track.id === current.trackId;
    if (!isOurPreview) {
      if (current.isSounding) void setDeviceVolume(current.originalVolume, current.deviceId).catch(() => {});
      window.clearTimeout(endTimer.current);
      session.current = null;
      setIsActive(false);
    }
  }, [playback]);

  return { isActive, stop };
}
