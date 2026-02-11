import React, { useRef, useEffect, useCallback, useState } from 'react';
import { VerticalSlider } from './VerticalSlider';

interface ColorWheelProps {
  red: number;
  green: number;
  blue: number;
  onColorChange: (r: number, g: number, b: number) => void;
  colorMode?: 'rgb' | 'hsb';
  // HSB-specific props
  hsbValues?: { hue: number; saturation: number; brightness: number };
  onHSBChange?: (h: number, s: number, b: number) => void;
  // RGB-specific props (dimmer/sat sliders for RGB fixtures with extra channels)
  dimmerChannel?: number | null;
  saturationChannel?: number | null;
  onDimmerChange?: (value: number) => void;
  onSaturationChange?: (value: number) => void;
}

/**
 * ColorWheel — Hue-only donut picker with vertical dimmer and saturation sliders.
 * The donut ring shows pure hues at full saturation and brightness.
 * Dimmer and saturation are controlled via adjacent vertical sliders and applied to RGB output.
 */
export const ColorWheel: React.FC<ColorWheelProps> = ({
  red,
  green,
  blue,
  onColorChange,
  colorMode = 'rgb',
  hsbValues,
  onHSBChange,
  dimmerChannel,
  saturationChannel,
  onDimmerChange,
  onSaturationChange,
}) => {
  const isHSB = colorMode === 'hsb';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Internal state for dimmer and saturation (0-255)
  const [dimmer, setDimmer] = useState(() =>
    isHSB ? (hsbValues?.brightness ?? 255) : 255
  );
  const [saturation, setSaturation] = useState(() =>
    isHSB ? (hsbValues?.saturation ?? 255) : 255
  );
  // Internal hue for HSB mode (0-360)
  const [hsbHue, setHsbHue] = useState(() =>
    isHSB ? ((hsbValues?.hue ?? 0) / 255) * 360 : 0
  );
  
  // Track the last RGB we generated from our sliders to avoid sync loops
  const lastGeneratedRGB = useRef({ r: 0, g: 0, b: 0 });
  
  const size = 180;
  const radius = size / 2;
  const innerRadius = radius * 0.55; // donut hole
  const ringWidth = radius - innerRadius;

  // Sync internal state with incoming values
  useEffect(() => {
    if (isHSB && hsbValues) {
      // HSB mode: sync from DMX channel values
      setHsbHue((hsbValues.hue / 255) * 360);
      setSaturation(hsbValues.saturation);
      setDimmer(hsbValues.brightness);
    } else if (!isHSB) {
      // RGB mode: sync from incoming RGB values
      const isOwnChange = 
        lastGeneratedRGB.current.r === red &&
        lastGeneratedRGB.current.g === green &&
        lastGeneratedRGB.current.b === blue;
      
      if (isOwnChange) return;
      
      const [h, s, v] = rgbToHsv(red, green, blue);
      const satValue = Math.round(s * 255);
      const dimValue = Math.round(v * 255);
      
      setSaturation(satValue);
      setDimmer(dimValue);
      lastGeneratedRGB.current = { r: red, g: green, b: blue };
    }
  }, [red, green, blue, isHSB, hsbValues]);

  // Draw the hue donut
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - radius;
        const dy = y - radius;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Only draw pixels within the donut ring
        if (dist >= innerRadius && dist <= radius) {
          const angle = Math.atan2(dy, dx);
          const hue = ((angle * 180) / Math.PI + 360) % 360;

          // Full saturation, full value — pure hue ring
          const [r, g, b] = hsvToRgb(hue, 1, 1);
          const idx = (y * size + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Draw tick marks around the outer edge
    const tickCount = 48;
    const tickLength = 6;
    const tickStartRadius = radius + 1;
    const tickEndRadius = tickStartRadius + tickLength;

    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2;
      const x1 = radius + Math.cos(angle) * tickStartRadius;
      const y1 = radius + Math.sin(angle) * tickStartRadius;
      const x2 = radius + Math.cos(angle) * tickEndRadius;
      const y2 = radius + Math.sin(angle) * tickEndRadius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw indicator for current hue on the ring
    const currentHue = isHSB ? hsbHue : rgbToHsv(red, green, blue)[0];
    const indicatorAngle = (currentHue * Math.PI) / 180;
    const indicatorDist = innerRadius + ringWidth / 2; // middle of the ring
    const ix = radius + Math.cos(indicatorAngle) * indicatorDist;
    const iy = radius + Math.sin(indicatorAngle) * indicatorDist;

    ctx.beginPath();
    ctx.arc(ix, iy, ringWidth / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ix, iy, ringWidth / 2 - 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [red, green, blue, isHSB, hsbHue, size, radius, innerRadius, ringWidth]);

  const pickColor = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const dx = x - radius;
      const dy = y - radius;

      // Pick hue from angle
      const angle = Math.atan2(dy, dx);
      const hue = ((angle * 180) / Math.PI + 360) % 360;

      if (isHSB) {
        // HSB mode: send H, S, B as DMX values (0-255)
        setHsbHue(hue);
        const hDmx = Math.round((hue / 360) * 255);
        onHSBChange?.(hDmx, saturation, dimmer);
      } else {
        // RGB mode: convert HSV to RGB and send
        const sat = saturation / 255;
        const val = dimmer / 255;
        const [r, g, b] = hsvToRgb(hue, sat, val);
        lastGeneratedRGB.current = { r, g, b };
        onColorChange(r, g, b);
      }
    },
    [radius, onColorChange, onHSBChange, saturation, dimmer, isHSB]
  );

  // Handle dimmer slider change
  const handleDimmerChange = useCallback(
    (value: number) => {
      setDimmer(value);

      if (isHSB) {
        // HSB mode: send updated brightness directly as DMX
        const hDmx = Math.round((hsbHue / 360) * 255);
        onHSBChange?.(hDmx, saturation, value);
      } else {
        // RGB mode: recalculate RGB with new dimmer
        if (onDimmerChange) onDimmerChange(value);
        const [h] = rgbToHsv(red, green, blue);
        const sat = saturation / 255;
        const val = value / 255;
        const [r, g, b] = hsvToRgb(h, sat, val);
        lastGeneratedRGB.current = { r, g, b };
        onColorChange(r, g, b);
      }
    },
    [red, green, blue, saturation, hsbHue, isHSB, onColorChange, onDimmerChange, onHSBChange]
  );

  // Handle saturation slider change
  const handleSaturationChange = useCallback(
    (value: number) => {
      setSaturation(value);

      if (isHSB) {
        // HSB mode: send updated saturation directly as DMX
        const hDmx = Math.round((hsbHue / 360) * 255);
        onHSBChange?.(hDmx, value, dimmer);
      } else {
        // RGB mode: recalculate RGB with new saturation
        if (onSaturationChange) onSaturationChange(value);
        const [h] = rgbToHsv(red, green, blue);
        const sat = value / 255;
        const val = dimmer / 255;
        const [r, g, b] = hsvToRgb(h, sat, val);
        lastGeneratedRGB.current = { r, g, b };
        onColorChange(r, g, b);
      }
    },
    [red, green, blue, dimmer, hsbHue, isHSB, onColorChange, onSaturationChange, onHSBChange]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = e.clientX - rect.left - radius;
      const dy = e.clientY - rect.top - radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Only start dragging if click is within the ring
      if (dist >= innerRadius && dist <= radius) {
        setIsDragging(true);
        pickColor(e.clientX, e.clientY);
      }
    },
    [pickColor, innerRadius, radius]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        pickColor(e.clientX, e.clientY);
      }
    },
    [isDragging, pickColor]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const dx = touch.clientX - rect.left - radius;
      const dy = touch.clientY - rect.top - radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= innerRadius && dist <= radius) {
        setIsDragging(true);
        pickColor(touch.clientX, touch.clientY);
      }
    },
    [pickColor, innerRadius, radius]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (isDragging) {
        const touch = e.touches[0];
        pickColor(touch.clientX, touch.clientY);
      }
    },
    [isDragging, pickColor]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Compute the current effective color for the preview swatch
  const currentHue = isHSB ? hsbHue : rgbToHsv(red, green, blue)[0];
  const [previewR, previewG, previewB] = hsvToRgb(
    currentHue,
    saturation / 255,
    dimmer / 255
  );

  return (
    <div className="color-wheel-wrapper">
      {/* Dimmer / Brightness slider */}
      <VerticalSlider
        label={isHSB ? 'Brt.' : 'Dim.'}
        value={dimmer}
        min={0}
        max={255}
        onChange={handleDimmerChange}
        showPercentage
      />

      {/* Saturation slider */}
      <VerticalSlider
        label="Sat."
        value={saturation}
        min={0}
        max={255}
        onChange={handleSaturationChange}
        showPercentage
      />

      {/* Hue donut */}
      <div className="color-wheel-container">
        <div className="color-wheel-label">Color</div>
        <canvas
          ref={canvasRef}
          className="color-wheel-canvas"
          width={size}
          height={size}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <div
          className="color-preview"
          style={{
            backgroundColor: `rgb(${previewR}, ${previewG}, ${previewB})`,
          }}
        />
        <div className="color-values">
          {isHSB ? (
            <>
              <span>H:{hsbValues?.hue ?? 0}</span>
              <span>S:{hsbValues?.saturation ?? 0}</span>
              <span>B:{hsbValues?.brightness ?? 0}</span>
            </>
          ) : (
            <>
              <span>R:{red}</span>
              <span>G:{green}</span>
              <span>B:{blue}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Convert HSV to RGB (all values 0–255 for output).
 */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Convert RGB (0–255) to HSV (h: 0–360, s: 0–1, v: 0–1).
 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return [h, s, v];
}
