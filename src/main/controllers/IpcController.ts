import { ipcMain, shell } from 'electron';
import { IPC } from '../../shared/ipc';
import type { UpdatableSettings } from '../../shared/types';
import type { AuthModel } from '../models/AuthModel';
import type { SettingsModel } from '../models/SettingsModel';
import type { ThemeModel } from '../models/ThemeModel';
import type { OverlayController } from './OverlayController';

/** Keeps only valid values, since this data comes from the page. */
function cleanSettings(changes: UpdatableSettings): UpdatableSettings {
  const clean: UpdatableSettings = {};
  if (typeof changes.minimizeSpotify === 'boolean') clean.minimizeSpotify = changes.minimizeSpotify;
  if (typeof changes.theme === 'string') clean.theme = changes.theme;
  return clean;
}

/** Answers requests that the page sends through the preload bridge. */
export class IpcController {
  constructor(
    private auth: AuthModel,
    private settings: SettingsModel,
    private themes: ThemeModel,
    private overlay: OverlayController
  ) {}

  register(): void {
    ipcMain.handle(IPC.isConfigured, () => this.auth.isConfigured());
    ipcMain.handle(IPC.hasSession, () => this.auth.hasSession());
    ipcMain.handle(IPC.getToken, () => this.auth.getAccessToken());
    ipcMain.handle(IPC.setClientId, (_event, clientId: string) => this.auth.setClientId(clientId));
    ipcMain.handle(IPC.usesBuiltInClientId, () => this.auth.usesBuiltInClientId());
    ipcMain.handle(IPC.login, () => this.login());

    ipcMain.handle(IPC.getSettings, () => this.settings.get());
    ipcMain.handle(IPC.updateSettings, (_event, changes: UpdatableSettings) => this.settings.update(cleanSettings(changes)));
    ipcMain.handle(IPC.setShortcut, (_event, accelerator: string) => this.overlay.setShortcut(accelerator));

    ipcMain.handle(IPC.listThemes, () => this.themes.load());
    ipcMain.on(IPC.openThemesFolder, () => void shell.openPath(this.themes.folder));

    // Only Spotify links, never anything else.
    ipcMain.on(IPC.openInSpotify, (_event, uri: string) => {
      if (/^spotify:[a-z]+:[A-Za-z0-9]+$/.test(uri)) void shell.openExternal(uri);
    });

    ipcMain.on(IPC.hideOverlay, () => this.overlay.hide());
  }

  /** The login page opens in the browser, which would sit behind the overlay, so hide it meanwhile. */
  private async login(): Promise<void> {
    this.overlay.hide();
    try {
      await this.auth.login();
    } finally {
      this.overlay.show(false);
    }
  }
}
