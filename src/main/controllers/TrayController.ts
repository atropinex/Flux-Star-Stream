import { app, Menu, nativeImage, Tray } from 'electron';
import { TRAY_ICON } from '../trayIcon';
import type { OverlayController } from './OverlayController';

/** The tray icon: the only way to quit, since the overlay has no taskbar entry. */
export class TrayController {
  private tray: Tray | null = null; // kept so it is not garbage collected

  constructor(private overlay: OverlayController) {}

  start(): void {
    this.tray = new Tray(nativeImage.createFromDataURL(TRAY_ICON));
    this.tray.setToolTip('Mist');
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Show / hide', click: () => this.overlay.toggle() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ])
    );
    this.tray.on('click', () => this.overlay.toggle());
  }
}
