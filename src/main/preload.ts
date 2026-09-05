import { contextBridge, ipcRenderer } from 'electron';
import type { AstraAPI, BrowserState } from '../shared/types';
const api: AstraAPI = {
  snapshot: () => ipcRenderer.invoke('astra:snapshot'),
  command: command => ipcRenderer.invoke('astra:command', command),
  onState: callback => {
    const listener = (_event: Electron.IpcRendererEvent, state: BrowserState) => callback(state);
    ipcRenderer.on('astra:state', listener);
    return () => ipcRenderer.removeListener('astra:state', listener);
  },
  onShortcut: callback => {
    const listener = (_event: Electron.IpcRendererEvent, shortcut: string) => callback(shortcut);
    ipcRenderer.on('astra:shortcut', listener);
    return () => ipcRenderer.removeListener('astra:shortcut', listener);
  },
};
contextBridge.exposeInMainWorld('astra', api);
