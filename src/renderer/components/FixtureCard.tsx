import React, { useMemo, useCallback, useRef, useState } from 'react';
import { ColorWheel } from './ColorWheel';
import { VerticalSlider } from './VerticalSlider';
import { MomentaryButton } from './MomentaryButton';
import type { Fixture, FixtureChannel, FixtureProfile, ProfileMode, ProfileControl } from '../types';
import { inferChannelRole } from '../types';

// --- Static icon imports (Vite resolves these at build time) ---
import iconSun from '../assets/icons/sun.svg';
import iconRepeat from '../assets/icons/repeat.svg';
import iconZap from '../assets/icons/zap.svg';
import iconActivity from '../assets/icons/activity.svg';
import iconCloudLightning from '../assets/icons/cloud-lightning.svg';
import iconBolt from '../assets/icons/bolt.svg';
import iconTv from '../assets/icons/tv.svg';
import iconCamera from '../assets/icons/camera.svg';
import iconFlame from '../assets/icons/flame.svg';
import iconLightbulbOff from '../assets/icons/lightbulb-off.svg';
import iconSparkles from '../assets/icons/sparkles.svg';
import iconBomb from '../assets/icons/bomb.svg';
import iconCollision from '../assets/icons/collision.svg';
import iconSparkle from '../assets/icons/sparkle.svg';
import iconSunMedium from '../assets/icons/sun-medium.svg';
import iconGauge from '../assets/icons/gauge.svg';
import iconTimer from '../assets/icons/timer.svg';
import iconTrendingDown from '../assets/icons/trending-down.svg';
import iconPauseCircle from '../assets/icons/pause-circle.svg';
import iconMousePointer2 from '../assets/icons/mouse-pointer-2.svg';
import iconScale from '../assets/icons/scale.svg';

const ICON_MAP: Record<string, string> = {
  'sun.svg': iconSun,
  'repeat.svg': iconRepeat,
  'zap.svg': iconZap,
  'activity.svg': iconActivity,
  'cloud-lightning.svg': iconCloudLightning,
  'bolt.svg': iconBolt,
  'tv.svg': iconTv,
  'camera.svg': iconCamera,
  'flame.svg': iconFlame,
  'lightbulb-off.svg': iconLightbulbOff,
  'sparkles.svg': iconSparkles,
  'bomb.svg': iconBomb,
  'collision.svg': iconCollision,
  'sparkle.svg': iconSparkle,
  'sun-medium.svg': iconSunMedium,
  'gauge.svg': iconGauge,
  'timer.svg': iconTimer,
  'trending-down.svg': iconTrendingDown,
  'pause-circle.svg': iconPauseCircle,
  'mouse-pointer-2.svg': iconMousePointer2,
  'scale.svg': iconScale,
};

function resolveIconUrl(iconFile?: string): string | undefined {
  if (!iconFile) return undefined;
  return ICON_MAP[iconFile];
}

interface FixtureCardProps {
  fixture: Fixture;
  channels: number[];
  onChannelChange: (channel: number, value: number) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onModeChange?: (fixtureId: string, modeName: string) => void;
  onTriggerStart?: (channel: number) => void;
  onTriggerEnd?: (channel: number) => void;
}

/**
 * FixtureCard — Renders dynamic controls for a fixture based on its channel roles.
 * Supports both legacy (flat channel) fixtures and profile-based fixtures with modes.
 */
export const FixtureCard: React.FC<FixtureCardProps> = ({
  fixture,
  channels,
  onChannelChange,
  onEdit,
  onDelete,
  onModeChange,
  onTriggerStart,
  onTriggerEnd,
}) => {
  // If this fixture has a profile, render the profile-driven layout
  if (fixture.profile) {
    return (
      <ProfileFixtureCard
        fixture={fixture}
        profile={fixture.profile}
        channels={channels}
        onChannelChange={onChannelChange}
        onEdit={onEdit}
        onDelete={onDelete}
        onModeChange={onModeChange}
        onTriggerStart={onTriggerStart}
        onTriggerEnd={onTriggerEnd}
      />
    );
  }

  // Legacy fixture rendering
  return (
    <LegacyFixtureCard
      fixture={fixture}
      channels={channels}
      onChannelChange={onChannelChange}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
};

// ─── Profile-Based Fixture Card ────────────────────────────────────────────────

interface ProfileFixtureCardProps {
  fixture: Fixture;
  profile: FixtureProfile;
  channels: number[];
  onChannelChange: (channel: number, value: number) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onModeChange?: (fixtureId: string, modeName: string) => void;
  onTriggerStart?: (channel: number) => void;
  onTriggerEnd?: (channel: number) => void;
}

interface SteppedControlProps {
  control: ProfileControl;
  value: number;
  onChange: (value: number) => void;
}

const SteppedControl: React.FC<SteppedControlProps> = ({ control, value, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const steps = control.steps || [];
  const extraButtons = control.extraButtons || [];

  const updateFromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track || steps.length === 0) return;
      const rect = track.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
      const percent = 1 - y / rect.height;
      const idx = Math.round(percent * (steps.length - 1));
      const step = steps[idx];
      if (step) {
        onChange(step.dmxValue);
      }
    },
    [steps, onChange]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (steps.length === 0) return;
      trackRef.current?.setPointerCapture(e.pointerId);
      setIsDragging(true);
      updateFromClientY(e.clientY);
    },
    [steps.length, updateFromClientY]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      updateFromClientY(e.clientY);
    },
    [isDragging, updateFromClientY]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const isExtraActive = extraButtons.some(
    (btn) => Math.abs(value - btn.dmxValue) < 10
  );
  const activeStepIndex = isExtraActive || steps.length === 0
    ? -1
    : steps.reduce((closest, step, idx) => {
      const prevDist = Math.abs(value - steps[closest].dmxValue);
      const curDist = Math.abs(value - step.dmxValue);
      return curDist < prevDist ? idx : closest;
    }, 0);
  const activeStep = activeStepIndex >= 0 ? steps[activeStepIndex] : null;

  return (
    <div className="stepped-control">
      <div className="stepped-control-label">{control.label}</div>
      <div
        ref={trackRef}
        className={`stepped-slider-track ${isDragging ? 'dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {steps.map((step, idx) => (
          <button
            key={idx}
            className={`stepped-notch ${activeStepIndex === idx ? 'active' : ''}`}
            onClick={() => onChange(step.dmxValue)}
            title={`${control.label} ${step.label}`}
          >
            <span className="stepped-notch-pip" />
            <span className="stepped-notch-label">{step.label}</span>
          </button>
        ))}
      </div>
      <div className="stepped-value">
        {activeStep ? activeStep.label : ''}
      </div>
      {extraButtons.map((btn, idx) => {
        const isBtnActive = Math.abs(value - btn.dmxValue) < 10;
        return (
          <button
            key={`extra-${idx}`}
            className={`stepped-extra-btn ${isBtnActive ? 'active' : ''}`}
            onClick={() => onChange(btn.dmxValue)}
            title={btn.label}
          >
            {btn.icon && (
              <img src={resolveIconUrl(btn.icon)} alt="" className="stepped-extra-icon" />
            )}
            <span>{btn.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const ProfileFixtureCard: React.FC<ProfileFixtureCardProps> = ({
  fixture,
  profile,
  channels,
  onChannelChange,
  onEdit,
  onDelete,
  onModeChange,
  onTriggerStart,
  onTriggerEnd,
}) => {
  const startAddress = fixture.startAddress || 1;

  // Map channel keys to DMX addresses
  const channelKeysToDmx = useMemo(() => {
    const keys = Object.keys(profile.channels).sort();
    const map: Record<string, number> = {};
    keys.forEach((key, index) => {
      map[key] = startAddress + index;
    });
    return map;
  }, [profile.channels, startAddress]);

  // Find the current active mode (null = "None" / Daylight-only)
  const activeMode: ProfileMode | undefined = useMemo(() => {
    if (!fixture.activeMode) return undefined;
    return profile.modes.find((m) => m.name === fixture.activeMode);
  }, [profile.modes, fixture.activeMode]);

  // Detect ColorWheel group for the active mode
  const colorWheelGroup = useMemo(() => {
    if (!activeMode?.colorWheelGroup) return null;
    const cwg = activeMode.colorWheelGroup;
    return {
      hueDmx: channelKeysToDmx[cwg.hueChannel],
      satDmx: channelKeysToDmx[cwg.saturationChannel],
      brtDmx: cwg.brightnessChannel ? channelKeysToDmx[cwg.brightnessChannel] : null,
      hueKey: cwg.hueChannel,
      satKey: cwg.saturationChannel,
      brtKey: cwg.brightnessChannel ?? null,
    };
  }, [activeMode, channelKeysToDmx]);

  // HSB change handler for the ColorWheel
  const handleHSBColorChange = useCallback(
    (h: number, s: number, b: number) => {
      if (!colorWheelGroup) return;
      onChannelChange(colorWheelGroup.hueDmx, h);
      onChannelChange(colorWheelGroup.satDmx, s);
      if (colorWheelGroup.brtDmx) {
        onChannelChange(colorWheelGroup.brtDmx, b);
      }
    },
    [colorWheelGroup, onChannelChange]
  );

  // Get the dimmer channel(s) — role === 'dimmer', excluding any consumed by ColorWheel
  const dimmerEntries = useMemo(() => {
    return Object.entries(profile.channels)
      .filter(([key, def]) => {
        if (def.role !== 'dimmer') return false;
        // If this dimmer is consumed by the ColorWheel, don't render it as a standalone slider
        if (colorWheelGroup && key === colorWheelGroup.brtKey) return false;
        return true;
      })
      .map(([key, def]) => ({ key, def, dmxChannel: channelKeysToDmx[key] }));
  }, [profile.channels, channelKeysToDmx, colorWheelGroup]);

  // Set of channel keys consumed by the ColorWheel (should not appear as faders)
  const colorWheelConsumedKeys = useMemo(() => {
    if (!colorWheelGroup) return new Set<string>();
    const keys = new Set<string>();
    keys.add(colorWheelGroup.hueKey);
    keys.add(colorWheelGroup.satKey);
    if (colorWheelGroup.brtKey) keys.add(colorWheelGroup.brtKey);
    return keys;
  }, [colorWheelGroup]);

  // Get dynamic channels that have controls in the active mode, minus ColorWheel-consumed ones
  const activeControls = useMemo(() => {
    if (!activeMode) return [];
    const channelKeys = Object.keys(profile.channels).sort();
    return channelKeys
      .filter((key) => {
        const chDef = profile.channels[key];
        if (chDef.role !== 'dynamic' || !activeMode.controls[key]) return false;
        // Skip channels consumed by the color wheel
        if (colorWheelConsumedKeys.has(key)) return false;
        return true;
      })
      .map((key) => ({
        key,
        dmxChannel: channelKeysToDmx[key],
        control: activeMode.controls[key]!,
      }));
  }, [activeMode, profile.channels, channelKeysToDmx, colorWheelConsumedKeys]);

  const handleEffectClick = useCallback(
    (modeName: string) => {
      onModeChange?.(fixture.id, modeName);
    },
    [fixture.id, onModeChange]
  );

  // Determine if mode[0] is a "None" mode (channelValue === 0) — Forza-style
  // If not, all modes are rendered as peers in the grid
  const hasNoneMode = profile.modes.length > 0 && profile.modes[0].channelValue === 0;
  const noneMode = hasNoneMode ? profile.modes[0] : null;
  const effectModes = hasNoneMode ? profile.modes.slice(1) : profile.modes;
  const isNoneActive = hasNoneMode && (!fixture.activeMode || fixture.activeMode === noneMode?.name);

  const totalEffects = (noneMode ? 1 : 0) + effectModes.length;
  // We want to force 2 rows, so columns = ceil(total / 2)
  const columns = Math.ceil(totalEffects / 2);

  return (
    <div className="fixture-card">
      <div className="fixture-card-header">
        <h3>{fixture.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="fixture-type">{fixture.type}</span>
          {colorWheelGroup && (
            <span className="color-mode-badge hsb">HSB</span>
          )}
          {onEdit && (
            <button className="btn-icon" onClick={onEdit} title="Edit fixture">
              ✎
            </button>
          )}
          {onDelete && (
            <button className="btn-icon" onClick={onDelete} title="Delete fixture" style={{ color: 'var(--error)' }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Row 1: Mode controls — fixed-height area, content changes but buttons below stay put */}
      <div className="profile-controls-row">
        {/* ColorWheel for HSB modes */}
        {colorWheelGroup && (
          <ColorWheel
            red={0}
            green={0}
            blue={0}
            onColorChange={() => { }}
            colorMode="hsb"
            hsbValues={{
              hue: channels[colorWheelGroup.hueDmx - 1] || 0,
              saturation: channels[colorWheelGroup.satDmx - 1] || 0,
              brightness: colorWheelGroup.brtDmx
                ? (channels[colorWheelGroup.brtDmx - 1] || 0)
                : 255,
            }}
            onHSBChange={handleHSBColorChange}
          />
        )}

        {/* Dimmer sliders (not consumed by ColorWheel) */}
        {dimmerEntries.map(({ key, def, dmxChannel }) => (
          <VerticalSlider
            key={key}
            label={def.label}
            value={channels[dmxChannel - 1] || 0}
            min={0}
            max={255}
            onChange={(v) => onChannelChange(dmxChannel, v)}
            showPercentage
          />
        ))}

        {/* Dynamic controls */}
        {activeControls.map(({ key, dmxChannel, control }) => {
          if (control.type === 'momentary') {
            return (
              <MomentaryButton
                key={key}
                label={control.label}
                dmxChannel={dmxChannel}
                icon={resolveIconUrl(control.icon)}
                onPress={onTriggerStart || (() => { })}
                onRelease={onTriggerEnd || (() => { })}
              />
            );
          }

          if (control.type === 'toggle') {
            const isOn = (channels[dmxChannel - 1] || 0) >= 128;
            const labelParts = control.label.split(' / ');
            const offLabel = labelParts[0] || 'Off';
            const onLabel = labelParts[1] || 'On';
            return (
              <div key={key} className="dmx-toggle-switch">
                <span className={`dmx-toggle-label ${!isOn ? 'active' : ''}`}>{offLabel}</span>
                <button
                  className={`dmx-toggle-track ${isOn ? 'on' : ''}`}
                  onClick={() => onChannelChange(dmxChannel, isOn ? 0 : 255)}
                  title={control.label}
                >
                  <span className="dmx-toggle-thumb" />
                </button>
                <span className={`dmx-toggle-label ${isOn ? 'active' : ''}`}>{onLabel}</span>
              </div>
            );
          }

          if (control.type === 'stepped' && control.steps && control.steps.length > 0) {
            return (
              <SteppedControl
                key={key}
                control={control}
                value={channels[dmxChannel - 1] || 0}
                onChange={(v) => onChannelChange(dmxChannel, v)}
              />
            );
          }

          return (
            <VerticalSlider
              key={key}
              label={control.label}
              value={channels[dmxChannel - 1] || 0}
              min={0}
              max={255}
              onChange={(v) => onChannelChange(dmxChannel, v)}
              showPercentage
            />
          );
        })}
      </div>

      {/* Row 2: Effect buttons grid — always stable, never shifts */}
      <div className="profile-effects-row">
        <div
          className="effect-grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
          }}
        >
          {/* None button (only for Forza-style profiles with channelValue 0) */}
          {noneMode && (
            <button
              className={`effect-btn ${isNoneActive ? 'active' : ''}`}
              onClick={() => handleEffectClick(noneMode.name)}
              title={noneMode.name}
            >
              <img
                src={resolveIconUrl(noneMode.icon)}
                alt=""
                className="effect-icon"
              />
              <span className="effect-label">{noneMode.name}</span>
            </button>
          )}

          {/* Effect mode buttons */}
          {effectModes.map((mode) => {
            const isActive = fixture.activeMode === mode.name;
            return (
              <button
                key={mode.name}
                className={`effect-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleEffectClick(mode.name)}
                title={mode.name}
              >
                <img
                  src={resolveIconUrl(mode.icon)}
                  alt=""
                  className="effect-icon"
                />
                <span className="effect-label">{mode.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Legacy Fixture Card (unchanged logic) ─────────────────────────────────────

interface LegacyFixtureCardProps {
  fixture: Fixture;
  channels: number[];
  onChannelChange: (channel: number, value: number) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const LegacyFixtureCard: React.FC<LegacyFixtureCardProps> = ({
  fixture,
  channels,
  onChannelChange,
  onEdit,
  onDelete,
}) => {
  const isHSB = fixture.colorMode === 'hsb';

  // Group channels by role
  const { rgbGroup, hsbGroup, brightnessChannels, sliderChannels, modeChannels, customChannels } =
    useMemo(() => {
      const rgb: { red?: FixtureChannel; green?: FixtureChannel; blue?: FixtureChannel } = {};
      const hsb: { hue?: FixtureChannel; saturation?: FixtureChannel; brightness?: FixtureChannel } = {};
      const brightness: FixtureChannel[] = [];
      const sliders: FixtureChannel[] = [];
      const modes: FixtureChannel[] = [];
      const custom: FixtureChannel[] = [];

      for (const ch of fixture.channels) {
        const role = inferChannelRole(ch.name);

        if (isHSB) {
          // In HSB mode, group hue/saturation/brightness for the color wheel
          switch (role) {
            case 'hue':
              hsb.hue = ch;
              break;
            case 'saturation':
            case 'sat':
              hsb.saturation = ch;
              break;
            case 'brightness':
            case 'dimmer':
              hsb.brightness = ch;
              break;
            case 'red':
            case 'green':
            case 'blue':
              // In HSB mode, treat RGB channels as custom sliders
              custom.push(ch);
              break;
            case 'temperature':
            case 'temp':
              sliders.push(ch);
              break;
            case 'mode':
              modes.push(ch);
              break;
            case 'custom':
            default:
              custom.push(ch);
              break;
          }
        } else {
          // Original RGB mode logic
          switch (role) {
            case 'red':
              rgb.red = ch;
              break;
            case 'green':
              rgb.green = ch;
              break;
            case 'blue':
              rgb.blue = ch;
              break;
            case 'brightness':
            case 'dimmer':
              brightness.push(ch);
              break;
            case 'temperature':
            case 'temp':
            case 'hue':
            case 'saturation':
            case 'sat':
              sliders.push(ch);
              break;
            case 'mode':
              modes.push(ch);
              break;
            case 'custom':
            default:
              custom.push(ch);
              break;
          }
        }
      }

      return {
        rgbGroup: !isHSB && rgb.red && rgb.green && rgb.blue ? rgb as Required<typeof rgb> : null,
        hsbGroup: isHSB && hsb.hue && hsb.saturation && hsb.brightness ? hsb as Required<typeof hsb> : null,
        brightnessChannels: brightness,
        sliderChannels: sliders,
        modeChannels: modes,
        customChannels: custom,
      };
    }, [fixture.channels, isHSB]);

  const handleColorChange = useCallback(
    (r: number, g: number, b: number) => {
      if (!rgbGroup) return;
      onChannelChange(rgbGroup.red.dmxChannel, r);
      onChannelChange(rgbGroup.green.dmxChannel, g);
      onChannelChange(rgbGroup.blue.dmxChannel, b);
    },
    [rgbGroup, onChannelChange]
  );

  // HSB color change handler — receives H (0-255), S (0-255), B (0-255) for DMX
  const handleHSBColorChange = useCallback(
    (h: number, s: number, b: number) => {
      if (!hsbGroup) return;
      onChannelChange(hsbGroup.hue.dmxChannel, h);
      onChannelChange(hsbGroup.saturation.dmxChannel, s);
      onChannelChange(hsbGroup.brightness.dmxChannel, b);
    },
    [hsbGroup, onChannelChange]
  );

  // Determine if this fixture has a color group (RGB or HSB)
  const hasColorGroup = !!(rgbGroup || hsbGroup);

  // Resolve the first brightness/dimmer and saturation channels for the colour-wheel sliders
  const dimmerChannel = hasColorGroup ? (brightnessChannels[0] ?? null) : null;
  const satChannel = hasColorGroup
    ? (sliderChannels.find((ch) => {
      const role = inferChannelRole(ch.name);
      return role === 'saturation' || role === 'sat';
    }) ?? null)
    : null;

  // Remaining slider channels that are NOT consumed by the colour-wheel saturation slider
  const remainingSliderChannels = sliderChannels.filter((ch) => ch !== satChannel);

  // Standalone channels: brightness and temp channels that aren't consumed by a color wheel
  const standaloneBrightness = brightnessChannels.filter((ch) => ch !== dimmerChannel);
  const standaloneTemp = remainingSliderChannels.filter((ch) => {
    const role = inferChannelRole(ch.name);
    return role === 'temperature' || role === 'temp';
  });
  const otherSliders = remainingSliderChannels.filter((ch) => {
    const role = inferChannelRole(ch.name);
    return role !== 'temperature' && role !== 'temp';
  });

  // Show a styled slider panel when we have brightness/temp but no color group
  const showStandalonePanel = !hasColorGroup && (standaloneBrightness.length > 0 || standaloneTemp.length > 0);

  return (
    <div className="fixture-card">
      <div className="fixture-card-header">
        <h3>{fixture.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="fixture-type">{fixture.type}</span>
          {hasColorGroup && (
            <span className={`color-mode-badge ${isHSB ? 'hsb' : 'rgb'}`}>
              {isHSB ? 'HSB' : 'RGB'}
            </span>
          )}
          {onEdit && (
            <button className="btn-icon" onClick={onEdit} title="Edit fixture">
              ✎
            </button>
          )}
          {onDelete && (
            <button
              className="btn-icon"
              onClick={onDelete}
              title="Delete fixture"
              style={{ color: 'var(--error)' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="fixture-controls">
        {/* Color Wheel — RGB mode (hue donut → R/G/B output) */}
        {rgbGroup && (
          <ColorWheel
            red={channels[rgbGroup.red.dmxChannel - 1] || 0}
            green={channels[rgbGroup.green.dmxChannel - 1] || 0}
            blue={channels[rgbGroup.blue.dmxChannel - 1] || 0}
            onColorChange={handleColorChange}
            colorMode="rgb"
            dimmerChannel={dimmerChannel?.dmxChannel ?? null}
            saturationChannel={satChannel?.dmxChannel ?? null}
            onDimmerChange={
              dimmerChannel
                ? (v) => onChannelChange(dimmerChannel.dmxChannel, v)
                : undefined
            }
            onSaturationChange={
              satChannel
                ? (v) => onChannelChange(satChannel.dmxChannel, v)
                : undefined
            }
          />
        )}

        {/* Color Wheel — HSB mode (hue donut → H/S/B output) */}
        {hsbGroup && (
          <ColorWheel
            red={0}
            green={0}
            blue={0}
            onColorChange={() => { }}
            colorMode="hsb"
            hsbValues={{
              hue: channels[hsbGroup.hue.dmxChannel - 1] || 0,
              saturation: channels[hsbGroup.saturation.dmxChannel - 1] || 0,
              brightness: channels[hsbGroup.brightness.dmxChannel - 1] || 0,
            }}
            onHSBChange={handleHSBColorChange}
          />
        )}

        {/* Standalone brightness / temp panel (no color group) */}
        {showStandalonePanel && (
          <div className="color-wheel-wrapper">
            {standaloneBrightness.map((ch) => (
              <VerticalSlider
                key={ch.dmxChannel}
                label={ch.name.charAt(0).toUpperCase() + ch.name.slice(1)}
                value={channels[ch.dmxChannel - 1] || 0}
                min={0}
                max={255}
                onChange={(v) => onChannelChange(ch.dmxChannel, v)}
                showPercentage
              />
            ))}
            {standaloneTemp.map((ch) => (
              <VerticalSlider
                key={ch.dmxChannel}
                label={ch.name.charAt(0).toUpperCase() + ch.name.slice(1)}
                value={channels[ch.dmxChannel - 1] || 0}
                min={0}
                max={255}
                onChange={(v) => onChannelChange(ch.dmxChannel, v)}
                variant="warm"
                kelvinRange={{ min: 3200, max: 5600 }}
              />
            ))}
          </div>
        )}

        {/* Brightness / Dimmer faders when a color group exists (skip the one used by the wheel) */}
        {hasColorGroup && standaloneBrightness.map((ch) => (
          <div key={ch.dmxChannel} className="channel-fader">
            <span className="channel-number">{ch.name}</span>
            <input
              type="range"
              className="vertical-fader"
              min={0}
              max={255}
              value={channels[ch.dmxChannel - 1] || 0}
              onChange={(e) =>
                onChannelChange(ch.dmxChannel, parseInt(e.target.value, 10))
              }
              // @ts-expect-error — orient is a non-standard attribute for vertical sliders
              orient="vertical"
            />
            <span className="channel-value">{channels[ch.dmxChannel - 1] || 0}</span>
            <span className="channel-label">CH {ch.dmxChannel}</span>
          </div>
        ))}

        {/* Horizontal sliders for remaining slider channels (when color group exists, or non-temp sliders) */}
        {(hasColorGroup ? remainingSliderChannels : otherSliders).map((ch) => (
          <div key={ch.dmxChannel} className="horizontal-slider-container">
            <label>
              {ch.name} <small>(CH {ch.dmxChannel})</small>
            </label>
            <input
              type="range"
              className="horizontal-slider"
              min={0}
              max={255}
              value={channels[ch.dmxChannel - 1] || 0}
              onChange={(e) =>
                onChannelChange(ch.dmxChannel, parseInt(e.target.value, 10))
              }
            />
            <span className="slider-value">{channels[ch.dmxChannel - 1] || 0}</span>
          </div>
        ))}

        {/* Mode dropdown */}
        {modeChannels.map((ch) => (
          <div key={ch.dmxChannel} className="mode-control">
            <label>
              {ch.name} <small>(CH {ch.dmxChannel})</small>
            </label>
            <input
              type="range"
              className="horizontal-slider"
              min={0}
              max={255}
              step={1}
              value={channels[ch.dmxChannel - 1] || 0}
              onChange={(e) =>
                onChannelChange(ch.dmxChannel, parseInt(e.target.value, 10))
              }
            />
            <span className="slider-value">{channels[ch.dmxChannel - 1] || 0}</span>
          </div>
        ))}

        {/* Custom faders */}
        {customChannels.map((ch) => (
          <div key={ch.dmxChannel} className="channel-fader">
            <span className="channel-number">{ch.name}</span>
            <input
              type="range"
              className="vertical-fader"
              min={0}
              max={255}
              value={channels[ch.dmxChannel - 1] || 0}
              onChange={(e) =>
                onChannelChange(ch.dmxChannel, parseInt(e.target.value, 10))
              }
              // @ts-expect-error — orient is a non-standard attribute for vertical sliders
              orient="vertical"
            />
            <span className="channel-value">{channels[ch.dmxChannel - 1] || 0}</span>
            <span className="channel-label">CH {ch.dmxChannel}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
