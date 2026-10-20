import type { Playlist } from '../models/types';
import { BannerRow } from './BannerRow';
import { IconButton } from './IconButton';
import { PlusIcon } from './Icons';

interface Props {
  playlists: Playlist[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onPlay: () => void;
  onCreate: () => void;
}

/** The small row of playlist banners at the top. The one in the middle decides which songs are shown. */
export function PlaylistRow({ playlists, selectedIndex, onSelect, onPlay, onCreate }: Props) {
  const selected = playlists[selectedIndex];
  const trackCount = selected?.items?.total ?? selected?.tracks?.total ?? 0;

  return (
    <section className="playlists">
      <BannerRow
        size="small"
        selectedIndex={selectedIndex}
        items={playlists.map((playlist) => ({
          key: playlist.id,
          imageUrl: playlist.images?.[0]?.url,
          label: playlist.name
        }))}
        onSelect={onSelect}
        onActivate={onPlay}
      />
      <div className="playlist-caption">
        <span>{selected ? `${selected.name} · ${trackCount} tracks` : '\u00a0'}</span>
        <IconButton label="New playlist" onClick={onCreate}><PlusIcon size={16} /></IconButton>
      </div>
    </section>
  );
}
