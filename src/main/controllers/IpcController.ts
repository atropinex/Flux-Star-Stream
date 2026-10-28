import { ipcMain, shell } from 'electron';
import { IPC } from '../../shared/ipc';
import type { BridgeReply, UpdatableSettings } from '../../shared/types';
import { BridgeError, type BridgeModel } from '../models/BridgeModel';
import type { SettingsModel } from '../models/SettingsModel';
import type { ThemeModel } from '../models/ThemeModel';
import type { OverlayController } from './OverlayController';

/** Keeps only valid values, since this data comes from the page. */
function cleanSettings(changes: UpdatableSettings): UpdatableSettings {
  const clean: UpdatableSettings = {};
  if (typeof changes.minimizeSpotify === 'boolean') clean.minimizeSpotify = changes.minimizeSpotify;
  if (typeof changes.crossfadeEnabled === 'boolean') clean.crossfadeEnabled = changes.crossfadeEnabled;
  if (typeof changes.crossfadeSeconds === 'number' && Number.isFinite(changes.crossfadeSeconds)) {
    clean.crossfadeSeconds = Math.max(0, Math.min(12, Math.round(changes.crossfadeSeconds)));
  }
  if (typeof changes.theme === 'string') clean.theme = changes.theme;
  if (typeof changes.canvasVideo === 'boolean') clean.canvasVideo = changes.canvasVideo;
  return clean;
}

/** Answers requests that the page sends through the preload bridge. */
export class IpcController {
  constructor(
    private settings: SettingsModel,
    private themes: ThemeModel,
    private overlay: OverlayController,
    private bridge: BridgeModel
  ) {}

  register(): void {
    ipcMain.handle(IPC.bridgeStatus, () => this.bridge.isConnected());
    ipcMain.handle(IPC.bridgeRequest, (_event, command: string, args: unknown) => this.askSpotify(command, args));

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

  /** Errors are returned as data, because Electron would wrap thrown errors in a long technical message. */
  private async askSpotify(command: string, args: unknown): Promise<BridgeReply> {
    if (typeof command !== 'string') return { ok: false, error: { message: 'Bad request.' } };
    try {
      return { ok: true, data: await this.bridge.request(command, args) };
    } catch (error) {
      const failure = error instanceof BridgeError ? error : new BridgeError('Something went wrong.');
      return { ok: false, error: { message: failure.message, status: failure.status } };
    }
  }
}
