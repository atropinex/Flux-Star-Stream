import type { CSSProperties } from 'react';

export type BannerSize = 'small' | 'large';

// How the cards fan out. The small row uses the same shape at a smaller scale.
const LAYOUT = {
  large: { spacing: 92, centerGap: 40, drop: 7, depth: 40 },
  small: { spacing: 35, centerGap: 15, drop: 3, depth: 15 }
};
const MAX_VISIBLE = 8; // cards further away than this are hidden

interface Props {
  imageUrl?: string;
  label: string;
  offset: number; // 0 = selected, -1 = one to the left, 2 = two to the right ...
  size: BannerSize;
  onClick: () => void;
}

/** One tall card. Its position and size come from how far it is from the selected card. */
export function BannerCard({ imageUrl, label, offset, size, onClick }: Props) {
  const { spacing, centerGap, drop, depth } = LAYOUT[size];
  const distance = Math.abs(offset);
  const isSelected = distance === 0;
  const isHidden = distance > MAX_VISIBLE;

  const x = isSelected ? 0 : offset * spacing + Math.sign(offset) * centerGap;
  const scale = Math.max(0.42, 1 - distance * 0.09);

  const style: CSSProperties = {
    backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
    transform: `translate(-50%, -50%) translateX(${x}px) translateY(${distance * drop}px) translateZ(${-distance * depth}px) scale(${scale})`,
    zIndex: 100 - distance,
    opacity: isHidden ? 0 : 1 - distance * 0.06,
    filter: isSelected ? 'none' : `brightness(${1 - distance * 0.05}) saturate(.85)`,
    pointerEvents: isHidden ? 'none' : 'auto'
  };

  return (
    <div role="button" title={label} className={`card${isSelected ? ' selected' : ''}`} style={style} onClick={onClick}>
      {!imageUrl && <span className="card-initial">{label.charAt(0).toUpperCase()}</span>}
      <div className="card-label">{label}</div>
    </div>
  );
}
