// SPDX-License-Identifier: MPL-2.0
import { contextBridge, ipcRenderer } from 'electron';
import { CORE_API_VERSION, type BrowserState, type CoreAPI } from '../core/api';
import { CORE_CHANNELS } from '../core/protocol';
const api: CoreAPI = {
  version: CORE_API_VERSION,
  capabilities: () => ipcRenderer.invoke(CORE_CHANNELS.capabilities),
  snapshot: () => ipcRenderer.invoke(CORE_CHANNELS.snapshot),
  command: command => ipcRenderer.invoke(CORE_CHANNELS.command, command),
  onState: callback => {
    const listener = (_event: Electron.IpcRendererEvent, state: BrowserState) => callback(state);
    ipcRenderer.on(CORE_CHANNELS.state, listener);
    return () => ipcRenderer.removeListener(CORE_CHANNELS.state, listener);
  },
  onShortcut: callback => {
    const listener = (_event: Electron.IpcRendererEvent, shortcut: string) => callback(shortcut);
    ipcRenderer.on(CORE_CHANNELS.shortcut, listener);
    return () => ipcRenderer.removeListener(CORE_CHANNELS.shortcut, listener);
  },
};
contextBridge.exposeInMainWorld('astra', api);
