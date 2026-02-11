import type { Fixture, FixtureProfile, ProfileMode } from '../types';
import { inferChannelRole } from '../types';

/**
 * Live display values computed from a fixture's channels and the DMX state.
 */
export interface LiveValues {
  /** Brightness percentage 0–100, or null if no brightness channel */
  brightness: number | null;
  /** Color temperature string like "4200K", or null if no temp channel */
  colorTemp: string | null;
  /** HSB values { h, s, b } as 0–100 percentages, or null if not applicable */
  hsb: { h: number; s: number; b: number } | null;
  /** RGB values { r, g, b } as 0–255, or null if not applicable */
  rgb: { r: number; g: number; b: number } | null;
  /** Active mode name, or null */
  activeMode: string | null;
  /** CSS color string for the fixture glow */
  glowColor: string;
  /** Glow intensity 0–1, driven by brightness/master. 0 = fully transparent */
  glowIntensity: number;
}

/**
 * Default fixture sizes by type keyword matching.
 * Returns { width, height } in canvas pixels.
 */
export function getFixtureSize(fixture: Fixture): { width: number; height: number } {
  const type = (fixture.type || '').toLowerCase();
  const name = (fixture.name || '').toLowerCase();
  const combined = `${type} ${name}`;

  // Panel lights — wide and short
  if (combined.includes('panel') || combined.includes('nova') || combined.includes('p300')) {
    return { width: 100, height: 60 };
  }
  // Fresnel / spot / point source — tall and narrow
  if (combined.includes('fresnel') || combined.includes('spot') || combined.includes('forza') || combined.includes('point')) {
    return { width: 50, height: 80 };
  }
  // Strip / bar lights — very wide, thin
  if (combined.includes('strip') || combined.includes('bar') || combined.includes('tube')) {
    return { width: 140, height: 30 };
  }
  // Default rectangle
  return { width: 70, height: 50 };
}

/**
 * Compute live display values for a fixture from the current DMX channel state.
 */
export function computeLiveValues(
  fixture: Fixture,
  channels: number[],
  master: number,
): LiveValues {
  const result: LiveValues = {
    brightness: null,
    colorTemp: null,
    hsb: null,
    rgb: null,
    activeMode: fixture.activeMode || null,
    glowColor: 'rgb(255, 255, 255)',
    glowIntensity: 1,
  };

  if (fixture.profile) {
    return computeProfileLiveValues(fixture, channels, master);
  }

  return computeLegacyLiveValues(fixture, channels, master);
}

/**
 * Compute live values for a profile-based fixture.
 */
function computeProfileLiveValues(
  fixture: Fixture,
  channels: number[],
  master: number,
): LiveValues {
  const result: LiveValues = {
    brightness: null,
    colorTemp: null,
    hsb: null,
    rgb: null,
    activeMode: fixture.activeMode || null,
    glowColor: 'rgb(255, 255, 255)',
    glowIntensity: 1,
  };

  const profile = fixture.profile!;
  const startAddress = fixture.startAddress || 1;
  const channelKeys = Object.keys(profile.channels).sort();

  // Map channel keys to DMX addresses
  const keyToDmx: Record<string, number> = {};
  channelKeys.forEach((key, index) => {
    keyToDmx[key] = startAddress + index;
  });

  // Find dimmer channel
  for (const [key, def] of Object.entries(profile.channels)) {
    if (def.role === 'dimmer') {
      const dmxAddr = keyToDmx[key];
      if (dmxAddr) {
        const raw = channels[dmxAddr - 1] || 0;
        result.brightness = Math.round((raw / 255) * (master / 255) * 100);
      }
      break;
    }
  }

  // Check active mode for color wheel group
  const activeMode = profile.modes.find((m) => m.name === fixture.activeMode);
  if (activeMode?.colorWheelGroup) {
    const cwg = activeMode.colorWheelGroup;
    const hueDmx = keyToDmx[cwg.hueChannel];
    const satDmx = keyToDmx[cwg.saturationChannel];
    const brtDmx = cwg.brightnessChannel ? keyToDmx[cwg.brightnessChannel] : null;

    if (hueDmx && satDmx) {
      const h = channels[hueDmx - 1] || 0;
      const s = channels[satDmx - 1] || 0;
      const b = brtDmx ? (channels[brtDmx - 1] || 0) : 255;
      result.hsb = {
        h: Math.round((h / 255) * 360),
        s: Math.round((s / 255) * 100),
        b: Math.round((b / 255) * 100),
      };

      // Compute glow color from HSB
      result.glowColor = hsbToCSS(h, s, b, master);
    }
  }

  // Check for temperature channel in profile
  for (const [key, def] of Object.entries(profile.channels)) {
    if (def.role === 'temperature' || def.role === 'temp') {
      const dmxAddr = keyToDmx[key];
      if (dmxAddr) {
        const raw = channels[dmxAddr - 1] || 0;
        const kelvin = Math.round(2700 + (raw / 255) * (6500 - 2700));
        result.colorTemp = `${kelvin}K`;
        // Tint glow to color temp if no HSB color is active
        if (!result.hsb) {
          result.glowColor = kelvinToCSS(kelvin);
        }
      }
      break;
    }
  }

  // If no color info but we have brightness, glow is warm white
  if (!result.hsb && !result.colorTemp && result.brightness !== null) {
    result.glowColor = 'rgb(255, 240, 220)';
  }

  // Compute glow intensity from brightness
  if (result.brightness !== null) {
    result.glowIntensity = result.brightness / 100;
  }

  // Factor HSB brightness into glow intensity so b=0 → fully transparent
  if (result.hsb) {
    result.glowIntensity *= result.hsb.b / 100;
  }

  return result;
}

/**
 * Compute live values for a legacy (non-profile) fixture.
 */
function computeLegacyLiveValues(
  fixture: Fixture,
  channels: number[],
  master: number,
): LiveValues {
  const result: LiveValues = {
    brightness: null,
    colorTemp: null,
    hsb: null,
    rgb: null,
    activeMode: null,
    glowColor: 'rgb(255, 255, 255)',
    glowIntensity: 1,
  };

  let r: number | null = null;
  let g: number | null = null;
  let b: number | null = null;
  let hue: number | null = null;
  let sat: number | null = null;
  let brt: number | null = null;

  for (const ch of fixture.channels) {
    const role = inferChannelRole(ch.name);
    const value = channels[ch.dmxChannel - 1] || 0;

    switch (role) {
      case 'brightness':
      case 'dimmer':
        result.brightness = Math.round((value / 255) * (master / 255) * 100);
        brt = value;
        break;
      case 'temperature':
      case 'temp':
        // Map DMX 0–255 to a default Kelvin range
        result.colorTemp = `${Math.round(2700 + (value / 255) * (6500 - 2700))}K`;
        break;
      case 'red':
        r = value;
        break;
      case 'green':
        g = value;
        break;
      case 'blue':
        b = value;
        break;
      case 'hue':
        hue = value;
        break;
      case 'saturation':
      case 'sat':
        sat = value;
        break;
    }
  }

  // RGB fixture
  if (r !== null && g !== null && b !== null) {
    result.rgb = { r, g, b };
    // Use the raw RGB color directly — opacity is handled by the SVG gradient
    result.glowColor = `rgb(${r}, ${g}, ${b})`;
  }

  // HSB fixture
  if (fixture.colorMode === 'hsb' && hue !== null && sat !== null) {
    result.hsb = {
      h: Math.round((hue / 255) * 360),
      s: Math.round((sat / 255) * 100),
      b: brt !== null ? Math.round((brt / 255) * 100) : 100,
    };
    result.glowColor = hsbToCSS(hue, sat ?? 255, brt ?? 255, master);
  }

  // Color temperature: tint glow to Kelvin color
  if (result.colorTemp && !result.rgb && !result.hsb) {
    const kelvin = parseInt(result.colorTemp, 10);
    if (!isNaN(kelvin)) {
      result.glowColor = kelvinToCSS(kelvin);
    }
  }

  // Brightness-only glow (no color info at all)
  if (!result.rgb && !result.hsb && !result.colorTemp && result.brightness !== null) {
    result.glowColor = 'rgb(255, 240, 220)';
  }

  // Compute glow intensity from brightness
  if (result.brightness !== null) {
    result.glowIntensity = result.brightness / 100;
  }

  // Factor HSB brightness into glow intensity so b=0 → fully transparent
  if (result.hsb) {
    result.glowIntensity *= result.hsb.b / 100;
  }

  return result;
}

/**
 * Convert DMX HSB values (0–255 each) + master to a CSS color string.
 * Outputs a vivid, bright color suitable for a glow overlay.
 */
function hsbToCSS(h: number, s: number, b: number, master: number): string {
  const hDeg = (h / 255) * 360;
  const sPct = (s / 255) * 100;
  // Use high lightness so colors are clearly visible as a glow.
  // Brightness/master scale it down, but floor at 50% so it stays vivid.
  const bNorm = (b / 255) * (master / 255);
  const lPct = 50 + bNorm * 30; // 50–80% lightness range
  return `hsl(${hDeg.toFixed(0)}, ${sPct.toFixed(0)}%, ${lPct.toFixed(0)}%)`;
}

/**
 * Convert a Kelvin color temperature (2700–6500) to a CSS color.
 * Warm temps → amber/orange, neutral → warm white, cool → blue-white.
 */
function kelvinToCSS(kelvin: number): string {
  // Simplified Kelvin→RGB (Tanner Helland approximation, clamped to 2700–6500)
  const k = Math.max(2700, Math.min(6500, kelvin));
  const temp = k / 100;
  let r: number, g: number, b: number;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
  }

  // Green
  if (temp <= 66) {
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }

  r = Math.max(0, Math.min(255, Math.round(r)));
  g = Math.max(0, Math.min(255, Math.round(g)));
  b = Math.max(0, Math.min(255, Math.round(b)));

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Format live values as a compact display string for the canvas overlay.
 */
export function formatLiveValueLines(lv: LiveValues): string[] {
  const lines: string[] = [];

  if (lv.brightness !== null) {
    lines.push(`${lv.brightness}%`);
  }
  if (lv.colorTemp) {
    lines.push(lv.colorTemp);
  }
  if (lv.hsb && !lv.colorTemp) {
    lines.push(`H${lv.hsb.h}° S${lv.hsb.s}%`);
  }
  if (lv.rgb && !lv.hsb) {
    lines.push(`R${lv.rgb.r} G${lv.rgb.g} B${lv.rgb.b}`);
  }

  return lines;
}
