import { log } from './logger';

/**
 * DMXUniverse — Single source of truth for the 512-channel DMX buffer.
 * All channel mutations flow through this class.
 */
export class DMXUniverse {
  private channels: Uint8Array;
  private masterDimmer: number;
  private listeners: Set<(channels: Uint8Array) => void>;

  constructor() {
    this.channels = new Uint8Array(512);
    this.masterDimmer = 255;
    this.listeners = new Set();
    log.info('DMXUniverse initialized (512 channels, master=255)');
  }

  /**
   * Set a single channel (1-indexed, DMX convention).
   */
  setChannel(channel: number, value: number): void {
    if (channel < 1 || channel > 512) {
      log.warn(`DMXUniverse: Invalid channel number ${channel}`);
      return;
    }
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    this.channels[channel - 1] = clamped;
    this.notifyListeners();
  }

  /**
   * Set multiple channels at once.
   */
  setChannels(values: Record<number, number>): void {
    for (const [channel, value] of Object.entries(values)) {
      const ch = Number(channel);
      if (ch >= 1 && ch <= 512) {
        this.channels[ch - 1] = Math.max(0, Math.min(255, Math.round(value)));
      }
    }
    this.notifyListeners();
  }

  /**
   * Get a snapshot of all 512 channels (with master dimmer applied).
   */
  getState(): Uint8Array {
    const output = new Uint8Array(512);
    const masterScale = this.masterDimmer / 255;
    for (let i = 0; i < 512; i++) {
      output[i] = Math.round(this.channels[i] * masterScale);
    }
    return output;
  }

  /**
   * Get raw state without master dimmer applied.
   */
  getRawState(): Uint8Array {
    return new Uint8Array(this.channels);
  }

  /**
   * Get the current master dimmer value.
   */
  getMasterDimmer(): number {
    return this.masterDimmer;
  }

  /**
   * Set master dimmer (0–255).
   */
  setMasterDimmer(value: number): void {
    this.masterDimmer = Math.max(0, Math.min(255, Math.round(value)));
    log.debug(`Master dimmer set to ${this.masterDimmer}`);
    this.notifyListeners();
  }

  /**
   * Register a change listener (used by Socket.io to push updates).
   */
  onChange(callback: (channels: Uint8Array) => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remove a change listener.
   */
  offChange(callback: (channels: Uint8Array) => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Apply a full 512-channel snapshot (used by preset recall).
   */
  applySnapshot(snapshot: number[]): void {
    for (let i = 0; i < 512; i++) {
      this.channels[i] = Math.max(0, Math.min(255, Math.round(snapshot[i] || 0)));
    }
    this.notifyListeners();
  }

  /**
   * Zero all channels.
   */
  blackout(): void {
    this.channels.fill(0);
    this.notifyListeners();
    log.info('DMXUniverse: Blackout applied');
  }

  /**
   * Get raw channel array as a plain number array.
   */
  getRawChannelsArray(): number[] {
    return Array.from(this.channels);
  }

  /**
   * Get state as a plain number array.
   */
  getStateArray(): number[] {
    return Array.from(this.getState());
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        log.error('DMXUniverse listener error:', err);
      }
    }
  }
}
