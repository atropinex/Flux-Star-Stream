import { useEffect } from 'react';

interface Handlers {
  onMove: (step: number) => void;         // songs
  onMovePlaylist: (step: number) => void; // playlists
  onPlay: () => void;
  onTogglePlay: () => void;
  onEscape: () => void;
}

/**
 * Mouse wheel and keyboard.
 * ← → songs, ↑ ↓ playlists, Enter plays, Space pauses, Esc closes. Ignored while typing.
 * The wheel moves playlists when the mouse is over the playlist row, songs everywhere else.
 */
export function useCarouselInput({ onMove, onMovePlaylist, onPlay, onTogglePlay, onEscape }: Handlers) {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.settings')) return; // the settings panel scrolls on its own

      const amount = event.deltaY || event.deltaX;
      if (Math.abs(amount) <= 4) return;
      (target.closest('.banner-row.small') ? onMovePlaylist : onMove)(Math.sign(amount));
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onEscape();
      if (event.target instanceof HTMLInputElement) return;
      const isButton = event.target instanceof HTMLButtonElement;

      if (event.key === 'ArrowRight') onMove(1);
      if (event.key === 'ArrowLeft') onMove(-1);
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
  }, [onMove, onMovePlaylist, onPlay, onTogglePlay, onEscape]);
}
