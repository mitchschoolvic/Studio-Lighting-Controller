import React, { useCallback } from 'react';
import { FixtureCard } from './FixtureCard';
import type { Fixture } from '../types';

interface FixtureDrawerProps {
  fixture: Fixture | null;
  channels: number[];
  onChannelChange: (channel: number, value: number) => void;
  onModeChange?: (fixtureId: string, modeName: string) => void;
  onTriggerStart?: (channel: number) => void;
  onTriggerEnd?: (channel: number) => void;
  onRemoveFromCanvas?: (fixtureId: string) => void;
}

/**
 * FixtureDrawer — Always-visible left panel in Canvas View.
 * Shows fixture controls when a fixture is selected, placeholder when empty.
 * Fixed width so the layout never shifts.
 */
export const FixtureDrawer: React.FC<FixtureDrawerProps> = ({
  fixture,
  channels,
  onChannelChange,
  onModeChange,
  onTriggerStart,
  onTriggerEnd,
  onRemoveFromCanvas,
}) => {
  const handleRemove = useCallback(() => {
    if (fixture) {
      onRemoveFromCanvas?.(fixture.id);
    }
  }, [fixture, onRemoveFromCanvas]);

  return (
    <div className="fixture-drawer">
      {fixture && fixture.onCanvas ? (
        <>
          <div className="fixture-drawer-header">
            <h3>{fixture.name}</h3>
            <div className="fixture-drawer-actions">
              {onRemoveFromCanvas && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleRemove}
                  title="Remove from canvas"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="fixture-drawer-body">
            <FixtureCard
              fixture={fixture}
              channels={channels}
              onChannelChange={onChannelChange}
              onModeChange={onModeChange}
              onTriggerStart={onTriggerStart}
              onTriggerEnd={onTriggerEnd}
            />
          </div>
        </>
      ) : (
        <div className="fixture-drawer-placeholder">
          <div className="fixture-drawer-placeholder-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M16.36 7.64l1.42-1.42" />
            </svg>
          </div>
          <p className="fixture-drawer-placeholder-text">
            Tap a fixture to control its values
          </p>
        </div>
      )}
    </div>
  );
};
