export interface AppSettings {
  shortcut: string;
  minimizeSpotify: boolean;
  theme: string;
}

export type UpdatableSettings = Partial<Omit<AppSettings, 'shortcut'>>;

export const THEME_COLORS = ['ink', 'dim', 'accent', 'surface', 'line', 'deep'] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

export interface ThemeLayer {
  type: 'gradient' | 'image';
  value: string;
  opacity: number;
  blur: number;
  size: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: Partial<Record<ThemeColor, string>>;
  dimLayer: string | null;
  layers: ThemeLayer[];
}

export interface ThemeList {
  themes: Theme[];
  errors: string[];
}

/** Everything the page is allowed to ask the main process to do. */
export interface ElectronApi {
  isConfigured: () => Promise<boolean>;
  hasSession: () => Promise<boolean>;
  getToken: () => Promise<string | null>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setClientId: (clientId: string) => Promise<void>;
  usesBuiltInClientId: () => Promise<boolean>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (changes: UpdatableSettings) => Promise<void>;
  setShortcut: (accelerator: string) => Promise<boolean>;
  listThemes: () => Promise<ThemeList>;
  openThemesFolder: () => void;
  openInSpotify: (uri: string) => void;
  hideOverlay: () => void;
  onVisibilityChange: (callback: (isVisible: boolean) => void) => () => void;
}
