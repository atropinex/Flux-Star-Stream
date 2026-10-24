export type BannerSize = 'small' | 'medium' | 'large';

// How the cards fan out. Every size uses the same shape at a different scale.
const LAYOUT = {
  large: { spacing: 92, centerGap: 40, depth: 40 },
  medium: { spacing: 52, centerGap: 24, depth: 24 },
  small: { spacing: 35, centerGap: 15, depth: 15 }
};

const PERSPECTIVE = 1400;  // gives far cards the same shrink the old 3D depth gave, without real 3D
const MAX_VISIBLE = 8;     // cards further away than this fade out completely
const FADE_PER_STEP = 0.06;

/** How far from the middle a card can be and still be drawn. */
export const DRAW_DISTANCE = MAX_VISIBLE + 1;

function hide(card: HTMLElement): void {
  if (card.dataset.hidden === '1') return;
  card.dataset.hidden = '1';
  card.style.visibility = 'hidden';
  card.style.pointerEvents = 'none';
  card.style.willChange = '';
}

/**
 * Puts one card where it belongs. `offset` is how far it is from the middle, and it can be a fraction while
 * the row glides, so every value below changes smoothly. This writes straight to the element,
 * which is much cheaper than asking React to re-render every card 60 times a second.
 */
export function placeCard(card: HTMLElement, offset: number, size: BannerSize): void {
  const distance = Math.abs(offset);
  if (distance > DRAW_DISTANCE) return hide(card);

  const { spacing, centerGap, depth } = LAYOUT[size];
  const depthFactor = PERSPECTIVE / (PERSPECTIVE + distance * depth);
  const gap = centerGap * Math.min(distance, 1); // the gap around the middle card grows as a card leaves it
  const x = Math.sign(offset) * (distance * spacing + gap) * depthFactor;
  const scale = Math.max(0.42, 1 - distance * 0.09) * depthFactor;

  // Fades with distance, and fades out gently at the edge instead of disappearing suddenly.
  const opacity =
    distance <= MAX_VISIBLE
      ? 1 - distance * FADE_PER_STEP
      : (1 - MAX_VISIBLE * FADE_PER_STEP) * (DRAW_DISTANCE - distance);

  if (card.dataset.hidden !== '0') {
    card.dataset.hidden = '0';
    card.style.visibility = '';
    card.style.willChange = 'transform, opacity';
  }

  // Cover art is only loaded for cards that come near the middle, not for a whole 500-song playlist at once.
  const source = card.dataset.src ?? '';
  if (card.dataset.applied !== source) {
    card.style.backgroundImage = source ? `url("${source}")` : '';
    card.dataset.applied = source;
  }

  card.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(2)}px) scale(${scale.toFixed(4)})`;
  card.style.opacity = opacity.toFixed(3);
  card.style.zIndex = String(100 - Math.round(distance));
  card.style.pointerEvents = opacity > 0.05 ? 'auto' : 'none';
}
