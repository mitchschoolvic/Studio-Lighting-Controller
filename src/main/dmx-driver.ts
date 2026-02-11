import { SerialPort } from 'serialport';
import { DMXUniverse } from './dmx-universe';
import { log } from './logger';

// Enttec DMX USB Pro constants
const ENTTEC_VENDOR_ID = '0403';
const ENTTEC_PRODUCT_ID = '6001';
const DMX_PRO_START_MSG = 0x7e;
const DMX_PRO_END_MSG = 0xe7;
const DMX_PRO_SEND_LABEL = 6;
const DMX_REFRESH_INTERVAL = 25; // 40 Hz

interface DMXDriverOptions {
  universe: DMXUniverse;
}

/**
 * DMXDriver — Manages serial communication with the Enttec DMX USB Pro adapter.
 * Handles auto-detection, 40 Hz refresh loop, and reconnection with exponential backoff.
 */
export class DMXDriver {
  private universe: DMXUniverse;
  private serialPort: SerialPort | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay: number = 1000;
  private readonly maxReconnectDelay: number = 30000;
  private isConnected: boolean = false;
  private portPath: string | null = null;
  private statusListeners: Set<(connected: boolean, port: string | null) => void> = new Set();
  private isShuttingDown: boolean = false;

  constructor(options: DMXDriverOptions) {
    this.universe = options.universe;
  }

  /**
   * Auto-detect and connect to the Enttec DMX USB Pro adapter.
   */
  async initialize(): Promise<void> {
    log.info('DMXDriver: Scanning for Enttec DMX USB Pro...');
    const detected = await this.detectDevice();

    if (detected) {
      await this.connect(detected);
    } else {
      log.warn('DMXDriver: No Enttec DMX USB Pro found. Running in disconnected mode.');
      this.emitStatus();
    }

    // Start the 40 Hz refresh loop regardless of connection status
    this.startRefreshLoop();
  }

  /**
   * Scan serial ports for the Enttec DMX USB Pro.
   */
  private async detectDevice(): Promise<string | null> {
    try {
      const ports = await SerialPort.list();
      log.debug(`DMXDriver: Found ${ports.length} serial ports`);

      const matches = ports.filter(
        (p) =>
          p.vendorId?.toLowerCase() === ENTTEC_VENDOR_ID &&
          p.productId?.toLowerCase() === ENTTEC_PRODUCT_ID
      );

      if (matches.length === 0) {
        // Also try path-based detection for macOS
        const pathMatches = ports.filter((p) =>
          p.path.includes('usbserial')
        );
        if (pathMatches.length > 0) {
          log.info(`DMXDriver: Found USB serial device at ${pathMatches[0].path} (path-based detection)`);
          if (pathMatches.length > 1) {
            log.warn(`DMXDriver: Multiple USB serial devices found. Using first: ${pathMatches[0].path}`);
          }
          return pathMatches[0].path;
        }
        return null;
      }

      if (matches.length > 1) {
        log.warn(`DMXDriver: Multiple Enttec devices found. Using first: ${matches[0].path}`);
      }

      log.info(`DMXDriver: Detected Enttec DMX USB Pro at ${matches[0].path}`);
      return matches[0].path;
    } catch (err) {
      log.error('DMXDriver: Error scanning serial ports:', err);
      return null;
    }
  }

  /**
   * Connect to the specified serial port.
   */
  private async connect(portPath: string): Promise<void> {
    return new Promise<void>((resolve) => {
      try {
        this.serialPort = new SerialPort({
          path: portPath,
          baudRate: 250000,
          dataBits: 8,
          stopBits: 2,
          parity: 'none',
          autoOpen: false,
        });

        this.serialPort.on('open', () => {
          log.info(`DMXDriver: Connected to ${portPath}`);
          this.isConnected = true;
          this.portPath = portPath;
          this.reconnectDelay = 1000; // Reset backoff
          this.emitStatus();
          resolve();
        });

        this.serialPort.on('error', (err) => {
          log.error(`DMXDriver: Serial port error: ${err.message}`);
        });

        this.serialPort.on('close', () => {
          if (!this.isShuttingDown) {
            log.warn('DMXDriver: Serial port closed. Starting reconnection...');
            this.isConnected = false;
            this.portPath = null;
            this.serialPort = null;
            this.emitStatus();
            this.startReconnection();
          }
        });

        this.serialPort.open((err) => {
          if (err) {
            log.error(`DMXDriver: Failed to open ${portPath}: ${err.message}`);
            this.serialPort = null;
            this.startReconnection();
            resolve();
          }
        });
      } catch (err) {
        log.error('DMXDriver: Connection error:', err);
        this.startReconnection();
        resolve();
      }
    });
  }

  /**
   * Build the DMX packet for the Enttec DMX USB Pro.
   */
  private buildDMXPacket(channels: Uint8Array): Buffer {
    const dataLength = channels.length + 1; // +1 for DMX start code (0x00)
    const packet = Buffer.alloc(dataLength + 5);

    packet[0] = DMX_PRO_START_MSG;
    packet[1] = DMX_PRO_SEND_LABEL;
    packet[2] = dataLength & 0xff;        // Length LSB
    packet[3] = (dataLength >> 8) & 0xff;  // Length MSB
    packet[4] = 0x00;                      // DMX start code

    // Copy channel data
    for (let i = 0; i < channels.length; i++) {
      packet[5 + i] = channels[i];
    }

    packet[packet.length - 1] = DMX_PRO_END_MSG;

    return packet;
  }

  /**
   * Start the 40 Hz DMX refresh loop.
   */
  private startRefreshLoop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      if (this.isConnected && this.serialPort && this.serialPort.isOpen) {
        try {
          const state = this.universe.getState();
          const packet = this.buildDMXPacket(state);
          this.serialPort.write(packet, (err) => {
            if (err) {
              log.error(`DMXDriver: Write error: ${err.message}`);
            }
          });
        } catch (err) {
          log.error('DMXDriver: Error in refresh loop:', err);
        }
      }
    }, DMX_REFRESH_INTERVAL);

    log.info(`DMXDriver: Refresh loop started at ${1000 / DMX_REFRESH_INTERVAL} Hz`);
  }

  /**
   * Start exponential backoff reconnection.
   */
  private startReconnection(): void {
    if (this.isShuttingDown) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    log.info(`DMXDriver: Reconnection attempt in ${this.reconnectDelay}ms...`);

    this.reconnectTimer = setTimeout(async () => {
      const detected = await this.detectDevice();
      if (detected) {
        await this.connect(detected);
      } else {
        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.startReconnection();
      }
    }, this.reconnectDelay);
  }

  /**
   * Register a status change listener.
   */
  onStatusChange(callback: (connected: boolean, port: string | null) => void): void {
    this.statusListeners.add(callback);
  }

  /**
   * Remove a status change listener.
   */
  offStatusChange(callback: (connected: boolean, port: string | null) => void): void {
    this.statusListeners.delete(callback);
  }

  /**
   * Emit current status to all listeners.
   */
  private emitStatus(): void {
    for (const listener of this.statusListeners) {
      try {
        listener(this.isConnected, this.portPath);
      } catch (err) {
        log.error('DMXDriver: Status listener error:', err);
      }
    }
  }

  /**
   * Get current connection status.
   */
  getStatus(): { connected: boolean; port: string | null } {
    return {
      connected: this.isConnected,
      port: this.portPath,
    };
  }

  /**
   * Restart the DMX driver — tear down and re-initialize.
   */
  async restart(): Promise<void> {
    log.info('DMXDriver: Restarting...');
    await this.closePort();
    this.reconnectDelay = 1000;
    const detected = await this.detectDevice();
    if (detected) {
      await this.connect(detected);
    } else {
      log.warn('DMXDriver: No device found after restart.');
      this.emitStatus();
    }
  }

  /**
   * Close the serial port.
   */
  private async closePort(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.serialPort && this.serialPort.isOpen) {
        this.serialPort.close((err) => {
          if (err) {
            log.error(`DMXDriver: Error closing port: ${err.message}`);
          }
          this.serialPort = null;
          this.isConnected = false;
          this.portPath = null;
          resolve();
        });
      } else {
        this.serialPort = null;
        this.isConnected = false;
        this.portPath = null;
        resolve();
      }
    });
  }

  /**
   * Graceful shutdown — stop everything.
   */
  async shutdown(): Promise<void> {
    log.info('DMXDriver: Shutting down...');
    this.isShuttingDown = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    await this.closePort();
    log.info('DMXDriver: Shutdown complete');
  }
}
