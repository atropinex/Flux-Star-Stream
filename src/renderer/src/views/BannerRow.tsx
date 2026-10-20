import { BannerCard, type BannerSize } from './BannerCard';

export interface BannerItem {
  key: string;
  imageUrl?: string;
  label: string;
}

interface Props {
  items: BannerItem[];
  selectedIndex: number;
  size: BannerSize;
  onSelect: (index: number) => void;
  onActivate: (index: number) => void; // clicking the card that is already selected
}

/** A row of cards with one in the middle. Used for both playlists (small) and songs (large). */
export function BannerRow({ items, selectedIndex, size, onSelect, onActivate }: Props) {
  return (
    <div className={`banner-row ${size}`}>
      {items.map((item, index) => (
        <BannerCard
          key={item.key}
          imageUrl={item.imageUrl}
          label={item.label}
          size={size}
          offset={index - selectedIndex}
          // First click selects a card, clicking the selected card plays it.
          onClick={() => (index === selectedIndex ? onActivate(index) : onSelect(index))}
        />
      ))}
    </div>
  );
}
