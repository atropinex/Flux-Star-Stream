import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
}

/** All icons share this wrapper. Filled icons use the text colour, line icons draw with it. */
function Svg({ size = 20, filled = false, children }: IconProps & { filled?: boolean; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => <Svg filled {...p}><path d="M8 5v14l11-7z" /></Svg>;
export const PauseIcon = (p: IconProps) => <Svg filled {...p}><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></Svg>;
export const NextIcon = (p: IconProps) => <Svg filled {...p}><path d="M6 5l9 7-9 7zM17 5h2v14h-2z" /></Svg>;
export const PreviousIcon = (p: IconProps) => <Svg filled {...p}><path d="M18 5l-9 7 9 7zM5 5h2v14H5z" /></Svg>;
export const ShuffleIcon = (p: IconProps) => <Svg {...p}><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></Svg>;
export const SearchIcon = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></Svg>;
export const SettingsIcon = (p: IconProps) => <Svg {...p}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></Svg>;
export const PlusIcon = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M18 6L6 18M6 6l12 12" /></Svg>;

export function VolumeIcon({ level, ...p }: IconProps & { level: 'mute' | 'low' | 'high' }) {
  return (
    <Svg {...p}>
      <path d="M11 5L6 9H2v6h4l5 4z" />
      {level === 'mute' && <path d="M23 9l-6 6M17 9l6 6" />}
      {level === 'low' && <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
      {level === 'high' && <path d="M19 5a10 10 0 0 1 0 14M15.5 8.5a5 5 0 0 1 0 7" />}
    </Svg>
  );
}
