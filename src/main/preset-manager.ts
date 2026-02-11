import type Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import { DMXUniverse } from './dmx-universe';
import { log } from './logger';

type AppStore = Store<Record<string, unknown>>;

interface Preset {
  id: string;
  name: string;
  channels: number[];
  fadeTime: number;
  color: string;
  fixtureModes?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/**
 * PresetManager — CRUD operations for lighting presets, backed by electron-store.
 */
export class PresetManager {
  private store: AppStore;

  constructor(store: AppStore) {
    this.store = store;

    // Ensure presets array exists
    if (!(this.store as any).has('presets')) {
      (this.store as any).set('presets', []);
    }
  }

  /**
   * Get all presets.
   */
  getAll(): Preset[] {
    return ((this.store as any).get('presets') as Preset[]) || [];
  }

  /**
   * Get a preset by ID.
   */
  getById(id: string): Preset | undefined {
    return this.getAll().find((p) => p.id === id);
  }

  /**
   * Create a new preset.
   */
  create(
    name: string,
    channels: number[],
    fadeTime: number,
    color: string,
    fixtureModes?: Record<string, string>
  ): Preset {
    const preset: Preset = {
      id: uuidv4(),
      name,
      channels: channels.slice(0, 512),
      fadeTime,
      color,
      fixtureModes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Pad to 512 channels if needed
    while (preset.channels.length < 512) {
      preset.channels.push(0);
    }

    const presets = this.getAll();
    presets.push(preset);
    (this.store as any).set('presets', presets);

    log.info(`PresetManager: Created preset "${name}" (${preset.id})`);
    return preset;
  }

  /**
   * Update an existing preset.
   */
  update(id: string, patch: Partial<Omit<Preset, 'id' | 'createdAt'>>): Preset {
    const presets = this.getAll();
    const index = presets.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error(`Preset not found: ${id}`);
    }

    const updated: Preset = {
      ...presets[index],
      ...patch,
      id: presets[index].id,
      createdAt: presets[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    presets[index] = updated;
    (this.store as any).set('presets', presets);

    log.info(`PresetManager: Updated preset "${updated.name}" (${id})`);
    return updated;
  }

  /**
   * Delete a preset by ID.
   */
  delete(id: string): boolean {
    const presets = this.getAll();
    const index = presets.findIndex((p) => p.id === id);

    if (index === -1) {
      log.warn(`PresetManager: Preset not found for deletion: ${id}`);
      return false;
    }

    const removed = presets.splice(index, 1)[0];
    (this.store as any).set('presets', presets);

    log.info(`PresetManager: Deleted preset "${removed.name}" (${id})`);
    return true;
  }

  /**
   * Capture current universe state as a new preset.
   */
  captureFromUniverse(
    name: string,
    universe: DMXUniverse,
    fadeTime: number,
    color: string,
    fixtureModes?: Record<string, string>
  ): Preset {
    const channels = universe.getRawChannelsArray();
    return this.create(name, channels, fadeTime, color, fixtureModes);
  }
}
