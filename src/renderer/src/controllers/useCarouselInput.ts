import { useEffect } from 'react';

interface Handlers {
  onMove: (step: number) => void;         // preview songs
  onMovePlaylist: (step: number) => void; // playlists
  onMovePlaying: (step: number) => void;  // songs of the playing playlist
  onPlay: () => void;
  onTogglePlay: () => void;
  onEscape: () => void;
}

/**
 * Mouse wheel and keyboard. Ignored while typing.
 * Wheel: scrolls the row under the mouse. Anywhere else it scrolls the preview row.
 * Keys:  ← → preview songs, Shift + ← → playing songs, ↑ ↓ playlists, Enter plays, Space pauses, Esc closes.
 */
export function useCarouselInput({ onMove, onMovePlaylist, onMovePlaying, onPlay, onTogglePlay, onEscape }: Handlers) {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.settings')) return; // the settings panel scrolls on its own

      const amount = event.deltaY || event.deltaX;
      if (Math.abs(amount) <= 4) return;

      const move = target.closest('.banner-row.small')
        ? onMovePlaylist
        : target.closest('.playing-row')
          ? onMovePlaying
          : onMove;
      move(Math.sign(amount));
    };

    const handleKey = (event: KeyboardEvent) => {
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
  }, [onMove, onMovePlaylist, onMovePlaying, onPlay, onTogglePlay, onEscape]);
}
