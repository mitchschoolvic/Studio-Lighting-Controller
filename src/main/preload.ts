import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script — exposes a limited API to the renderer via contextBridge.
 * nodeIntegration is disabled and contextIsolation is enabled.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  hideWindow: () => ipcRenderer.send('window:hide'),

  // DMX status (fallback — primary data flows via Socket.io)
  getDMXStatus: () => ipcRenderer.invoke('dmx:get-status'),

  // Fixture file operations (require native dialog access)
  exportFixtures: () => ipcRenderer.invoke('fixtures:export-to-file'),
  importFixtures: () => ipcRenderer.invoke('fixtures:import-from-file'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getNetworkIP: () => ipcRenderer.invoke('app:get-ip'),
});
