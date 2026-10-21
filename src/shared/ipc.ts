// Message names shared by the main process and the preload bridge.
export const IPC = {
  isConfigured: 'auth:is-configured',
  hasSession: 'auth:has-session',
  getToken: 'auth:get-token',
  login: 'auth:login',
  logout: 'auth:logout',
  setClientId: 'auth:set-client-id',
  usesBuiltInClientId: 'auth:uses-built-in-client-id',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  setShortcut: 'settings:set-shortcut',
  listThemes: 'themes:list',
  openThemesFolder: 'themes:open-folder',
  openInSpotify: 'spotify:open',
  hideOverlay: 'overlay:hide',
  visibility: 'overlay:visibility'
} as const;
