import { useEffect, useRef } from 'react';

interface Handlers {
  onMove: (step: number) => void;         // preview songs
  onMovePlaylist: (step: number) => void; // playlists
  onMovePlaying: (step: number) => void;  // songs of the playing playlist
  onPlay: () => void;
  onTogglePlay: () => void;
  onEscape: () => void;
}

const STEP_PX = 50;        // how far the wheel must turn for one step. A mouse notch is about 100.
const MIN_STEP_MS = 60;    // never faster than this, so trackpad inertia cannot fling through the list
const IDLE_RESET_MS = 250; // a pause this long forgets a half-finished turn

/**
 * Mouse wheel and keyboard. Ignored while typing.
 * Wheel: scrolls the row under the mouse. Anywhere else it scrolls the preview row.
 * Keys:  ← → preview songs, Shift + ← → playing songs, ↑ ↓ playlists, Enter plays, Space pauses, Esc closes.
 *
 * A trackpad sends dozens of tiny wheel events per swipe. They are added up into whole steps, and steps are
 * limited in speed, so the cards move one deliberate step at a time instead of jittering.
 */
export function useCarouselInput(handlers: Handlers) {
  // Always the newest handlers, without re-attaching the listeners (which would also lose the running total).
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    let total = 0;
    let lastEventAt = 0;
    let lastStepAt = 0;
    let lastRow = '';

    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.settings')) return; // the settings panel scrolls on its own

      const raw = event.deltaY || event.deltaX;
      if (!raw) return;
      // Some mice report lines or pages instead of pixels.
      const pixels = event.deltaMode === 1 ? raw * 33 : event.deltaMode === 2 ? raw * 400 : raw;

      const row = target.closest('.banner-row.small') ? 'playlist' : target.closest('.playing-row') ? 'playing' : 'preview';
      const now = performance.now();
      if (row !== lastRow || now - lastEventAt > IDLE_RESET_MS) total = 0;
      lastRow = row;
      lastEventAt = now;

      total += pixels;
      if (Math.abs(total) < STEP_PX) return;

      const direction = Math.sign(total);
      total = 0;
      if (now - lastStepAt < MIN_STEP_MS) return;
      lastStepAt = now;

      const { onMovePlaylist, onMovePlaying, onMove } = latest.current;
      (row === 'playlist' ? onMovePlaylist : row === 'playing' ? onMovePlaying : onMove)(direction);
    };

    const handleKey = (event: KeyboardEvent) => {
      const { onEscape, onMove, onMovePlaying, onMovePlaylist, onPlay, onTogglePlay } = latest.current;
      if (event.key === 'Escape') return onEscape();
      if (event.target instanceof HTMLInputElement) return;
      const isButton = event.target instanceof HTMLButtonElement;

      if (event.key === 'ArrowRight') (event.shiftKey ? onMovePlaying : onMove)(1);
      if (event.key === 'ArrowLeft') (event.shiftKey ? onMovePlaying : onMove)(-1);
      if (event.key === 'ArrowDown') onMovePlaylist(1);
      if (event.key === 'ArrowUp') onMovePlaylist(-1);
      if (event.key === 'Enter' && !isButton) onPlay();
      if (event.key === ' ' && !isButton) {
        event.preventDefault();
        onTogglePlay();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);
}
