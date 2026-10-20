import { app } from 'electron';
import { AuthModel } from './models/AuthModel';
import { SettingsModel } from './models/SettingsModel';
import { SpotifyApp } from './models/SpotifyApp';
import { IpcController } from './controllers/IpcController';
import { OverlayController } from './controllers/OverlayController';
import { TrayController } from './controllers/TrayController';

// Only one copy may run, otherwise two overlays would fight over the keybind.
if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  app.dock?.hide(); // macOS: no Dock icon, like an overlay

  const settings = new SettingsModel();
  const overlay = new OverlayController(settings, new SpotifyApp());

  new IpcController(new AuthModel(), settings, overlay).register();
  overlay.start();
  new TrayController(overlay).start();

  overlay.show(); // open once on launch so you can see it works
});
