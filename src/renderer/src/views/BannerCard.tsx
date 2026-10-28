import { memo, type CSSProperties } from 'react';
import { CardVideo } from './CardVideo/CardVideo';

export type { BannerSize } from './BannerRow/bannerLayout';

interface Props {
  index: number;
  imageUrl?: string;
  label: string;
  isSelected: boolean;
  isPlaying: boolean;  // shows the moving bars and an accent ring
  videoUrl?: string;     // a looping video to play over the cover
  isVideoActive: boolean; // the music is playing, so the video plays
  entranceDelay: number; // cards further from the middle appear a little later
  register: (index: number, element: HTMLDivElement | null) => void;
  onClick: (index: number) => void;
}

/**
 * One card. Where it sits is set by the row (see bannerLayout.ts), not here, so this only re-renders
 * when its own content changes, not on every step of the scroll.
 */
export const BannerCard = memo(function BannerCard({ index, imageUrl, label, isSelected, isPlaying, videoUrl, isVideoActive, entranceDelay, register, onClick }: Props) {
  return (
    <div
      ref={(element) => register(index, element)}
      role="button"
      title={label}
      data-src={imageUrl}
      className={`card${isSelected ? ' selected' : ''}${isPlaying ? ' playing' : ''}`}
      style={{ '--d': entranceDelay } as CSSProperties}
      onClick={() => onClick(index)}
    >
      {!imageUrl && <span className="card-initial">{label.charAt(0).toUpperCase()}</span>}
      {videoUrl && <CardVideo url={videoUrl} isActive={isVideoActive} />}
      {isPlaying && <span className="eq" aria-label="Playing"><i /><i /><i /></span>}
      <div className="card-label">{label}</div>
    </div>
  );
});
