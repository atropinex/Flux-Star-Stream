import type { Track } from '../models/types';
import { BannerRow } from './BannerRow';
import './PlayingRow.css';

interface Props {
  tracks: Track[];
  selectedIndex: number; // the card in the middle (scrollable)
  playingIndex: number;  // the song that is playing
  listKey: string;
  heading: string;       // name of the playlist it is playing from
  hasPlayback: boolean;
  isLoading: boolean;
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
}

/** The large row: the songs of the playlist that is playing. Scroll it, and click a song to play it. */
export function PlayingRow({ tracks, selectedIndex, playingIndex, listKey, heading, hasPlayback, isLoading, onSelect, onActivate }: Props) {
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
        onSelect={onSelect}     // first click centers a song
        onActivate={onActivate} // clicking the centered song plays it
      />

      {!hasPlayback && <p className="empty-hint">Nothing playing yet. Pick a song in the preview and press Enter.</p>}
    </section>
  );
}
