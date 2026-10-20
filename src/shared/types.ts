export interface AppSettings {
  shortcut: string;         // Electron accelerator, e.g. "CommandOrControl+Alt+M"
  minimizeSpotify: boolean; // minimize the Spotify app when the overlay opens
}

/** Everything the page is allowed to ask the main process to do. */
export interface ElectronApi {
  isConfigured: () => Promise<boolean>;
  hasSession: () => Promise<boolean>;
  getToken: () => Promise<string | null>;
  login: () => Promise<void>;
  setClientId: (clientId: string) => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  setShortcut: (accelerator: string) => Promise<boolean>; // false if another app already uses it
  setMinimizeSpotify: (on: boolean) => Promise<void>;
  hideOverlay: () => void;
  onVisibilityChange: (callback: (isVisible: boolean) => void) => () => void; // returns "stop listening"
}
