import { app } from 'electron';
import { BridgeModel } from './models/BridgeModel';
import { SettingsModel } from './models/SettingsModel';
import { SpotifyApp } from './models/SpotifyApp';
import { ThemeModel } from './models/ThemeModel';
import { IpcController } from './controllers/IpcController';
import { OverlayController } from './controllers/OverlayController';
import { TrayController } from './controllers/TrayController';

// Only one copy may run, otherwise two overlays would fight over the keybind.
if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  app.dock?.hide(); // macOS: no Dock icon, like an overlay

  const settings = new SettingsModel();
  const overlay = new OverlayController(settings, new SpotifyApp());

  // The Spicetify extension inside the Spotify app connects here. All Spotify requests go through it.
  const bridge = new BridgeModel();
  bridge.start();
  app.on('will-quit', () => bridge.stop());

  new IpcController(settings, new ThemeModel(), overlay, bridge).register();
  overlay.start();
  new TrayController(overlay).start();

  overlay.show(); // open once on launch so you can see it works
});
