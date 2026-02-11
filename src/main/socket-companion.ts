import { WebSocketServer, WebSocket } from 'ws';
import { DMXUniverse } from './dmx-universe';
import { DMXDriver } from './dmx-driver';
import { PresetManager } from './preset-manager';
import { FixtureManager } from './fixture-manager';
import { FadeEngine } from './fade-engine';
import { log } from './logger';

const COMPANION_PORT = 9091;

interface CompanionCommand {
  action: string;
  id?: string;
  fixtureId?: string;
  modeName?: string;
  fadeTime?: number;
  channel?: number;
  value?: number;
  state?: 'on' | 'off';
}

interface CompanionServerOptions {
  universe: DMXUniverse;
  driver: DMXDriver;
  presetManager: PresetManager;
  fixtureManager: FixtureManager;
  fadeEngine: FadeEngine;
}

/**
 * CompanionServer — Raw WebSocket server for Bitfocus Companion integration.
 * Receives JSON commands and sends JSON responses/events.
 */
export class CompanionServer {
  private wss: WebSocketServer;
  private universe: DMXUniverse;
  private driver: DMXDriver;
  private presetManager: PresetManager;
  private fixtureManager: FixtureManager;
  private fadeEngine: FadeEngine;
  private clients: Set<WebSocket> = new Set();
  private presetRecalledListeners: Array<(data: { id: string; name: string }) => void> = [];

  constructor(options: CompanionServerOptions) {
    this.universe = options.universe;
    this.driver = options.driver;
    this.presetManager = options.presetManager;
    this.fixtureManager = options.fixtureManager;
    this.fadeEngine = options.fadeEngine;

    this.wss = new WebSocketServer({ port: COMPANION_PORT });

    this.setupHandlers();
    this.setupDriverStatusListener();

    log.info(`CompanionServer: Listening on port ${COMPANION_PORT}`);
  }

  /**
   * Set up WebSocket connection handlers.
   */
  private setupHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      log.info('CompanionServer: Client connected');
      this.clients.add(ws);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as CompanionCommand;
          await this.handleCommand(ws, message);
        } catch (err) {
          log.error('CompanionServer: Error parsing message:', err);
          this.sendResponse(ws, {
            status: 'error',
            action: 'unknown',
            message: 'Invalid JSON message',
          });
        }
      });

      ws.on('close', () => {
        log.info('CompanionServer: Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        log.error('CompanionServer: WebSocket error:', err);
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (err) => {
      log.error('CompanionServer: Server error:', err);
    });
  }

  /**
   * Listen for DMX driver status changes and broadcast to Companion clients.
   */
  private setupDriverStatusListener(): void {
    this.driver.onStatusChange((connected) => {
      this.broadcast({
        event: 'dmx_status',
        data: { connected },
      });
    });
  }

  /**
   * Handle an inbound command from Companion.
   */
  private async handleCommand(ws: WebSocket, command: CompanionCommand): Promise<void> {
    log.info(`CompanionServer: Received command: ${command.action}`);

    switch (command.action) {
      case 'recall_preset':
        await this.handleRecallPreset(ws, command);
        break;

      case 'blackout':
        await this.handleBlackout(ws, command);
        break;

      case 'set_channel':
        this.handleSetChannel(ws, command);
        break;

      case 'get_state':
        this.handleGetState(ws);
        break;

      case 'list_presets':
        this.handleListPresets(ws);
        break;

      case 'master_dimmer':
        this.handleMasterDimmer(ws, command);
        break;

      case 'set_mode':
        this.handleSetMode(ws, command);
        break;

      case 'trigger':
        this.handleTrigger(ws, command);
        break;

      default:
        this.sendResponse(ws, {
          status: 'error',
          action: command.action,
          message: `Unknown action: ${command.action}`,
        });
    }
  }

  /**
   * Handle preset recall command.
   */
  private async handleRecallPreset(ws: WebSocket, command: CompanionCommand): Promise<void> {
    if (!command.id) {
      this.sendResponse(ws, {
        status: 'error',
        action: 'recall_preset',
        message: 'Missing preset id',
      });
      return;
    }

    const preset = this.presetManager.getById(command.id);
    if (!preset) {
      this.sendResponse(ws, {
        status: 'error',
        action: 'recall_preset',
        message: 'Preset not found',
      });
      return;
    }

    const fadeTime = command.fadeTime ?? preset.fadeTime;

    if (fadeTime > 0) {
      await this.fadeEngine.fadeTo(preset.channels, fadeTime);
    } else {
      this.universe.applySnapshot(preset.channels);
    }

    this.sendResponse(ws, {
      status: 'ok',
      action: 'recall_preset',
      data: { presetId: preset.id, fadeTime },
    });

    // Broadcast preset activation to all Companion clients
    this.broadcast({
      event: 'preset_activated',
      data: { id: preset.id, name: preset.name },
    });

    // Notify internal listeners (e.g. SocketUIServer via main process)
    this.notifyPresetRecalled({ id: preset.id, name: preset.name });
  }

  /**
   * Handle blackout command.
   */
  private async handleBlackout(ws: WebSocket, command: CompanionCommand): Promise<void> {
    const fadeTime = command.fadeTime ?? 0;

    if (fadeTime > 0) {
      await this.fadeEngine.fadeToBlackout(fadeTime);
    } else {
      this.universe.blackout();
    }

    this.sendResponse(ws, {
      status: 'ok',
      action: 'blackout',
      data: { fadeTime },
    });
  }

  /**
   * Handle set channel command.
   */
  private handleSetChannel(ws: WebSocket, command: CompanionCommand): void {
    if (command.channel === undefined || command.value === undefined) {
      this.sendResponse(ws, {
        status: 'error',
        action: 'set_channel',
        message: 'Missing channel or value',
      });
      return;
    }

    this.universe.setChannel(command.channel, command.value);

    this.sendResponse(ws, {
      status: 'ok',
      action: 'set_channel',
      data: { channel: command.channel, value: command.value },
    });
  }

  /**
   * Handle get state command.
   */
  private handleGetState(ws: WebSocket): void {
    this.sendResponse(ws, {
      status: 'ok',
      action: 'get_state',
      data: {
        channels: this.universe.getRawChannelsArray(),
        master: this.universe.getMasterDimmer(),
      },
    });
  }

  /**
   * Handle list presets command.
   */
  private handleListPresets(ws: WebSocket): void {
    const presets = this.presetManager.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      fadeTime: p.fadeTime,
      color: p.color,
    }));

    this.sendResponse(ws, {
      status: 'ok',
      action: 'list_presets',
      data: presets,
    });
  }

  /**
   * Handle master dimmer command.
   */
  private handleMasterDimmer(ws: WebSocket, command: CompanionCommand): void {
    if (command.value === undefined) {
      this.sendResponse(ws, {
        status: 'error',
        action: 'master_dimmer',
        message: 'Missing value',
      });
      return;
    }

    this.universe.setMasterDimmer(command.value);

    this.sendResponse(ws, {
      status: 'ok',
      action: 'master_dimmer',
      data: { value: command.value },
    });
  }

  /**
   * Handle set mode command — switch fixture mode.
   */
  private handleSetMode(ws: WebSocket, command: CompanionCommand): void {
    if (!command.fixtureId || !command.modeName) {
      this.sendResponse(ws, {
        status: 'error',
        action: 'set_mode',
        message: 'Missing fixtureId or modeName',
      });
      return;
    }

    try {
      const results = this.fixtureManager.setActiveMode(command.fixtureId, command.modeName);
      for (const r of results) {
        this.universe.setChannel(r.channel, r.value);
      }

      this.sendResponse(ws, {
        status: 'ok',
        action: 'set_mode',
        data: { fixtureId: command.fixtureId, modeName: command.modeName, channels: results },
      });
    } catch (err: any) {
      this.sendResponse(ws, {
        status: 'error',
        action: 'set_mode',
        message: err.message || 'Failed to set mode',
      });
    }
  }

  /**
   * Handle trigger command — momentary trigger on/off.
   */
  private handleTrigger(ws: WebSocket, command: CompanionCommand): void {
    if (command.channel === undefined || !command.state) {
      this.sendResponse(ws, {
        status: 'error',
        action: 'trigger',
        message: 'Missing channel or state (on/off)',
      });
      return;
    }

    const value = command.state === 'on' ? 255 : 0;
    this.universe.setChannel(command.channel, value);

    this.sendResponse(ws, {
      status: 'ok',
      action: 'trigger',
      data: { channel: command.channel, state: command.state, value },
    });
  }

  /**
   * Send a response to a specific client.
   */
  private sendResponse(ws: WebSocket, response: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(response));
    }
  }

  /**
   * Broadcast an event to all connected Companion clients.
   */
  broadcast(event: Record<string, unknown>): void {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Register a listener for preset recall events.
   * Used to notify external systems (like the UI) when Companion triggers a preset.
   */
  onPresetRecalled(listener: (data: { id: string; name: string }) => void): void {
    this.presetRecalledListeners.push(listener);
  }

  /**
   * Notify listeners that a preset was recalled.
   */
  private notifyPresetRecalled(data: { id: string; name: string }): void {
    for (const listener of this.presetRecalledListeners) {
      listener(data);
    }
  }

  /**
   * Graceful shutdown.
   */
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      for (const client of this.clients) {
        client.close();
      }
      this.wss.close(() => {
        log.info('CompanionServer: Shutdown complete');
        resolve();
      });
    });
  }
}
