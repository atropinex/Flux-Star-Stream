import type { Track } from '../../models/types';
import { BannerRow } from '../BannerRow/BannerRow';
import './PlayingRow.css';

interface Props {
  tracks: Track[];
  selectedIndex: number;
  playingIndex: number;
  listKey: string;
  heading: string;
  hasPlayback: boolean;
  isLoading: boolean;
  canvasUrl?: string | null;
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
}

/** The large row: the songs of the playlist that is playing. Scroll it, and click a song to play it. */
export function PlayingRow({ tracks, selectedIndex, playingIndex, listKey, heading, hasPlayback, isLoading, canvasUrl, onSelect, onActivate }: Props) {
  return (
    <section className="playing-row">
      <p className="row-caption">Playing from <b key={heading} className="fade-in">{heading}</b></p>
      <BannerRow
        size="large"
        listKey={listKey}
        isLoading={isLoading}
        selectedIndex={selectedIndex}
        items={tracks.map((track, index) => ({
          key: track.id + index,
          imageUrl: track.album.images[0]?.url,
          label: track.name,
          isPlaying: index === playingIndex
        }))}
        onSelect={onSelect}
        onActivate={onActivate}
      />
      {canvasUrl && tracks.length > 0 && (
        <video
          className="playing-canvas"
          key={canvasUrl}
          src={canvasUrl}
          autoPlay
          loop
          muted
          playsInline
          aria-label="Spotify Canvas"
        />
      )}
      {!hasPlayback && <p className="empty-hint">Nothing playing yet. Pick a song in the preview and press Enter.</p>}
    </section>
  );
}
