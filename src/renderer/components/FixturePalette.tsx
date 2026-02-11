import React, { useCallback } from 'react';
import type { Fixture } from '../types';

interface FixturePaletteProps {
  fixtures: Fixture[];
  selectedFixtureId: string | null;
  onRemoveFromCanvas?: (fixtureId: string) => void;
  onSelectFixture?: (fixtureId: string) => void;
}

/**
 * FixturePalette — A panel listing fixtures not yet placed on the canvas.
 * Items are draggable onto the StudioCanvas.
 */
export const FixturePalette: React.FC<FixturePaletteProps> = ({
  fixtures,
  selectedFixtureId,
  onRemoveFromCanvas,
  onSelectFixture,
}) => {
  // Fixtures NOT on the canvas
  const unplacedFixtures = fixtures.filter((f) => !f.onCanvas);
  // Fixtures ON the canvas (shown as a placed-list)
  const placedFixtures = fixtures.filter((f) => f.onCanvas);

  const handleDragStart = useCallback(
    (e: React.DragEvent, fixtureId: string) => {
      e.dataTransfer.setData('text/fixture-id', fixtureId);
      e.dataTransfer.effectAllowed = 'copy';
    },
    []
  );


  return (
    <div className="fixture-palette">
      <div className="fixture-palette-header">
        <h3>Fixtures</h3>
        <span className="fixture-palette-count">
          {placedFixtures.length}/{fixtures.length} placed
        </span>
      </div>

      {/* Unplaced fixtures — draggable */}
      {unplacedFixtures.length > 0 && (
        <div className="fixture-palette-section">
          <div className="fixture-palette-section-label">Available</div>
          {unplacedFixtures.map((fixture) => (
            <div
              key={fixture.id}
              className="fixture-palette-item"
              draggable
              onDragStart={(e) => handleDragStart(e, fixture.id)}
              title={`Drag "${fixture.name}" onto the canvas`}
            >
              <div className="fixture-palette-item-icon">
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect
                    x="3"
                    y="5"
                    width="14"
                    height="10"
                    rx="2"
                    fill="none"
                    stroke="var(--text-secondary)"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <div className="fixture-palette-item-info">
                <span className="fixture-palette-item-name">{fixture.name}</span>
                <span className="fixture-palette-item-type">{fixture.type}</span>
              </div>
              <div className="fixture-palette-drag-hint">⠿</div>
            </div>
          ))}
        </div>
      )}

      {/* Placed fixtures — listed for reference */}
      {placedFixtures.length > 0 && (
        <div className="fixture-palette-section">
          <div className="fixture-palette-section-label">On Canvas</div>
          {placedFixtures.map((fixture) => (
            <div
              key={fixture.id}
              className={`fixture-palette-item placed ${selectedFixtureId === fixture.id ? 'active' : ''}`}
              onClick={() => onSelectFixture?.(fixture.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="fixture-palette-item-icon on-canvas">
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <rect
                    x="3"
                    y="5"
                    width="14"
                    height="10"
                    rx="2"
                    fill="var(--accent-glow)"
                    fillOpacity="0.3"
                    stroke="var(--accent-glow)"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <div className="fixture-palette-item-info">
                <span className="fixture-palette-item-name">{fixture.name}</span>
                <span className="fixture-palette-item-type">{fixture.type}</span>
              </div>
              {onRemoveFromCanvas ? (
                <button
                  className="fixture-palette-remove"
                  title="Remove from canvas"
                  onClick={() => onRemoveFromCanvas(fixture.id)}
                >✕</button>
              ) : (
                <span className="fixture-palette-check">✓</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {fixtures.length === 0 && (
        <div className="fixture-palette-empty">
          <p>No fixtures configured</p>
          <p className="fixture-palette-empty-hint">
            Create fixtures in the Fixtures &amp; Channels view
          </p>
        </div>
      )}
    </div>
  );
};
