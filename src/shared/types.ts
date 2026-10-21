export interface AppSettings {
  shortcut: string;         // Electron accelerator, e.g. "CommandOrControl+Alt+M"
  minimizeSpotify: boolean; // minimize the Spotify app when the overlay opens
  theme: string;            // id of a theme file (its name without .yaml)
}

/** The settings that can change without re-registering the keybind. */
export type UpdatableSettings = Partial<Omit<AppSettings, 'shortcut'>>;

/** The colors a theme file may set. */
export const THEME_COLORS = ['ink', 'dim', 'accent', 'surface', 'line', 'deep'] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

export interface ThemeLayer {
  type: 'gradient' | 'image';
  value: string;   // a CSS gradient, or an image (local files are already converted to data URLs)
  opacity: number; // 0 to 1
  blur: number;    // pixels
  size: string;    // CSS background-size, for images
}

export interface Theme {
  id: string;
  name: string;
  colors: Partial<Record<ThemeColor, string>>;
  dimLayer: string | null; // the dark layer over the screen
  layers: ThemeLayer[];    // extra layers drawn on top of it
}

export interface ThemeList {
  themes: Theme[];
  errors: string[]; // problems found in theme files, shown in the settings
}

/** Everything the page is allowed to ask the main process to do. */
export interface ElectronApi {
  isConfigured: () => Promise<boolean>;
  hasSession: () => Promise<boolean>;
  getToken: () => Promise<string | null>;
  login: () => Promise<void>;
  setClientId: (clientId: string) => Promise<void>;
  usesBuiltInClientId: () => Promise<boolean>; // true when the app ships with its own Client ID
  getSettings: () => Promise<AppSettings>;
  updateSettings: (changes: UpdatableSettings) => Promise<void>;
  setShortcut: (accelerator: string) => Promise<boolean>; // false if another app already uses it
  listThemes: () => Promise<ThemeList>;
  openThemesFolder: () => void;
  openInSpotify: (uri: string) => void;
  hideOverlay: () => void;
  onVisibilityChange: (callback: (isVisible: boolean) => void) => () => void; // returns "stop listening"
}
