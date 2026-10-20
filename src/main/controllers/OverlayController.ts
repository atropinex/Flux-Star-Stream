import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import { join } from 'path';
import { IPC } from '../../shared/ipc';
import type { SettingsModel } from '../models/SettingsModel';
import type { SpotifyApp } from '../models/SpotifyApp';

/** The full-screen overlay window and the keybind that opens it. */
export class OverlayController {
  private window!: BrowserWindow;

  constructor(private settings: SettingsModel, private spotifyApp: SpotifyApp) {}

  start(): void {
    this.createWindow();

    const { shortcut } = this.settings.get();
    if (!globalShortcut.register(shortcut, () => this.toggle())) {
      console.warn(`Could not register ${shortcut}. Another app may be using it.`);
    }
    app.on('will-quit', () => globalShortcut.unregisterAll());
  }

  toggle(): void {
    this.window.isVisible() ? this.hide() : this.show();
  }

  show(minimizeSpotify = true): void {
    // Cover the screen the mouse is on.
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    this.window.setBounds(display.bounds);
    this.window.show();
    this.window.focus();
    this.window.webContents.send(IPC.visibility, true);

    if (minimizeSpotify && this.settings.get().minimizeSpotify) {
      // Takes a moment, so the overlay is already visible. Take focus back afterwards.
      this.spotifyApp.minimize().then(() => this.window.focus());
    }
  }

  hide(): void {
    this.window.hide();
    this.window.webContents.send(IPC.visibility, false);
  }

  /** Changes the keybind. Returns false (and keeps the old one) if it cannot be used. */
  setShortcut(accelerator: string): boolean {
    const previous = this.settings.get().shortcut;
    globalShortcut.unregister(previous);

    let isRegistered = false;
    try {
      isRegistered = globalShortcut.register(accelerator, () => this.toggle());
    } catch {
      // An invalid accelerator ends up here.
    }

    if (!isRegistered) {
      globalShortcut.register(previous, () => this.toggle());
      return false;
    }
    this.settings.update({ shortcut: accelerator });
    return true;
  }

  private createWindow(): void {
    this.window = new BrowserWindow({
      transparent: true,
      frame: false,
      show: false,
      resizable: false,
      hasShadow: false,
      skipTaskbar: true,
      fullscreenable: false,
      webPreferences: { preload: join(__dirname, '../preload/index.js') }
    });

    this.window.setAlwaysOnTop(true, 'screen-saver'); // above other windows
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // While developing, electron-vite serves the page from a local dev server.
    const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
    if (!app.isPackaged && devServerUrl) {
      this.window.loadURL(devServerUrl);
    } else {
      this.window.loadFile(join(__dirname, '../renderer/index.html'));
    }
  }
}
