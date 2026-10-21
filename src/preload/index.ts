import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../shared/ipc';
import type { ElectronApi } from '../shared/types';

const api: ElectronApi = {
  bridgeRequest: (command, args) => ipcRenderer.invoke(IPC.bridgeRequest, command, args),
  isBridgeConnected: () => ipcRenderer.invoke(IPC.bridgeStatus),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (changes) => ipcRenderer.invoke(IPC.updateSettings, changes),
  setShortcut: (accelerator) => ipcRenderer.invoke(IPC.setShortcut, accelerator),
  listThemes: () => ipcRenderer.invoke(IPC.listThemes),
  openThemesFolder: () => ipcRenderer.send(IPC.openThemesFolder),
  openInSpotify: (uri) => ipcRenderer.send(IPC.openInSpotify, uri),
  hideOverlay: () => ipcRenderer.send(IPC.hideOverlay),
  onVisibilityChange: (callback) => {
    const listener = (_event: IpcRendererEvent, isVisible: boolean) => callback(isVisible);
    ipcRenderer.on(IPC.visibility, listener);
    return () => ipcRenderer.removeListener(IPC.visibility, listener);
  }
};

contextBridge.exposeInMainWorld('api', api);
