import React, { useState, useCallback, useRef, useEffect } from 'react';

interface MomentaryButtonProps {
  label: string;
  dmxChannel: number;
  icon?: string;
  onPress: (channel: number) => void;
  onRelease: (channel: number) => void;
}

/**
 * MomentaryButton — Press-and-hold sends 255, release sends 0.
 * Handles mouse, touch, and edge cases (mouse leaving while held).
 */
export const MomentaryButton: React.FC<MomentaryButtonProps> = ({
  label,
  dmxChannel,
  icon,
  onPress,
  onRelease,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const isPressedRef = useRef(false);

  const handlePress = useCallback(() => {
    if (!isPressedRef.current) {
      isPressedRef.current = true;
      setIsPressed(true);
      onPress(dmxChannel);
    }
  }, [dmxChannel, onPress]);

  const handleRelease = useCallback(() => {
    if (isPressedRef.current) {
      isPressedRef.current = false;
      setIsPressed(false);
      onRelease(dmxChannel);
    }
  }, [dmxChannel, onRelease]);

  // Global mouseup/touchend listener to catch releases outside the button
  useEffect(() => {
    const handleGlobalUp = () => {
      if (isPressedRef.current) {
        handleRelease();
      }
    };

    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    window.addEventListener('touchcancel', handleGlobalUp);

    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
      window.removeEventListener('touchcancel', handleGlobalUp);
    };
  }, [handleRelease]);

  return (
    <div className="momentary-button-container">
      <button
        className={`momentary-button ${isPressed ? 'pressed' : ''}`}
        onMouseDown={handlePress}
        onTouchStart={(e) => {
          e.preventDefault();
          handlePress();
        }}
        aria-label={`${label} trigger`}
      >
        {icon ? (
          <img src={icon} alt="" className="momentary-icon-img" />
        ) : (
          <span className="momentary-icon">⚡</span>
        )}
      </button>
      <span className="momentary-label">{label}</span>
    </div>
  );
};
