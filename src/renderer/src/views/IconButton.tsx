import type { ReactNode } from 'react';

interface Props {
  label: string;      // shown as a tooltip and read by screen readers
  onClick: () => void;
  isActive?: boolean; // highlighted, e.g. shuffle is on
  children: ReactNode;
}

export function IconButton({ label, onClick, isActive = false, children }: Props) {
  return (
    <button className={`icon-button${isActive ? ' active' : ''}`} onClick={onClick} title={label} aria-label={label}>
      {children}
    </button>
  );
}
