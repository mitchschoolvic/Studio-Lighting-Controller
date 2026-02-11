import { Server as HttpServer, createServer, IncomingMessage, ServerResponse } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import * as fs from 'fs';
import { DMXUniverse } from './dmx-universe';
import { DMXDriver } from './dmx-driver';
import { PresetManager } from './preset-manager';
import { FixtureManager } from './fixture-manager';
import { FadeEngine } from './fade-engine';
import { log } from './logger';

const UI_PORT = 9090;
const UI_THROTTLE_MS = 33; // ~30 fps max for UI updates

interface SocketUIOptions {
  universe: DMXUniverse;
  driver: DMXDriver;
  presetManager: PresetManager;
  fixtureManager: FixtureManager;
  fadeEngine: FadeEngine;
  isDev: boolean;
}

/**
 * SocketUIServer — Socket.io server for bidirectional real-time sync
 * between the React UI and the DMX universe. Also serves the static
 * renderer build in production mode.
 */
export class SocketUIServer {
  private io: Server;
  private httpServer: HttpServer;
  private universe: DMXUniverse;
  private driver: DMXDriver;
  private presetManager: PresetManager;
  private fixtureManager: FixtureManager;
  private fadeEngine: FadeEngine;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingUpdate: boolean = false;
  private presetActivatedListeners: Array<(data: { id: string; name: string }) => void> = [];
  private presetListChangedListeners: Array<() => void> = [];

  constructor(options: SocketUIOptions) {
    this.universe = options.universe;
    this.driver = options.driver;
    this.presetManager = options.presetManager;
    this.fixtureManager = options.fixtureManager;
    this.fadeEngine = options.fadeEngine;

    // Create HTTP server with optional static file serving
    const rendererPath = path.join(__dirname, '..', 'renderer');

    const requestHandler = (req: IncomingMessage, res: ServerResponse) => {
      if (options.isDev) {
        // In dev mode, Vite serves the files — this server only handles Socket.io
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('DMX Controller API Server');
        return;
      }

      // In production, serve the built renderer files
      let filePath = path.join(rendererPath, req.url === '/' ? 'index.html' : req.url || 'index.html');

      const extMap: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };

      const ext = path.extname(filePath);
      const contentType = extMap[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // Fallback to index.html for SPA routing
          fs.readFile(path.join(rendererPath, 'index.html'), (err2, indexData) => {
            if (err2) {
              res.writeHead(404);
              res.end('Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(indexData);
            }
          });
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        }
      });
    };

    this.httpServer = createServer(requestHandler);

    this.io = new Server(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.setupUniverseListener();
    this.setupDriverStatusListener();
    this.setupSocketHandlers();
  }

  /**
   * Start the Socket.io server.
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(UI_PORT, () => {
        log.info(`SocketUIServer: Listening on port ${UI_PORT}`);
        resolve();
      });
    });
  }

  /**
   * Listen for universe changes and throttle updates to clients.
   */
  private setupUniverseListener(): void {
    this.universe.onChange(() => {
      this.pendingUpdate = true;

      if (!this.throttleTimer) {
        this.throttleTimer = setTimeout(() => {
          if (this.pendingUpdate) {
            this.emitDMXState();
            this.pendingUpdate = false;
          }
          this.throttleTimer = null;
        }, UI_THROTTLE_MS);
      }
    });
  }

  /**
   * Listen for DMX driver status changes.
   */
  private setupDriverStatusListener(): void {
    this.driver.onStatusChange((connected, port) => {
      this.io.emit('dmx:status', { connected, port });
    });
  }

  /**
   * Emit current DMX state to all clients.
   */
  private emitDMXState(): void {
    this.io.emit('dmx:state', {
      channels: this.universe.getRawChannelsArray(),
      master: this.universe.getMasterDimmer(),
    });
  }

  /**
   * Set up Socket.io event handlers for incoming client messages.
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      log.info(`SocketUIServer: Client connected (${socket.id})`);

      // Send initial state
      socket.emit('dmx:state', {
        channels: this.universe.getRawChannelsArray(),
        master: this.universe.getMasterDimmer(),
      });

      socket.emit('dmx:status', this.driver.getStatus());
      socket.emit('presets:list', this.presetManager.getAll());
      socket.emit('fixtures:list', this.fixtureManager.getAll());
      socket.emit('fixtures:profiles', this.fixtureManager.getBundledProfiles());

      // Send any channel conflicts
      const conflicts = this.fixtureManager.validateChannelConflicts();
      if (conflicts.length > 0) {
        socket.emit('fixtures:conflicts', conflicts);
      }

      // --- DMX Channel Controls ---

      socket.on('dmx:set-channel', (data: { channel: number; value: number }) => {
        try {
          this.universe.setChannel(data.channel, data.value);
        } catch (err) {
          log.error('SocketUIServer: Error setting channel:', err);
        }
      });

      socket.on('dmx:set-channels', (data: { values: Record<number, number> }) => {
        try {
          this.universe.setChannels(data.values);
        } catch (err) {
          log.error('SocketUIServer: Error setting channels:', err);
        }
      });

      socket.on('dmx:master', (data: { value: number }) => {
        try {
          this.universe.setMasterDimmer(data.value);
        } catch (err) {
          log.error('SocketUIServer: Error setting master:', err);
        }
      });

      socket.on('dmx:blackout', async (data: { fadeTime?: number }) => {
        try {
          const fadeTime = data?.fadeTime ?? 0;
          if (fadeTime > 0) {
            await this.fadeEngine.fadeToBlackout(fadeTime);
          } else {
            this.universe.blackout();
          }
        } catch (err) {
          log.error('SocketUIServer: Error during blackout:', err);
        }
      });

      // --- Preset Controls ---

      socket.on('preset:recall', async (data: { id: string; fadeTime?: number }) => {
        try {
          const preset = this.presetManager.getById(data.id);
          if (!preset) {
            log.warn(`SocketUIServer: Preset not found: ${data.id}`);
            return;
          }

          const fadeTime = data.fadeTime ?? preset.fadeTime;
          log.info(`SocketUIServer: Recalling preset "${preset.name}" (fade: ${fadeTime}ms)`);

          if (fadeTime > 0) {
            await this.fadeEngine.fadeTo(preset.channels, fadeTime);
          } else {
            this.universe.applySnapshot(preset.channels);
          }

          if (preset.fixtureModes && Object.keys(preset.fixtureModes).length > 0) {
            for (const [fixtureId, modeName] of Object.entries(preset.fixtureModes)) {
              try {
                const results = this.fixtureManager.setActiveMode(fixtureId, modeName);
                for (const r of results) {
                  this.universe.setChannel(r.channel, r.value);
                }
              } catch (err) {
                log.warn(`SocketUIServer: Failed to restore mode for fixture ${fixtureId}:`, err);
              }
            }
            this.io.emit('fixtures:list', this.fixtureManager.getAll());
          }

          // Notify all clients about the activated preset
          const activationData = { id: preset.id, name: preset.name };
          this.io.emit('preset:activated', activationData);

          // Notify external listeners (e.g. CompanionServer)
          for (const listener of this.presetActivatedListeners) {
            listener(activationData);
          }
        } catch (err) {
          log.error('SocketUIServer: Error recalling preset:', err);
        }
      });

      socket.on('preset:save', (data: { name: string; fadeTime: number; color: string }) => {
        try {
          const fixtureModes: Record<string, string> = {};
          for (const fixture of this.fixtureManager.getAll()) {
            if (fixture.activeMode) {
              fixtureModes[fixture.id] = fixture.activeMode;
            }
          }

          const modesPayload = Object.keys(fixtureModes).length > 0 ? fixtureModes : undefined;
          const preset = this.presetManager.captureFromUniverse(
            data.name,
            this.universe,
            data.fadeTime,
            data.color,
            modesPayload
          );
          this.io.emit('presets:list', this.presetManager.getAll());
          this.notifyPresetListChanged();
          log.info(`SocketUIServer: Saved preset "${preset.name}"`);
        } catch (err) {
          log.error('SocketUIServer: Error saving preset:', err);
        }
      });

      socket.on('preset:update', (data: { id: string; patch: Record<string, unknown> }) => {
        try {
          this.presetManager.update(data.id, data.patch);
          this.io.emit('presets:list', this.presetManager.getAll());
          this.notifyPresetListChanged();
        } catch (err) {
          log.error('SocketUIServer: Error updating preset:', err);
        }
      });

      socket.on('preset:delete', (data: { id: string }) => {
        try {
          this.presetManager.delete(data.id);
          this.io.emit('presets:list', this.presetManager.getAll());
          this.notifyPresetListChanged();
        } catch (err) {
          log.error('SocketUIServer: Error deleting preset:', err);
        }
      });

      // --- Fixture Controls ---

      socket.on('fixture:create', (data: { name: string; type: string; channels: { name: string; dmxChannel: number }[]; colorMode?: 'rgb' | 'hsb' }) => {
        try {
          this.fixtureManager.create(data.name, data.type, data.channels, data.colorMode || 'rgb');
          this.io.emit('fixtures:list', this.fixtureManager.getAll());
          const conflicts = this.fixtureManager.validateChannelConflicts();
          if (conflicts.length > 0) {
            this.io.emit('fixtures:conflicts', conflicts);
          }
        } catch (err) {
          log.error('SocketUIServer: Error creating fixture:', err);
        }
      });

      socket.on('fixture:update', (data: { id: string; patch: Record<string, unknown> }) => {
        try {
          this.fixtureManager.update(data.id, data.patch);
          this.io.emit('fixtures:list', this.fixtureManager.getAll());
          const conflicts = this.fixtureManager.validateChannelConflicts();
          if (conflicts.length > 0) {
            this.io.emit('fixtures:conflicts', conflicts);
          }
        } catch (err) {
          log.error('SocketUIServer: Error updating fixture:', err);
        }
      });

      socket.on('fixture:delete', (data: { id: string }) => {
        try {
          this.fixtureManager.delete(data.id);
          this.io.emit('fixtures:list', this.fixtureManager.getAll());
        } catch (err) {
          log.error('SocketUIServer: Error deleting fixture:', err);
        }
      });

      // --- Profile-Based Fixture Controls ---

      socket.on('fixture:create-from-profile', (data: { name: string; profileId: string; startAddress: number }) => {
        try {
          const fixture = this.fixtureManager.createFromProfile(data.name, data.profileId, data.startAddress);
          this.io.emit('fixtures:list', this.fixtureManager.getAll());
          const conflicts = this.fixtureManager.validateChannelConflicts();
          if (conflicts.length > 0) {
            this.io.emit('fixtures:conflicts', conflicts);
          }
          // Set initial mode DMX values
          if (fixture.activeMode && fixture.profile?.modeChannel) {
            const results = this.fixtureManager.setActiveMode(fixture.id, fixture.activeMode);
            for (const r of results) {
              this.universe.setChannel(r.channel, r.value);
            }
          }
        } catch (err) {
          log.error('SocketUIServer: Error creating profile fixture:', err);
        }
      });

      socket.on('fixture:set-mode', (data: { fixtureId: string; modeName: string }) => {
        try {
          const results = this.fixtureManager.setActiveMode(data.fixtureId, data.modeName);
          for (const r of results) {
            this.universe.setChannel(r.channel, r.value);
          }

          // Zero out dynamic channels that are unused in the new mode
          const fixture = this.fixtureManager.getById(data.fixtureId);
          if (fixture?.profile && fixture.startAddress) {
            const mode = fixture.profile.modes.find((m) => m.name === data.modeName);
            const channelKeys = Object.keys(fixture.profile.channels).sort();

            // Channels consumed by colorWheelGroup should be preserved, not zeroed
            const cwgKeys = new Set<string>();
            if (mode?.colorWheelGroup) {
              cwgKeys.add(mode.colorWheelGroup.hueChannel);
              cwgKeys.add(mode.colorWheelGroup.saturationChannel);
              if (mode.colorWheelGroup.brightnessChannel) {
                cwgKeys.add(mode.colorWheelGroup.brightnessChannel);
              }
            }

            for (let i = 0; i < channelKeys.length; i++) {
              const key = channelKeys[i];
              const chDef = fixture.profile.channels[key];
              if (chDef.role === 'dynamic') {
                const dmxAddr = fixture.startAddress + i;
                if (!mode?.controls[key]) {
                  // No control for this channel in this mode — zero it
                  // (but skip channels with defaults or colorWheelGroup — those are retained)
                  const hasDefault = mode?.defaults && key in mode.defaults;
                  const inColorWheel = cwgKeys.has(key);
                  if (!hasDefault && !inColorWheel) {
                    this.universe.setChannel(dmxAddr, 0);
                  }
                }
              }
            }
          }
          this.io.emit('fixtures:list', this.fixtureManager.getAll());
        } catch (err) {
          log.error('SocketUIServer: Error setting fixture mode:', err);
        }
      });

      socket.on('fixture:trigger-start', (data: { channel: number }) => {
        try {
          this.universe.setChannel(data.channel, 255);
        } catch (err) {
          log.error('SocketUIServer: Error on trigger start:', err);
        }
      });

      socket.on('fixture:trigger-end', (data: { channel: number }) => {
        try {
          this.universe.setChannel(data.channel, 0);
        } catch (err) {
          log.error('SocketUIServer: Error on trigger end:', err);
        }
      });

      socket.on('fixture:get-profiles', () => {
        try {
          socket.emit('fixtures:profiles', this.fixtureManager.getBundledProfiles());
        } catch (err) {
          log.error('SocketUIServer: Error getting profiles:', err);
        }
      });

      socket.on('fixture:export', () => {
        try {
          const config = this.fixtureManager.exportConfig();
          socket.emit('fixture:export-result', config);
        } catch (err) {
          log.error('SocketUIServer: Error exporting fixtures:', err);
        }
      });

      socket.on('fixture:import', (data: { config: { version: 1; exportedAt: string; fixtures: unknown[] }; strategy: 'merge' | 'replace' }) => {
        try {
          const result = this.fixtureManager.importConfig(data.config as any, data.strategy);
          this.io.emit('fixtures:list', this.fixtureManager.getAll());
          socket.emit('fixture:import-result', result);

          const conflicts = this.fixtureManager.validateChannelConflicts();
          if (conflicts.length > 0) {
            this.io.emit('fixtures:conflicts', conflicts);
          }
        } catch (err) {
          log.error('SocketUIServer: Error importing fixtures:', err);
        }
      });

      socket.on('disconnect', () => {
        log.info(`SocketUIServer: Client disconnected (${socket.id})`);
      });
    });
  }

  /**
   * Get the Socket.io server instance (for Companion to emit events).
   */
  getIO(): Server {
    return this.io;
  }

  /**
   * Register a listener for preset activation events.
   * Used to bridge UI preset recalls to external systems (e.g. CompanionServer).
   */
  onPresetActivated(listener: (data: { id: string; name: string }) => void): void {
    this.presetActivatedListeners.push(listener);
  }

  /**
   * Broadcast a preset activation to all connected UI clients.
   * This is used when a preset is triggered externally (e.g. by Companion).
   */
  broadcastPresetActivated(data: { id: string; name: string }): void {
    this.io.emit('preset:activated', data);
  }

  /**
   * Register a listener for preset list changes (create, update, delete).
   * Used to push updated preset lists to external systems.
   */
  onPresetListChanged(listener: () => void): void {
    this.presetListChangedListeners.push(listener);
  }

  /**
   * Notify external listeners that the preset list has changed.
   */
  private notifyPresetListChanged(): void {
    for (const listener of this.presetListChangedListeners) {
      listener();
    }
  }

  /**
   * Graceful shutdown.
   */
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
      }
      this.io.close(() => {
        this.httpServer.close(() => {
          log.info('SocketUIServer: Shutdown complete');
          resolve();
        });
      });
    });
  }
}
