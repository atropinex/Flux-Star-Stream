import { useEffect, useState } from 'react';

/** Which card is in the middle of the carousel. Goes back to the first card when the list changes. */
export function useSelection(count: number, list: unknown) {
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [list]);

  const clamp = (value: number) => Math.max(0, Math.min(count - 1, value));

  return {
    index: clamp(index),
    select: (value: number) => setIndex(clamp(value)),
    move: (step: number) => setIndex((current) => clamp(current + step))
  };
}
