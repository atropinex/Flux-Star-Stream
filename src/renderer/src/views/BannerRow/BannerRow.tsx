import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { BannerCard } from '../BannerCard';
import { placeCard, type BannerSize } from './bannerLayout';
import './BannerRow.css';

export interface BannerItem {
  key: string;
  imageUrl?: string;
  label: string;
  isPlaying?: boolean;
  videoUrl?: string; // a looping video for this card
}

interface Props {
  items: BannerItem[];
  selectedIndex: number;
  size: BannerSize;
  listKey?: string;     // when this changes, all cards are replaced and animate in
  isLoading?: boolean;  // dims the current cards while the next list is on its way
  isVideoActive?: boolean; // the music is playing, so card videos play
  onSelect: (index: number) => void;
  onActivate: (index: number) => void; // clicking the card that is already selected
}

const GLIDE_SECONDS = 0.09;  // how quickly the row catches up with the selected card (smaller = snappier)
const SNAP_WINDOW_MS = 150;  // right after a new list arrives, jump instead of gliding

/**
 * A row of cards with one in the middle. Playlists use it small, the browsed songs medium, the playing songs large.
 *
 * Scrolling is smooth because the row keeps ONE number, its position, and eases it toward the selected card
 * every frame. Each frame only moves the few cards in view. Many quick wheel ticks just change the target,
 * so they never make cards stutter or restart animations.
 */
export function BannerRow({ items, selectedIndex, size, listKey = 'static', isLoading = false, isVideoActive = false, onSelect, onActivate }: Props) {
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const position = useRef(selectedIndex); // where the row is right now (can be a fraction)
  const target = useRef(selectedIndex);   // where it is heading
  const frame = useRef(0);
  const lastTime = useRef(0);
  const snapUntil = useRef(0);

  // The newest props, so the click handler can stay the same function and cards are not re-rendered for it.
  const latest = useRef({ selectedIndex, onSelect, onActivate });
  latest.current = { selectedIndex, onSelect, onActivate };

  // Cards appear starting from the middle of a new list.
  const entrance = useRef({ key: listKey, center: selectedIndex });
  if (entrance.current.key !== listKey) entrance.current = { key: listKey, center: selectedIndex };

  const register = useCallback((index: number, element: HTMLDivElement | null) => {
    cards.current[index] = element;
  }, []);

  // First click selects a card, clicking the selected card plays it.
  const handleClick = useCallback((index: number) => {
    const current = latest.current;
    if (index === current.selectedIndex) current.onActivate(index);
    else current.onSelect(index);
  }, []);

  const paint = useCallback(() => {
    const list = cards.current;
    for (let index = 0; index < list.length; index++) {
      const card = list[index];
      if (card) placeCard(card, index - position.current, size);
    }
  }, [size]);

  const step = useCallback(
    (time: number) => {
      const seconds = Math.min(0.05, (time - lastTime.current) / 1000 || 0.016);
      lastTime.current = time;

      const distance = target.current - position.current;
      if (Math.abs(distance) < 0.002) {
        position.current = target.current;
        frame.current = 0;
        paint();
        return;
      }
      position.current += distance * (1 - Math.exp(-seconds / GLIDE_SECONDS));
      paint();
      frame.current = requestAnimationFrame(step);
    },
    [paint]
  );

  // A new list: place the cards straight away, with no glide across the new songs.
  useLayoutEffect(() => {
    position.current = target.current = latest.current.selectedIndex;
    snapUntil.current = performance.now() + SNAP_WINDOW_MS;
  }, [listKey, size]);

  // Selecting another card: glide to it.
  useEffect(() => {
    target.current = selectedIndex;
    if (performance.now() < snapUntil.current) {
      position.current = selectedIndex;
      paint();
      return;
    }
    if (!frame.current) {
      lastTime.current = performance.now();
      frame.current = requestAnimationFrame(step);
    }
  }, [selectedIndex, paint, step]);

  // Cards that were just added or changed get their place before the screen is drawn.
  useLayoutEffect(() => {
    paint();
  });

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <div className={`banner-row ${size}${isLoading ? ' loading' : ''}`}>
      <div className="banner-set" key={listKey}>
        {items.map((item, index) => (
          <BannerCard
            key={item.key}
            index={index}
            imageUrl={item.imageUrl}
            label={item.label}
            isSelected={index === selectedIndex}
            isPlaying={item.isPlaying ?? false}
            videoUrl={item.videoUrl}
            isVideoActive={item.videoUrl ? isVideoActive : false}
            entranceDelay={Math.min(Math.abs(index - entrance.current.center), 8)}
            register={register}
            onClick={handleClick}
          />
        ))}
      </div>
    </div>
  );
}
