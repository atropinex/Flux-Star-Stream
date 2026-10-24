import { useSettled } from '../../controllers/useSettled';
import type { Playlist } from '../../models/types';
import { BannerRow } from '../BannerRow/BannerRow';
import { IconButton } from '../IconButton/IconButton';
import { PlusIcon } from '../Icons';
import './PlaylistRow.css';

interface Props {
  playlists: Playlist[];
  selectedIndex: number;
  playingUri: string | null; // the playlist that is playing gets the moving bars
  onSelect: (index: number) => void;
  onPlay: () => void;
  onCreate: () => void;
}

/** The small row of playlist banners at the top. The one in the middle decides which songs are shown. */
export function PlaylistRow({ playlists, selectedIndex, playingUri, onSelect, onPlay, onCreate }: Props) {
  // The name under the row waits until you stop scrolling, so it does not flash on every step.
  const shown = useSettled(playlists[selectedIndex], 140);
  const trackCount = shown?.items?.total ?? shown?.tracks?.total ?? 0;

  return (
    <section className="playlists">
      <BannerRow
        size="small"
        selectedIndex={selectedIndex}
        items={playlists.map((playlist) => ({
          key: playlist.id,
          imageUrl: playlist.images?.[0]?.url,
          label: playlist.name,
          isPlaying: playlist.uri === playingUri
        }))}
        onSelect={onSelect}
        onActivate={onPlay}
      />
      <div className="playlist-caption">
        <span key={shown?.id} className="fade-in">
          {shown ? `${shown.name} · ${trackCount} tracks` : '\u00a0'}
        </span>
        <IconButton label="New playlist" onClick={onCreate}><PlusIcon size={16} /></IconButton>
      </div>
    </section>
  );
}
