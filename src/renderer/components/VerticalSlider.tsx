import React, { useRef, useCallback, useState } from 'react';

interface VerticalSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  showPercentage?: boolean;
  variant?: 'default' | 'warm';
  kelvinRange?: { min: number; max: number };
}

/**
 * VerticalSlider — Custom vertical slider with filled bar indicator.
 * More reliable than native range inputs with orient="vertical".
 */
/**
 * Convert Kelvin color temperature to RGB approximation.
 */
function kelvinToRgb(kelvin: number): { r: number; g: number; b: number } {
  const temp = kelvin / 100;
  let r: number, g: number, b: number;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    r = Math.max(0, Math.min(255, r));
  }

  // Green
  if (temp <= 66) {
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    g = Math.max(0, Math.min(255, g));
  } else {
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    g = Math.max(0, Math.min(255, g));
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = temp - 10;
    b = 138.5177312231 * Math.log(b) - 305.0447927307;
    b = Math.max(0, Math.min(255, b));
  }

  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

export const VerticalSlider: React.FC<VerticalSliderProps> = ({
  label,
  value,
  min = 0,
  max = 255,
  onChange,
  showPercentage = false,
  variant = 'default',
  kelvinRange,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateValueFromPosition = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const y = clientY - rect.top;
      const percentage = Math.max(0, Math.min(1, 1 - y / rect.height));
      const newValue = Math.round(min + percentage * (max - min));
      onChange(newValue);
    },
    [min, max, onChange]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      updateValueFromPosition(e.clientY);
    },
    [updateValueFromPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        updateValueFromPosition(e.clientY);
      }
    },
    [isDragging, updateValueFromPosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      setIsDragging(true);
      updateValueFromPosition(e.touches[0].clientY);
    },
    [updateValueFromPosition]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (isDragging) {
        updateValueFromPosition(e.touches[0].clientY);
      }
    },
    [isDragging, updateValueFromPosition]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const percentage = Math.round(((value - min) / (max - min)) * 100);

  // Calculate Kelvin value if kelvinRange is provided
  const kelvinValue = kelvinRange
    ? Math.round(kelvinRange.min + ((value - min) / (max - min)) * (kelvinRange.max - kelvinRange.min))
    : null;

  // Calculate dynamic color for temperature slider
  const fillStyle: React.CSSProperties = { height: `${percentage}%` };
  if (variant === 'warm' && kelvinValue) {
    const rgb = kelvinToRgb(kelvinValue);
    fillStyle.background = `linear-gradient(to top, rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95))`;
  }

  return (
    <div className="vertical-slider">
      <div className="vertical-slider-label">{label}</div>
      <div
        ref={trackRef}
        className={`vertical-slider-track ${variant === 'warm' ? 'vertical-slider-track--warm' : ''}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={`vertical-slider-fill ${variant === 'warm' ? 'vertical-slider-fill--warm' : ''}`}
          style={fillStyle}
        />
      </div>
      <div className="vertical-slider-value">
        {kelvinValue ? `${kelvinValue}K` : showPercentage ? `${percentage}%` : value}
      </div>
    </div>
  );
};
