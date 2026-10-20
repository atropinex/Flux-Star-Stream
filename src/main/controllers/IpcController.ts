import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc';
import type { AuthModel } from '../models/AuthModel';
import type { SettingsModel } from '../models/SettingsModel';
import type { OverlayController } from './OverlayController';

/** Answers requests that the page sends through the preload bridge. */
export class IpcController {
  constructor(
    private auth: AuthModel,
    private settings: SettingsModel,
    private overlay: OverlayController
  ) {}

  register(): void {
    ipcMain.handle(IPC.isConfigured, () => this.auth.isConfigured());
    ipcMain.handle(IPC.hasSession, () => this.auth.hasSession());
    ipcMain.handle(IPC.getToken, () => this.auth.getAccessToken());
    ipcMain.handle(IPC.setClientId, (_event, clientId: string) => this.auth.setClientId(clientId));
    ipcMain.handle(IPC.login, () => this.login());

    ipcMain.handle(IPC.getSettings, () => this.settings.get());
    ipcMain.handle(IPC.setShortcut, (_event, accelerator: string) => this.overlay.setShortcut(accelerator));
    ipcMain.handle(IPC.setMinimizeSpotify, (_event, on: boolean) => this.settings.update({ minimizeSpotify: on }));
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
