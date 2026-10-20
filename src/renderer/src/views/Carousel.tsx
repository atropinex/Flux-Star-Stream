import type { Track } from '../models/types';
import { BannerRow } from './BannerRow';
import { PlusIcon } from './Icons';

interface Props {
  tracks: Track[];
  selectedIndex: number;
  heading: string;      // playlist name or "Results for ..."
  isLoading: boolean;
  hasFailed: boolean;
  isSearching: boolean;
  onSelect: (index: number) => void;
  onPlay: (index: number) => void;
  onPlayPlaylist: () => void;
  onAddToPlaylist: () => void;
}

/** The large row of song banners, with the selected song's name underneath. */
export function Carousel({ tracks, selectedIndex, heading, isLoading, hasFailed, isSearching, onSelect, onPlay, onPlayPlaylist, onAddToPlaylist }: Props) {
  const selected = tracks[selectedIndex];

  let title = selected?.name ?? heading;
  let subtitle = selected ? `${selected.artists.map((a) => a.name).join(', ')} · ${heading}` : '\u00a0';
  if (!selected && isLoading) subtitle = 'Loading…';
  if (!selected && !isLoading && isSearching) subtitle = 'No songs found';
  if (!selected && !isLoading && hasFailed && !isSearching) subtitle = 'Spotify only shares songs of playlists you own or collaborate on.';

  return (
    <>
      <BannerRow
        size="large"
        selectedIndex={selectedIndex}
        items={tracks.map((track, index) => ({
          key: track.id + index,
          imageUrl: track.album.images[0]?.url,
          label: track.name
        }))}
        onSelect={onSelect}
        onActivate={onPlay}
      />

      <section className="info">
        <h1>{title || '\u00a0'}</h1>
        <p>{subtitle}</p>
        <div className="info-actions">
          {selected && (
            <button className="pill" onClick={onAddToPlaylist}>
              <PlusIcon size={14} /> Add to playlist
            </button>
          )}
          {hasFailed && !isSearching && <button className="pill" onClick={onPlayPlaylist}>Play playlist</button>}
        </div>
      </section>
    </>
  );
}
