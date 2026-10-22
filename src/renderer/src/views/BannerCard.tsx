import type { CSSProperties } from 'react';

export type BannerSize = 'small' | 'medium' | 'large';

// How the cards fan out. Every size uses the same shape at a different scale.
const LAYOUT = {
  large: { spacing: 92, centerGap: 40, depth: 40 },
  medium: { spacing: 52, centerGap: 24, depth: 24 },
  small: { spacing: 35, centerGap: 15, depth: 15 }
};
const MAX_VISIBLE = 8; // cards further away than this are hidden

interface Props {
  imageUrl?: string;
  label: string;
  offset: number;     // 0 = selected, -1 = one to the left, 2 = two to the right ...
  size: BannerSize;
  isPlaying: boolean; // shows the moving bars and an accent ring
  onClick: () => void;
}

/** One tall card. Its position and size come from how far it is from the selected card. */
export function BannerCard({ imageUrl, label, offset, size, isPlaying, onClick }: Props) {
  const { spacing, centerGap, depth } = LAYOUT[size];
  const distance = Math.abs(offset);
  const isSelected = distance === 0;
  const isHidden = distance > MAX_VISIBLE;

  const x = isSelected ? 0 : offset * spacing + Math.sign(offset) * centerGap;
  const scale = Math.max(0.42, 1 - distance * 0.09);

  const style = {
    backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
    transform: `translate(-50%, -50%) translateX(${x}px) translateZ(${-distance * depth}px) scale(${scale})`,
    zIndex: 100 - distance,
    opacity: isHidden ? 0 : 1 - distance * 0.06,
    filter: isSelected ? 'none' : `brightness(${1 - distance * 0.05}) saturate(.85)`,
    pointerEvents: isHidden ? 'none' : 'auto',
    '--d': Math.min(distance, MAX_VISIBLE) // cards further from the middle appear a little later
  } as CSSProperties;

  return (
    <div
      role="button"
      title={label}
      className={`card${isSelected ? ' selected' : ''}${isPlaying ? ' playing' : ''}`}
      style={style}
      onClick={onClick}
    >
      {!imageUrl && <span className="card-initial">{label.charAt(0).toUpperCase()}</span>}
      {isPlaying && <span className="eq" aria-label="Playing"><i /><i /><i /></span>}
      <div className="card-label">{label}</div>
    </div>
  );
}
