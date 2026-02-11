import { ipcMain, dialog, BrowserWindow } from 'electron';
import { DMXDriver } from './dmx-driver';
import { FixtureManager } from './fixture-manager';
import { log } from './logger';
import * as os from 'os';
import * as fs from 'fs';

interface IPCHandlerOptions {
  driver: DMXDriver;
  fixtureManager: FixtureManager;
}

/**
 * Sets up IPC handlers for main ↔ renderer communication.
 * IPC is reserved for Electron-specific operations (window management, native dialogs, app metadata).
 * Primary data flow uses Socket.io.
 */
export function setupIPCHandlers(options: IPCHandlerOptions): void {
  const { driver, fixtureManager } = options;

  // --- Window Controls ---

  ipcMain.on('window:hide', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.hide();
    }
  });

  // --- DMX Status ---

  ipcMain.handle('dmx:get-status', () => {
    return driver.getStatus();
  });

  // --- Fixture File I/O (requires native dialogs) ---

  ipcMain.handle('fixtures:export-to-file', async () => {
    try {
      const config = fixtureManager.exportConfig();
      const result = await dialog.showSaveDialog({
        title: 'Export Fixture Configuration',
        defaultPath: `fixture-config-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false };
      }

      fs.writeFileSync(result.filePath, JSON.stringify(config, null, 2), 'utf-8');
      log.info(`IPC: Exported fixtures to ${result.filePath}`);
      return { success: true, path: result.filePath };
    } catch (err) {
      log.error('IPC: Error exporting fixtures:', err);
      return { success: false };
    }
  });

  ipcMain.handle('fixtures:import-from-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Fixture Configuration',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content);

      if (config.version !== 1) {
        throw new Error(`Unsupported fixture config version: ${config.version}`);
      }

      log.info(`IPC: Loaded fixture config from ${filePath}`);
      return { success: true, config };
    } catch (err) {
      log.error('IPC: Error importing fixtures:', err);
      return { success: false };
    }
  });

  // --- App Info ---

  ipcMain.handle('app:get-version', () => {
    const { app } = require('electron');
    return app.getVersion();
  });

  ipcMain.handle('app:get-ip', () => {
    return getLocalIP();
  });

  log.info('IPC handlers registered');
}

/**
 * Get the local network IP address.
 */
export function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
