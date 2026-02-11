import type Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import * as fs from 'fs';
import { log } from './logger';

type AppStore = Store<Record<string, unknown>>;

interface FixtureChannel {
  name: string;
  dmxChannel: number;
}

type ColorMode = 'rgb' | 'hsb';

type ProfileControlType = 'fader' | 'momentary' | 'toggle' | 'stepped';

interface ProfileControl {
  label: string;
  type: ProfileControlType;
  icon?: string;
  steps?: { label: string; dmxValue: number }[];
  extraButtons?: { label: string; dmxValue: number; icon?: string }[];
}

interface ProfileChannelDef {
  role: string;
  label: string;
}

interface ProfileMode {
  name: string;
  channelValue: number;
  icon?: string;
  controls: Record<string, ProfileControl | null>;
  colorWheelGroup?: {
    hueChannel: string;
    saturationChannel: string;
    brightnessChannel?: string;
  };
  defaults?: Record<string, number>;
}

interface FixtureProfile {
  fixture: string;
  channelCount: number;
  modeChannel?: string;
  channels: Record<string, ProfileChannelDef>;
  modes: ProfileMode[];
}

interface CanvasLayout {
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}

interface Fixture {
  id: string;
  name: string;
  type: string;
  colorMode: ColorMode;
  channels: FixtureChannel[];
  createdAt: string;
  updatedAt: string;
  profile?: FixtureProfile;
  startAddress?: number;
  activeMode?: string;
  onCanvas?: boolean;
  canvasLayout?: CanvasLayout;
}

interface FixtureConfig {
  version: 1;
  exportedAt: string;
  fixtures: Fixture[];
}

/**
 * FixtureManager — CRUD operations for fixture profiles, backed by electron-store.
 * Provides a named abstraction layer over raw DMX channels.
 * Read-only mapping layer — all mutations still flow through DMXUniverse.
 */
export class FixtureManager {
  private store: AppStore;
  private bundledProfiles: Map<string, FixtureProfile> = new Map();

  constructor(store: AppStore) {
    this.store = store;

    // Ensure fixtures array exists
    if (!(this.store as any).has('fixtures')) {
      (this.store as any).set('fixtures', []);
    }

    // Load bundled fixture profiles from the fixtures directory
    this.loadBundledProfiles();
  }

  /**
   * Load bundled fixture profiles from the fixtures/ directory.
   */
  private loadBundledProfiles(): void {
    // In production, fixtures are in resources/fixtures; in dev, in project root fixtures/
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'fixtures'),          // dev: project root
      path.join(__dirname, '..', '..', '..', 'fixtures'),    // packaged: inside app
      path.join(process.resourcesPath || '', 'fixtures'),    // electron packaged resources
    ];

    for (const fixturesDir of possiblePaths) {
      try {
        if (!fs.existsSync(fixturesDir)) continue;
        const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(fixturesDir, file), 'utf-8');
            const profile = JSON.parse(content) as FixtureProfile;
            if (profile.fixture && profile.channelCount && profile.channels) {
              const profileId = path.basename(file, '.json');
              this.bundledProfiles.set(profileId, profile);
              log.info(`FixtureManager: Loaded bundled profile "${profile.fixture}" (${profileId})`);
            }
          } catch (err) {
            log.warn(`FixtureManager: Failed to load profile ${file}:`, err);
          }
        }

        if (this.bundledProfiles.size > 0) break; // Found profiles, stop searching
      } catch {
        // Directory doesn't exist or isn't readable, try next
      }
    }

    log.info(`FixtureManager: ${this.bundledProfiles.size} bundled profile(s) loaded`);
  }

  /**
   * Get all bundled fixture profiles.
   */
  getBundledProfiles(): { id: string; profile: FixtureProfile }[] {
    return Array.from(this.bundledProfiles.entries()).map(([id, profile]) => ({ id, profile }));
  }

  /**
   * Get a specific bundled profile by ID.
   */
  getBundledProfile(profileId: string): FixtureProfile | undefined {
    return this.bundledProfiles.get(profileId);
  }

  /**
   * Get all fixtures. Ensures backward compatibility by defaulting colorMode to 'rgb'.
   */
  getAll(): Fixture[] {
    const fixtures = ((this.store as any).get('fixtures') as Fixture[]) || [];
    let didUpdate = false;

    const updatedFixtures = fixtures.map((f) => {
      const normalized: Fixture = {
        ...f,
        colorMode: f.colorMode || 'rgb',
      };

      if (normalized.profile) {
        const targetName = normalized.profile.fixture || normalized.type;
        const bundledProfile = this.findBundledProfileByFixtureName(targetName);

        if (bundledProfile) {
          // Always sync stored profiles with the latest bundled version.
          // The bundled JSON is the source of truth for channel layout, modes, defaults, etc.
          const storedJSON = JSON.stringify(normalized.profile);
          const bundledJSON = JSON.stringify(bundledProfile);
          if (storedJSON !== bundledJSON) {
            normalized.profile = bundledProfile;
            didUpdate = true;
            log.info(`FixtureManager: Synced profile for "${normalized.name}" with latest bundled "${targetName}"`);
          }
        }
      }

      return normalized;
    });

    if (didUpdate) {
      (this.store as any).set('fixtures', updatedFixtures);
    }

    return updatedFixtures;
  }

  private findBundledProfileByFixtureName(fixtureName?: string): FixtureProfile | undefined {
    if (!fixtureName) return undefined;
    for (const profile of this.bundledProfiles.values()) {
      if (profile.fixture === fixtureName) return profile;
    }
    return undefined;
  }

  /**
   * Get a fixture by ID.
   */
  getById(id: string): Fixture | undefined {
    return this.getAll().find((f) => f.id === id);
  }

  /**
   * Create a new fixture profile.
   */
  create(name: string, type: string, channels: FixtureChannel[], colorMode: ColorMode = 'rgb'): Fixture {
    const fixture: Fixture = {
      id: uuidv4(),
      name,
      type,
      colorMode,
      channels: channels.map((ch) => ({
        name: ch.name,
        dmxChannel: ch.dmxChannel,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const fixtures = this.getAll();
    fixtures.push(fixture);
    (this.store as any).set('fixtures', fixtures);

    log.info(`FixtureManager: Created fixture "${name}" (${fixture.id}) with ${channels.length} channels`);
    return fixture;
  }

  /**
   * Create a fixture from a bundled profile.
   * Auto-generates channel mappings from startAddress + profile channel offsets.
   */
  createFromProfile(name: string, profileId: string, startAddress: number): Fixture {
    const profile = this.bundledProfiles.get(profileId);
    if (!profile) {
      throw new Error(`Bundled profile not found: ${profileId}`);
    }

    if (startAddress < 1 || startAddress + profile.channelCount - 1 > 512) {
      throw new Error(
        `Invalid start address ${startAddress}: fixture requires ${profile.channelCount} channels (max address would be ${startAddress + profile.channelCount - 1})`
      );
    }

    // Generate channels from profile definition
    const channelKeys = Object.keys(profile.channels).sort(); // ch1, ch2, ch3...
    const channels: FixtureChannel[] = channelKeys.map((key, index) => {
      const chDef = profile.channels[key];
      return {
        name: chDef.label,
        dmxChannel: startAddress + index,
      };
    });

    // Default to first mode
    const defaultMode = profile.modes.length > 0 ? profile.modes[0].name : undefined;

    const fixture: Fixture = {
      id: uuidv4(),
      name,
      type: profile.fixture,
      colorMode: 'rgb', // Profile fixtures don't use color wheel
      channels,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      profile,
      startAddress,
      activeMode: defaultMode,
    };

    const fixtures = this.getAll();
    fixtures.push(fixture);
    (this.store as any).set('fixtures', fixtures);

    log.info(
      `FixtureManager: Created profile fixture "${name}" (${fixture.id}) from "${profile.fixture}" at address ${startAddress}, ${profile.channelCount} channels`
    );
    return fixture;
  }

  /**
   * Set the active mode for a profile-based fixture.
   * Returns an array of DMX channel/value pairs to send (mode-select + any defaults).
   */
  setActiveMode(fixtureId: string, modeName: string): { channel: number; value: number }[] {
    const fixtures = this.getAll();
    const index = fixtures.findIndex((f) => f.id === fixtureId);
    if (index === -1) {
      throw new Error(`Fixture not found: ${fixtureId}`);
    }

    const fixture = fixtures[index];
    if (!fixture.profile) {
      throw new Error(`Fixture "${fixture.name}" is not a profile fixture`);
    }

    const mode = fixture.profile.modes.find((m) => m.name === modeName);
    if (!mode) {
      throw new Error(`Mode "${modeName}" not found in profile "${fixture.profile.fixture}"`);
    }

    // Find the mode-select channel
    const modeChannelKey = fixture.profile.modeChannel;
    if (!modeChannelKey) {
      log.warn(`FixtureManager: Profile "${fixture.profile.fixture}" has no modeChannel defined`);
      return [];
    }

    // Resolve the DMX channel for the mode-select channel
    const channelKeys = Object.keys(fixture.profile.channels).sort();
    const modeChannelIndex = channelKeys.indexOf(modeChannelKey);
    if (modeChannelIndex === -1 || !fixture.startAddress) {
      return [];
    }

    const dmxChannel = fixture.startAddress + modeChannelIndex;
    const results: { channel: number; value: number }[] = [
      { channel: dmxChannel, value: mode.channelValue },
    ];

    // Apply any defaults defined on the mode (hidden/auto-set params)
    if (mode.defaults && fixture.startAddress) {
      for (const [chKey, val] of Object.entries(mode.defaults)) {
        const chIndex = channelKeys.indexOf(chKey);
        if (chIndex !== -1) {
          results.push({ channel: fixture.startAddress + chIndex, value: val });
        }
      }
    }

    // Update stored active mode
    fixtures[index] = {
      ...fixture,
      activeMode: modeName,
      updatedAt: new Date().toISOString(),
    };
    (this.store as any).set('fixtures', fixtures);

    log.info(`FixtureManager: Set mode "${modeName}" on fixture "${fixture.name}" (CH${dmxChannel} = ${mode.channelValue}, ${results.length - 1} default(s))`);
    return results;
  }

  /**
   * Update an existing fixture profile.
   */
  update(id: string, patch: Partial<Omit<Fixture, 'id' | 'createdAt'>>): Fixture {
    const fixtures = this.getAll();
    const index = fixtures.findIndex((f) => f.id === id);

    if (index === -1) {
      throw new Error(`Fixture not found: ${id}`);
    }

    const updated: Fixture = {
      ...fixtures[index],
      ...patch,
      id: fixtures[index].id,
      createdAt: fixtures[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    fixtures[index] = updated;
    (this.store as any).set('fixtures', fixtures);

    log.info(`FixtureManager: Updated fixture "${updated.name}" (${id})`);
    return updated;
  }

  /**
   * Delete a fixture profile by ID.
   */
  delete(id: string): boolean {
    const fixtures = this.getAll();
    const index = fixtures.findIndex((f) => f.id === id);

    if (index === -1) {
      log.warn(`FixtureManager: Fixture not found for deletion: ${id}`);
      return false;
    }

    const removed = fixtures.splice(index, 1)[0];
    (this.store as any).set('fixtures', fixtures);

    log.info(`FixtureManager: Deleted fixture "${removed.name}" (${id})`);
    return true;
  }

  /**
   * Validates that no two fixtures claim the same DMX channel.
   * Returns array of conflict descriptions, empty if clean.
   */
  validateChannelConflicts(): string[] {
    const fixtures = this.getAll();
    const channelOwners = new Map<number, { fixtureId: string; fixtureName: string; channelName: string }>();
    const conflicts: string[] = [];

    for (const fixture of fixtures) {
      for (const channel of fixture.channels) {
        const existing = channelOwners.get(channel.dmxChannel);
        if (existing) {
          conflicts.push(
            `DMX channel ${channel.dmxChannel}: "${fixture.name}" (${channel.name}) conflicts with "${existing.fixtureName}" (${existing.channelName})`
          );
        } else {
          channelOwners.set(channel.dmxChannel, {
            fixtureId: fixture.id,
            fixtureName: fixture.name,
            channelName: channel.name,
          });
        }
      }
    }

    if (conflicts.length > 0) {
      log.warn(`FixtureManager: ${conflicts.length} channel conflict(s) detected`);
    }

    return conflicts;
  }

  /**
   * Export all fixtures to a portable JSON object.
   */
  exportConfig(): FixtureConfig {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      fixtures: this.getAll(),
    };
  }

  /**
   * Import fixtures from a FixtureConfig JSON object.
   * Strategy: 'merge' adds non-conflicting fixtures, 'replace' overwrites all.
   */
  importConfig(config: FixtureConfig, strategy: 'merge' | 'replace'): {
    added: number;
    skipped: number;
    conflicts: string[];
  } {
    if (config.version !== 1) {
      throw new Error(`Unsupported fixture config version: ${config.version}`);
    }

    if (strategy === 'replace') {
      (this.store as any).set('fixtures', config.fixtures);
      log.info(`FixtureManager: Replaced all fixtures with ${config.fixtures.length} imported fixtures`);
      return {
        added: config.fixtures.length,
        skipped: 0,
        conflicts: [],
      };
    }

    // Merge strategy
    const existing = this.getAll();
    const existingIds = new Set(existing.map((f) => f.id));
    const existingChannels = new Set<number>();

    for (const fixture of existing) {
      for (const ch of fixture.channels) {
        existingChannels.add(ch.dmxChannel);
      }
    }

    let added = 0;
    let skipped = 0;
    const conflicts: string[] = [];

    for (const fixture of config.fixtures) {
      // Skip if ID already exists
      if (existingIds.has(fixture.id)) {
        skipped++;
        conflicts.push(`Fixture "${fixture.name}" (${fixture.id}) already exists — skipped`);
        continue;
      }

      // Check for channel conflicts
      const conflicting = fixture.channels.filter((ch) => existingChannels.has(ch.dmxChannel));
      if (conflicting.length > 0) {
        skipped++;
        conflicts.push(
          `Fixture "${fixture.name}" has conflicting channels: ${conflicting.map((c) => c.dmxChannel).join(', ')} — skipped`
        );
        continue;
      }

      // Add the fixture
      existing.push(fixture);
      existingIds.add(fixture.id);
      for (const ch of fixture.channels) {
        existingChannels.add(ch.dmxChannel);
      }
      added++;
    }

    (this.store as any).set('fixtures', existing);
    log.info(`FixtureManager: Import complete — ${added} added, ${skipped} skipped`);

    return { added, skipped, conflicts };
  }

  /**
   * Get all DMX channels claimed by any fixture.
   */
  getChannelMap(): Map<number, { fixtureId: string; fixtureName: string; channelName: string }> {
    const fixtures = this.getAll();
    const map = new Map<number, { fixtureId: string; fixtureName: string; channelName: string }>();

    for (const fixture of fixtures) {
      for (const channel of fixture.channels) {
        if (!map.has(channel.dmxChannel)) {
          map.set(channel.dmxChannel, {
            fixtureId: fixture.id,
            fixtureName: fixture.name,
            channelName: channel.name,
          });
        }
      }
    }

    return map;
  }
}
