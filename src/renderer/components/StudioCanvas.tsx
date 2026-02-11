import React, { useCallback, useRef } from 'react';
import { CanvasFixture } from './CanvasFixture';
import { getFixtureSize } from '../utils/fixtureLiveValues';
import type { Fixture } from '../types';

interface StudioCanvasProps {
  fixtures: Fixture[];
  channels: number[];
  master: number;
  selectedFixtureId: string | null;
  onSelectFixture: (fixtureId: string | null) => void;
  onUpdateFixture: (id: string, patch: Partial<Fixture>) => void;
  onDropFixture: (fixtureId: string, x: number, y: number) => void;
  editMode: boolean;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;

/**
 * StudioCanvas — The main SVG canvas where fixtures are arranged to represent the studio.
 * Handles fixture drop targets, background clicks, and coordinate mapping.
 */
export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  fixtures,
  channels,
  master,
  selectedFixtureId,
  onSelectFixture,
  onUpdateFixture,
  onDropFixture,
  editMode,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Only show fixtures that are placed on the canvas
  const canvasFixtures = fixtures.filter((f) => f.onCanvas && f.canvasLayout);

  // Handle background click — deselect
  const handleBackgroundClick = useCallback(() => {
    onSelectFixture(null);
  }, [onSelectFixture]);

  // Handle fixture move (local, high-frequency)
  const handleMove = useCallback(
    (fixtureId: string, x: number, y: number) => {
      // Clamp to canvas bounds
      const clampedX = Math.max(40, Math.min(CANVAS_WIDTH - 40, x));
      const clampedY = Math.max(40, Math.min(CANVAS_HEIGHT - 40, y));
      
      const fixture = fixtures.find((f) => f.id === fixtureId);
      if (!fixture?.canvasLayout) return;

      onUpdateFixture(fixtureId, {
        canvasLayout: {
          ...fixture.canvasLayout,
          x: clampedX,
          y: clampedY,
        },
      });
    },
    [fixtures, onUpdateFixture]
  );

  // Handle fixture rotation
  const handleRotate = useCallback(
    (fixtureId: string, rotation: number) => {
      const fixture = fixtures.find((f) => f.id === fixtureId);
      if (!fixture?.canvasLayout) return;

      onUpdateFixture(fixtureId, {
        canvasLayout: {
          ...fixture.canvasLayout,
          rotation,
        },
      });
    },
    [fixtures, onUpdateFixture]
  );

  // Handle fixture scale
  const handleScale = useCallback(
    (fixtureId: string, width: number, height: number) => {
      const fixture = fixtures.find((f) => f.id === fixtureId);
      if (!fixture?.canvasLayout) return;

      onUpdateFixture(fixtureId, {
        canvasLayout: {
          ...fixture.canvasLayout,
          width: Math.max(30, Math.min(200, width)),
          height: Math.max(20, Math.min(150, height)),
        },
      });
    },
    [fixtures, onUpdateFixture]
  );

  // Handle fixture select
  const handleSelect = useCallback(
    (fixtureId: string) => {
      onSelectFixture(fixtureId);
    },
    [onSelectFixture]
  );

  // --- Drop handling ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const fixtureId = e.dataTransfer.getData('text/fixture-id');
      if (!fixtureId) return;

      const svg = svgRef.current;
      if (!svg) return;

      // Convert drop position to SVG coordinates
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgPt = pt.matrixTransform(ctm.inverse());

      onDropFixture(fixtureId, svgPt.x, svgPt.y);
    },
    [onDropFixture]
  );

  return (
    <div
      className="studio-canvas-container"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <svg
        ref={svgRef}
        className="studio-canvas"
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={handleBackgroundClick}
      >
        {/* Grid pattern */}
        <defs>
          <pattern
            id="canvas-grid-small"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="0.5"
            />
          </pattern>
          <pattern
            id="canvas-grid-large"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <rect width="100" height="100" fill="url(#canvas-grid-small)" />
            <path
              d="M 100 0 L 0 0 0 100"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Background with grid */}
        <rect
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          fill="#2a2a2a"
          rx={8}
        />
        <rect
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          fill="url(#canvas-grid-large)"
          rx={8}
        />

        {/* "STUDIO" watermark */}
        <text
          x={CANVAS_WIDTH / 2}
          y={CANVAS_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="canvas-watermark"
        >
          STUDIO
        </text>

        {/* Fixtures */}
        {canvasFixtures.map((fixture) => (
          <CanvasFixture
            key={fixture.id}
            fixture={fixture}
            channels={channels}
            master={master}
            isSelected={selectedFixtureId === fixture.id}
            onSelect={handleSelect}
            onMove={handleMove}
            onRotate={handleRotate}
            onScale={handleScale}
            svgRef={svgRef}
            editMode={editMode}
          />
        ))}

        {/* Empty state hint */}
        {canvasFixtures.length === 0 && (
          <text
            x={CANVAS_WIDTH / 2}
            y={CANVAS_HEIGHT / 2 + 40}
            textAnchor="middle"
            dominantBaseline="central"
            className="canvas-empty-hint"
          >
            Drag fixtures from the panel to place them
          </text>
        )}
      </svg>
    </div>
  );
};
