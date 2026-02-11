import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { initializeLogger, log } from './logger';
import { DMXUniverse } from './dmx-universe';
import { DMXDriver } from './dmx-driver';
import { FixtureManager } from './fixture-manager';
import { PresetManager } from './preset-manager';
import { FadeEngine } from './fade-engine';
import { SocketUIServer } from './socket-ui';
import { CompanionServer } from './socket-companion';
import { setupIPCHandlers, getLocalIP } from './ipc-handlers';

// Global references to prevent garbage collection
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let store: any;
let universe: DMXUniverse;
let dmxDriver: DMXDriver;
let fixtureManager: FixtureManager;
let presetManager: PresetManager;
let fadeEngine: FadeEngine;
let socketUIServer: SocketUIServer;
let companionServer: CompanionServer;
let isQuitting = false;

const isDev = !app.isPackaged;
const UI_PORT = 9090;
const VITE_DEV_PORT = 5173;

/**
 * Create or show the main BrowserWindow (lazy-created).
 */
function createOrShowWindow(): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'DMX Controller',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    titleBarStyle: 'hiddenInset',
  });

  // Load the UI
  if (isDev) {
    // In dev mode, Vite serves the renderer on port 5173
    mainWindow.loadURL(`http://localhost:${VITE_DEV_PORT}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, Socket.io HTTP server serves static renderer build
    mainWindow.loadURL(`http://localhost:${UI_PORT}`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Hide instead of close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Create the macOS tray icon and menu.
 */
function createTray(): void {
  // Create a simple tray icon (22x22 template image for macOS)
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'tray-icon.png');
  let trayIcon: Electron.NativeImage;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    trayIcon = trayIcon.resize({ width: 22, height: 22 });
    trayIcon.setTemplateImage(true);
  } catch {
    // Fallback: create a simple icon programmatically
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('DMX Controller');

  updateTrayMenu();

  tray.on('click', () => {
    createOrShowWindow();
  });
}

/**
 * Update the tray menu with current status.
 */
function updateTrayMenu(): void {
  if (!tray) return;

  const dmxStatus = dmxDriver.getStatus();
  const ip = getLocalIP();
  const statusText = dmxStatus.connected
    ? `Connected (${dmxStatus.port})`
    : 'Disconnected — Reconnecting...';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Console',
      click: () => createOrShowWindow(),
    },
    { type: 'separator' },
    {
      label: `IP: ${ip}:${UI_PORT}`,
      enabled: false,
    },
    {
      label: `DMX: ${statusText}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Restart DMX',
      click: async () => {
        await dmxDriver.restart();
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        gracefulShutdown();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Graceful shutdown — stop all services and quit.
 */
async function gracefulShutdown(): Promise<void> {
  log.info('Application: Graceful shutdown initiated...');

  try {
    if (companionServer) {
      await companionServer.shutdown();
    }
    if (socketUIServer) {
      await socketUIServer.shutdown();
    }
    if (dmxDriver) {
      await dmxDriver.shutdown();
    }
  } catch (err) {
    log.error('Application: Error during shutdown:', err);
  }

  log.info('Application: Shutdown complete. Quitting.');
  app.quit();
}

/**
 * Main application startup sequence.
 */
async function main(): Promise<void> {
  // --- Step 1: App ready ---
  await app.whenReady();
  log.info('Application: Electron app ready');

  // Prevent multiple instances
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    createOrShowWindow();
  });

  // --- Step 2: Initialize logger ---
  initializeLogger();
  log.info('Application: Starting DMX Controller...');
  log.info(`Application: Mode = ${isDev ? 'development' : 'production'}`);

  // --- Step 3: Initialize electron-store (ESM-only, requires dynamic import) ---
  // Use Function constructor to prevent TypeScript from converting import() to require()
  const importDynamic = new Function('modulePath', 'return import(modulePath)');
  const { default: Store } = await importDynamic('electron-store');
  store = new Store({
    defaults: {
      presets: [],
      fixtures: [],
      settings: {
        defaultFadeTime: 1000,
        uiThrottleRate: 33,
        dmxRefreshRate: 25,
      },
    },
  });
  log.info('Application: Store initialized');

  // --- Step 4: Create DMXUniverse instance ---
  universe = new DMXUniverse();

  // --- Step 5: Create FixtureManager instance ---
  fixtureManager = new FixtureManager(store);
  log.info(`Application: Loaded ${fixtureManager.getAll().length} fixture(s)`);

  // --- Step 6: Create PresetManager instance ---
  presetManager = new PresetManager(store);
  log.info(`Application: Loaded ${presetManager.getAll().length} preset(s)`);

  // --- Step 7: Create FadeEngine instance ---
  fadeEngine = new FadeEngine(universe);

  // --- Step 8: Auto-detect Enttec USB Pro & start DMX refresh loop ---
  dmxDriver = new DMXDriver({ universe });
  await dmxDriver.initialize();

  // Update tray menu when DMX status changes
  dmxDriver.onStatusChange(() => {
    updateTrayMenu();
  });

  // --- Step 9: Start Socket.io server ---
  socketUIServer = new SocketUIServer({
    universe,
    driver: dmxDriver,
    presetManager,
    fixtureManager,
    fadeEngine,
    isDev,
  });
  await socketUIServer.start();

  // --- Step 10: Start Companion WebSocket server ---
  companionServer = new CompanionServer({
    universe,
    driver: dmxDriver,
    presetManager,
    fixtureManager,
    fadeEngine,
  });

  // Bridge UI preset activations to Companion clients
  socketUIServer.onPresetActivated((data) => {
    companionServer.broadcast({
      event: 'preset_activated',
      data,
    });
  });

  // Bridge preset list changes to Companion clients
  socketUIServer.onPresetListChanged(() => {
    const presets = presetManager.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      fadeTime: p.fadeTime,
      color: p.color,
    }));
    companionServer.broadcast({
      event: 'presets_updated',
      data: presets,
    });
  });

  // Bridge Companion preset recalls to UI clients
  companionServer.onPresetRecalled((data) => {
    socketUIServer.broadcastPresetActivated(data);
  });

  // --- Step 11: Setup IPC handlers ---
  setupIPCHandlers({
    driver: dmxDriver,
    fixtureManager,
  });

  // --- Step 12: Create macOS Tray icon ---
  createTray();

  log.info('Application: Startup complete — ready');
  log.info(`Application: UI available at http://${getLocalIP()}:${UI_PORT}`);

  // --- macOS: Keep app running when all windows are closed ---
  app.on('window-all-closed', () => {
    // Do nothing — keep the tray app running
  });

  // Hide dock icon (tray-only app)
  if (app.dock) {
    app.dock.hide();
  }
}

// --- Uncaught Exception Handlers ---
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  // Do NOT call app.quit() — keep the server alive
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});

// --- Launch ---
main().catch((err) => {
  log.error('Application: Fatal startup error:', err);
  process.exit(1);
});
