import type { Track } from '../models/types';
import { BannerRow } from './BannerRow';
import { PlusIcon } from './Icons';

interface Props {
  tracks: Track[];
  selectedIndex: number;
  listKey: string;
  heading: string;      // playlist name or "Results for ..."
  playingTrackId: string | null;
  isLoading: boolean;
  hasFailed: boolean;
  isSearching: boolean;
  onSelect: (index: number) => void;
  onPlay: (index: number) => void;
  onPlayPlaylist: () => void;
  onAddToPlaylist: () => void;
}

/** The preview: a smaller row with the songs of the playlist you are browsing, and the selected song's name. */
export function Carousel({ tracks, selectedIndex, listKey, heading, playingTrackId, isLoading, hasFailed, isSearching, onSelect, onPlay, onPlayPlaylist, onAddToPlaylist }: Props) {
  const selected = tracks[selectedIndex];

  let title = selected?.name ?? heading;
  let subtitle = selected ? `${selected.artists.map((a) => a.name).join(', ')} · ${heading}` : '\u00a0';
  if (!selected && isLoading) subtitle = 'Loading…';
  if (!selected && !isLoading && isSearching) subtitle = 'No songs found';
  if (!selected && !isLoading && hasFailed && !isSearching) subtitle = 'Spotify only shares songs of playlists you own or collaborate on.';

  return (
    <section className="preview">
      <p className="row-caption">Preview <b key={heading} className="fade-in">{heading}</b></p>

      <BannerRow
        size="medium"
        listKey={listKey}
        isLoading={isLoading}
        selectedIndex={selectedIndex}
        items={tracks.map((track, index) => ({
          key: track.id + index,
          imageUrl: track.album.images[0]?.url,
          label: track.name,
          isPlaying: track.id === playingTrackId
        }))}
        onSelect={onSelect}
        onActivate={onPlay}
      />

      <section className="info">
        {/* A new key makes the text fade in each time the selected song changes. */}
        <div key={selected?.id ?? subtitle} className="fade-in">
          <h1>{title || '\u00a0'}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="info-actions">
          {selected && (
            <button className="pill" onClick={onAddToPlaylist}>
              <PlusIcon size={14} /> Add to playlist
            </button>
          )}
          {hasFailed && !isSearching && <button className="pill" onClick={onPlayPlaylist}>Play playlist</button>}
        </div>
      </section>
    </section>
  );
}
