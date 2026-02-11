import React, { useState, useCallback, useMemo } from 'react';
import { StudioCanvas } from './StudioCanvas';
import { FixturePalette } from './FixturePalette';
import { FixtureDrawer } from './FixtureDrawer';
import { PresetGrid } from './PresetGrid';
import { getFixtureSize } from '../utils/fixtureLiveValues';
import type { Fixture } from '../types';
import type { Socket } from 'socket.io-client';

interface CanvasViewProps {
  fixtures: Fixture[];
  channels: number[];
  master: number;
  socket: Socket | null;
  onChannelChange: (channel: number, value: number) => void;
  onUpdateFixture: (id: string, patch: Partial<Fixture>) => void;
  onModeChange?: (fixtureId: string, modeName: string) => void;
  onTriggerStart?: (channel: number) => void;
  onTriggerEnd?: (channel: number) => void;
}

/**
 * CanvasView — The main canvas view layout.
 * Left: Always-visible control panel (fixture controls or placeholder).
 * Center: Studio Canvas + Presets.
 * Edit mode: Fixture palette overlays the canvas for drag-and-drop layout.
 */
export const CanvasView: React.FC<CanvasViewProps> = ({
  fixtures,
  channels,
  master,
  socket,
  onChannelChange,
  onUpdateFixture,
  onModeChange,
  onTriggerStart,
  onTriggerEnd,
}) => {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const selectedFixture = useMemo(
    () => (selectedFixtureId ? fixtures.find((f) => f.id === selectedFixtureId) || null : null),
    [fixtures, selectedFixtureId]
  );

  // Handle dropping a fixture onto the canvas
  const handleDropFixture = useCallback(
    (fixtureId: string, x: number, y: number) => {
      const fixture = fixtures.find((f) => f.id === fixtureId);
      if (!fixture) return;

      const size = getFixtureSize(fixture);
      onUpdateFixture(fixtureId, {
        onCanvas: true,
        canvasLayout: {
          x,
          y,
          rotation: 0,
          width: size.width,
          height: size.height,
        },
      });
      setSelectedFixtureId(fixtureId);
    },
    [fixtures, onUpdateFixture]
  );

  // Handle removing a fixture from the canvas
  const handleRemoveFromCanvas = useCallback(
    (fixtureId: string) => {
      onUpdateFixture(fixtureId, {
        onCanvas: false,
        canvasLayout: undefined,
      });
      if (selectedFixtureId === fixtureId) {
        setSelectedFixtureId(null);
      }
    },
    [onUpdateFixture, selectedFixtureId]
  );

  // Handle selecting/deselecting a fixture
  const handleSelectFixture = useCallback(
    (fixtureId: string | null) => {
      setSelectedFixtureId(fixtureId);
    },
    []
  );

  // Toggle edit mode and clear selection when switching
  const handleToggleEditMode = useCallback(() => {
    setEditMode((prev) => {
      if (!prev) setSelectedFixtureId(null); // entering edit mode — deselect
      return !prev;
    });
  }, []);

  return (
    <div className="canvas-view">
      <div className="canvas-view-main">
        {/* Left panel: Palette in edit mode, Controls in view mode */}
        {editMode ? (
          <div className="canvas-left-panel">
            <FixturePalette
              fixtures={fixtures}
              selectedFixtureId={selectedFixtureId}
              onRemoveFromCanvas={handleRemoveFromCanvas}
              onSelectFixture={(id) => setSelectedFixtureId(id)}
            />
          </div>
        ) : (
          <FixtureDrawer
            fixture={selectedFixture}
            channels={channels}
            onChannelChange={onChannelChange}
            onModeChange={onModeChange}
            onTriggerStart={onTriggerStart}
            onTriggerEnd={onTriggerEnd}
            onRemoveFromCanvas={handleRemoveFromCanvas}
          />
        )}

        {/* Center: Studio Canvas */}
        <div className="canvas-view-center">
          {/* Edit mode toggle */}
          <div className="canvas-toolbar">
            <button
              className={`canvas-edit-toggle ${editMode ? 'active' : ''}`}
              onClick={handleToggleEditMode}
              title={editMode ? 'Exit layout edit mode' : 'Edit studio layout'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              {editMode ? 'Done Editing' : 'Edit Layout'}
            </button>
          </div>

          <div className="canvas-area-wrapper">
            <StudioCanvas
              fixtures={fixtures}
              channels={channels}
              master={master}
              selectedFixtureId={selectedFixtureId}
              onSelectFixture={handleSelectFixture}
              onUpdateFixture={onUpdateFixture}
              onDropFixture={handleDropFixture}
              editMode={editMode}
            />
          </div>

          {/* Preset Grid below canvas */}
          <div className="canvas-view-presets">
            <PresetGrid socket={socket} />
          </div>
        </div>
      </div>
    </div>
  );
};
