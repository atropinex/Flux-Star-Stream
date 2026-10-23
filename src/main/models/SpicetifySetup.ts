import { app, dialog, shell } from 'electron';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const INSTALLER_URL = 'https://raw.githubusercontent.com/spicetify/cli/main/install.ps1';
const DOCS_URL = 'https://spicetify.app/docs/';

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message));
      else resolve(stdout.trim());
    });
  });
}

async function findSpicetify(): Promise<string | null> {
  const candidates = [
    join(process.env.LOCALAPPDATA ?? '', 'spicetify', 'spicetify.exe'),
    join(process.env.APPDATA ?? '', 'spicetify', 'spicetify.exe')
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  try {
    const output = await run('where.exe', ['spicetify.exe']);
    const match = output.split(/\r?\n/).find((line) => line.trim() && existsSync(line.trim()));
    return match?.trim() ?? null;
  } catch {
    return null;
  }
}

async function installSpicetify(): Promise<boolean> {
  const answer = await dialog.showMessageBox({
    type: 'warning',
    title: 'Spicetify is required',
    message: 'Flux Star Stream needs Spicetify to connect to the Spotify desktop app.',
    detail: 'Spicetify is not installed. Install it now using the official Spicetify installer? You can cancel and quit the app instead.',
    buttons: ['Install Spicetify', 'Quit'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });
  if (answer.response !== 0) return false;

  try {
    await run('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command', `iwr -useb '${INSTALLER_URL}' | iex`
    ]);
    return (await findSpicetify()) !== null;
  } catch (error) {
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Spicetify installation failed',
      message: 'Spicetify could not be installed automatically.',
      detail: error instanceof Error ? error.message : String(error),
      buttons: ['Open installation guide', 'Quit'],
      defaultId: 0,
      cancelId: 1
    });
    if (result.response === 0) await shell.openExternal(DOCS_URL);
    return false;
  }
}

async function configureBridge(spicetifyPath: string): Promise<boolean> {
  const configDir = join(app.getPath('appData'), 'spicetify');
  const configPath = [
    join(configDir, 'config-xpui.ini'),
    join(configDir, 'config.ini')
  ].find((path) => existsSync(path));

  if (!configPath) {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Finish Spicetify setup',
      message: 'Spicetify is installed but has not been initialized yet.',
      detail: 'Open a terminal, run "spicetify" once, then reopen Flux Star Stream.',
      buttons: ['Open Spicetify docs', 'Quit'],
      defaultId: 0,
      cancelId: 1
    });
    if (result.response === 0) await shell.openExternal(DOCS_URL);
    return false;
  }

  const extensionDir = join(configDir, 'Extensions');
  const extensionPath = join(extensionDir, 'fluxBridge.js');
  const sourcePath = app.isPackaged
    ? join(process.resourcesPath, 'flux-setup', 'fluxBridge.js')
    : join(app.getAppPath(), 'spicetify', 'fluxBridge.js');

  try {
    let config = await readFile(configPath, 'utf8');
    const extensionLine = config.match(/^([ \t]*extensions[ \t]*=[ \t]*)(.*)$/im);
    const entries = extensionLine?.[2].trim().replace(/^["']|["']$/g, '').split('|').map((entry) => entry.trim()).filter(Boolean) ?? [];
    const alreadyConfigured = entries.includes('fluxBridge.js');
    let bridgeIsCurrent = false;
    try {
      bridgeIsCurrent = (await readFile(extensionPath, 'utf8')).includes("const BRIDGE_BUILD = 'search-results-v6';");
    } catch {
      // The extension has not been installed yet.
    }

    if (alreadyConfigured && bridgeIsCurrent) return true;

    await mkdir(extensionDir, { recursive: true });
    await copyFile(sourcePath, extensionPath);

    if (!alreadyConfigured) {
      if (extensionLine) {
        const value = entries.length ? `${entries.join('|')}|fluxBridge.js` : 'fluxBridge.js';
        config = config.replace(extensionLine[0], `${extensionLine[1]}${value}`);
      } else {
        config += `\nextensions = fluxBridge.js\n`;
      }
      await writeFile(configPath, config, 'utf8');
    }

    await run(spicetifyPath, ['apply']);
    return true;
  } catch (error) {
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Spicetify setup failed',
      message: 'Flux Star Stream could not configure the Spicetify bridge.',
      detail: error instanceof Error ? error.message : String(error),
      buttons: ['Open Spicetify docs', 'Quit'],
      defaultId: 0,
      cancelId: 1
    });
    if (result.response === 0) await shell.openExternal(DOCS_URL);
    return false;
  }
}

/** Ensure the required Spotify desktop bridge is installed before opening the overlay. */
export async function ensureSpicetifyReady(): Promise<boolean> {
  if (process.platform !== 'win32') return true;

  let spicetifyPath = await findSpicetify();
  if (!spicetifyPath) {
    if (!(await installSpicetify())) return false;
    spicetifyPath = await findSpicetify();
  }
  if (!spicetifyPath) {
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Spicetify was not found',
      message: 'Install Spicetify, then reopen Flux Star Stream.',
      buttons: ['Open Spicetify docs', 'Quit'],
      defaultId: 0,
      cancelId: 1
    });
    if (result.response === 0) await shell.openExternal(DOCS_URL);
    return false;
  }

  return configureBridge(spicetifyPath);
}
