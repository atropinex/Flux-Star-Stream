import { BannerCard, type BannerSize } from '../BannerCard';
import './BannerRow.css';

export interface BannerItem {
  key: string;
  imageUrl?: string;
  label: string;
  isPlaying?: boolean;
}

interface Props {
  items: BannerItem[];
  selectedIndex: number;
  size: BannerSize;
  listKey?: string;     // when this changes, all cards are replaced and animate in
  isLoading?: boolean;  // dims the current cards while the next list is on its way
  onSelect: (index: number) => void;
  onActivate: (index: number) => void; // clicking the card that is already selected
}

/** A row of cards with one in the middle. Playlists use it small, the playing songs medium, the browsed songs large. */
export function BannerRow({ items, selectedIndex, size, listKey = 'static', isLoading = false, onSelect, onActivate }: Props) {
  return (
    <div className={`banner-row ${size}${isLoading ? ' loading' : ''}`}>
      <div className="banner-set" key={listKey}>
        {items.map((item, index) => (
          <BannerCard
            key={item.key}
            imageUrl={item.imageUrl}
            label={item.label}
            size={size}
            isPlaying={item.isPlaying ?? false}
            offset={index - selectedIndex}
            // First click selects a card, clicking the selected card plays it.
            onClick={() => (index === selectedIndex ? onActivate(index) : onSelect(index))}
          />
        ))}
      </div>
    </div>
  );
}
