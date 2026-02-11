// Shared TypeScript interfaces for DMX Controller App

/**
 * A single controllable property of a fixture.
 * Maps a human-readable name to a DMX channel number.
 */
export interface FixtureChannel {
  name: string;
  dmxChannel: number; // 1–512 (DMX convention, 1-indexed)
}

/**
 * Supported channel property categories.
 * Used by the UI to render the correct control widget for each channel.
 */
export type ChannelRole =
  | 'red' | 'green' | 'blue'
  | 'brightness' | 'dimmer'
  | 'temperature' | 'temp'
  | 'hue'
  | 'saturation' | 'sat'
  | 'mode'
  | 'mode-select'
  | 'dynamic'
  | 'custom';

/**
 * Color mode for a fixture — determines how the ColorWheel outputs values.
 * 'rgb': sends Red, Green, Blue DMX values (default)
 * 'hsb': sends Hue, Saturation, Brightness DMX values directly
 */
export type ColorMode = 'rgb' | 'hsb';

// --- Fixture Profile System ---

/**
 * Control type for a dynamic channel within a mode.
 * 'fader': 0–255 slider
 * 'momentary': press-and-hold sends 255, release sends 0
 * 'toggle': binary on/off switch (sends 0 or 255)
 * 'stepped': discrete stepped slider with labeled positions
 */
export type ProfileControlType = 'fader' | 'momentary' | 'toggle' | 'stepped';

/**
 * A discrete step in a stepped control.
 */
export interface ProfileControlStep {
  label: string;
  dmxValue: number;
}

/**
 * An extra action button shown alongside a stepped control.
 */
export interface ProfileControlExtraButton {
  label: string;
  dmxValue: number;
  icon?: string;
}

/**
 * A single control definition within a fixture mode.
 */
export interface ProfileControl {
  label: string;
  type: ProfileControlType;
  icon?: string; // Icon filename (e.g., 'gauge.svg')
  /** For 'stepped' type: discrete value positions */
  steps?: ProfileControlStep[];
  /** For 'stepped' type: extra action buttons (e.g., Random) */
  extraButtons?: ProfileControlExtraButton[];
}

/**
 * A channel definition in a fixture profile.
 */
export interface ProfileChannelDef {
  role: ChannelRole;
  label: string;
}

/**
 * A mode entry in a fixture profile.
 * The key is the channel key (e.g., 'ch3'), the value describes the control.
 */
export interface ProfileMode {
  name: string;
  channelValue: number; // DMX value to send on the mode-select channel (0–255)
  icon?: string; // Icon filename (e.g., 'sun.svg')
  controls: Record<string, ProfileControl | null>; // keyed by channel key (e.g., 'ch3')
  /** When present, the renderer shows a ColorWheel bound to these profile channel keys. */
  colorWheelGroup?: {
    hueChannel: string;        // channel key for Hue (e.g., 'ch04')
    saturationChannel: string; // channel key for Saturation (e.g., 'ch05')
    brightnessChannel?: string; // channel key for Brightness/Dimmer (e.g., 'ch02')
  };
  /** DMX channel defaults auto-sent when this mode is activated (e.g., hidden params). */
  defaults?: Record<string, number>;
}

/**
 * A fixture profile definition loaded from a bundled JSON file.
 * Describes the channel layout and modes of a fixture type.
 */
export interface FixtureProfile {
  fixture: string;           // Display name (e.g., "Forza Nanlite 200")
  channelCount: number;      // Total DMX channels used
  modeChannel?: string;      // Which channel key is mode-select (e.g., 'ch2')
  channels: Record<string, ProfileChannelDef>; // e.g., { ch1: { role: 'dimmer', label: 'Intensity' } }
  modes: ProfileMode[];
}

/**
 * Canvas layout data for a fixture placed on the studio canvas.
 */
export interface CanvasLayout {
  x: number;           // X position on canvas (0–1 normalized)
  y: number;           // Y position on canvas (0–1 normalized)
  rotation: number;    // Rotation in degrees (0–360)
  width: number;       // Width on canvas (pixels at default zoom)
  height: number;      // Height on canvas (pixels at default zoom)
}

/**
 * A fixture profile — a named group of DMX channels.
 */
export interface Fixture {
  id: string;
  name: string;
  type: string;
  colorMode: ColorMode;
  channels: FixtureChannel[];
  createdAt: string;
  updatedAt: string;
  // Profile-based fixture fields (optional — absent for basic fixtures)
  profile?: FixtureProfile;
  startAddress?: number;
  activeMode?: string; // Name of the currently active mode
  // Canvas view fields (optional — absent until placed on canvas)
  onCanvas?: boolean;
  canvasLayout?: CanvasLayout;
}

/**
 * Portable fixture configuration — the full exportable/importable profile set.
 */
export interface FixtureConfig {
  version: 1;
  exportedAt: string;
  fixtures: Fixture[];
}

/**
 * A saved lighting preset.
 */
export interface Preset {
  id: string;
  name: string;
  channels: number[]; // 512-length array of values 0–255
  fadeTime: number;    // Default fade duration in ms
  color: string;       // Hex color for the UI button (e.g., "#ff3300")
  fixtureModes?: Record<string, string>; // Fixture ID -> active mode name
  createdAt: string;
  updatedAt: string;
}

/**
 * Persistence store schema.
 */
export interface StoreSchema {
  presets: Preset[];
  fixtures: Fixture[];
  settings: {
    defaultFadeTime: number;
    uiThrottleRate: number;
    dmxRefreshRate: number;
  };
}

/**
 * DMX connection status payload.
 */
export interface DMXStatus {
  connected: boolean;
  port: string | null;
}

/**
 * DMX universe state payload.
 */
export interface DMXState {
  channels: number[];
  master: number;
}

/**
 * Fade progress payload.
 */
export interface FadeProgress {
  percent: number;
  presetId: string;
}

/**
 * Channel name → role mapping (case-insensitive).
 */
export function inferChannelRole(name: string): ChannelRole {
  const lower = name.toLowerCase().trim();
  switch (lower) {
    case 'red':
    case 'r':
      return 'red';
    case 'green':
    case 'g':
      return 'green';
    case 'blue':
    case 'b':
      return 'blue';
    case 'brightness':
    case 'dimmer':
    case 'dim':
    case 'intensity':
      return 'brightness';
    case 'temperature':
    case 'temp':
    case 'cct':
      return 'temperature';
    case 'hue':
      return 'hue';
    case 'saturation':
    case 'sat':
      return 'saturation';
    case 'mode':
    case 'function':
    case 'program':
      return 'mode';
    case 'mode-select':
      return 'mode-select';
    case 'dynamic':
      return 'dynamic';
    default:
      return 'custom';
  }
}

/**
 * List of bundled fixture profile IDs available in the app.
 */
export const BUNDLED_PROFILES = [
  'forza-200',
  'nova-p300c-fx',
] as const;

export type BundledProfileId = typeof BUNDLED_PROFILES[number];

/**
 * Companion inbound command types.
 */
export interface CompanionCommand {
  action: 'recall_preset' | 'blackout' | 'set_channel' | 'get_state' | 'list_presets' | 'master_dimmer';
  id?: string;
  fadeTime?: number;
  channel?: number;
  value?: number;
}

/**
 * Companion response.
 */
export interface CompanionResponse {
  status: 'ok' | 'error';
  action: string;
  data?: unknown;
  message?: string;
}

/**
 * Companion unsolicited event.
 */
export interface CompanionEvent {
  event: string;
  data: unknown;
}

/**
 * Electron API exposed via preload.
 */
export interface ElectronAPI {
  hideWindow: () => void;
  getDMXStatus: () => Promise<DMXStatus>;
  exportFixtures: () => Promise<{ success: boolean; path?: string }>;
  importFixtures: () => Promise<{ success: boolean; config?: FixtureConfig } | null>;
  getAppVersion: () => Promise<string>;
  getNetworkIP: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
