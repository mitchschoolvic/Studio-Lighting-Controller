import React, { useCallback, useRef, useState, useMemo } from 'react';
import type { Fixture } from '../types';
import { computeLiveValues, formatLiveValueLines, getFixtureSize } from '../utils/fixtureLiveValues';

interface CanvasFixtureProps {
  fixture: Fixture;
  channels: number[];
  master: number;
  isSelected: boolean;
  editMode: boolean;
  onSelect: (fixtureId: string) => void;
  onMove: (fixtureId: string, x: number, y: number) => void;
  onRotate: (fixtureId: string, rotation: number) => void;
  onScale: (fixtureId: string, width: number, height: number) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

/**
 * CanvasFixture — An SVG group representing a fixture on the studio canvas.
 * Edit mode: drag-to-move, rotation handle, corner scale handles.
 * View mode: click to select (for controls panel), no drag/transform.
 */
export const CanvasFixture: React.FC<CanvasFixtureProps> = ({
  fixture,
  channels,
  master,
  isSelected,
  editMode,
  onSelect,
  onMove,
  onRotate,
  onScale,
  svgRef,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isScaling, setIsScaling] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const scaleCorner = useRef<string>('');
  const scaleStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const layout = fixture.canvasLayout;
  if (!layout) return null;

  const defaultSize = getFixtureSize(fixture);
  const w = layout.width || defaultSize.width;
  const h = layout.height || defaultSize.height;
  const cx = layout.x;
  const cy = layout.y;

  // Compute live display values
  const liveValues = useMemo(
    () => computeLiveValues(fixture, channels, master),
    [fixture, channels, master]
  );
  const displayLines = useMemo(() => formatLiveValueLines(liveValues), [liveValues]);

  // Convert screen coordinates to SVG coordinates
  const screenToSVG = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: clientX, y: clientY };
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: clientX, y: clientY };
      const svgPt = pt.matrixTransform(ctm.inverse());
      return { x: svgPt.x, y: svgPt.y };
    },
    [svgRef]
  );

  // --- Drag to move (edit mode only) ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isRotating || isScaling) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect(fixture.id);

      if (!editMode) return; // View mode: select only, no drag

      const svgPt = screenToSVG(e.clientX, e.clientY);
      dragOffset.current = { x: svgPt.x - cx, y: svgPt.y - cy };
      setIsDragging(true);

      const target = e.currentTarget as SVGElement;
      target.setPointerCapture(e.pointerId);
    },
    [fixture.id, cx, cy, onSelect, screenToSVG, isRotating, isScaling, editMode]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const svgPt = screenToSVG(e.clientX, e.clientY);
      const newX = svgPt.x - dragOffset.current.x;
      const newY = svgPt.y - dragOffset.current.y;
      onMove(fixture.id, newX, newY);
    },
    [isDragging, fixture.id, onMove, screenToSVG]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging) {
        setIsDragging(false);
        const target = e.currentTarget as SVGElement;
        target.releasePointerCapture(e.pointerId);
      }
    },
    [isDragging]
  );

  // --- Rotation handle (edit mode only) ---
  const handleRotateDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsRotating(true);
      const target = e.currentTarget as SVGElement;
      target.setPointerCapture(e.pointerId);
    },
    []
  );

  const handleRotateMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isRotating) return;
      const svgPt = screenToSVG(e.clientX, e.clientY);
      const angle = Math.atan2(svgPt.y - cy, svgPt.x - cx) * (180 / Math.PI) + 90;
      const normalized = ((angle % 360) + 360) % 360;
      onRotate(fixture.id, Math.round(normalized));
    },
    [isRotating, fixture.id, cx, cy, onRotate, screenToSVG]
  );

  const handleRotateUp = useCallback(
    (e: React.PointerEvent) => {
      setIsRotating(false);
      const target = e.currentTarget as SVGElement;
      target.releasePointerCapture(e.pointerId);
    },
    []
  );

  // --- Scale handles (edit mode only) ---
  const handleScaleDown = useCallback(
    (e: React.PointerEvent, corner: string) => {
      e.stopPropagation();
      e.preventDefault();
      setIsScaling(true);
      scaleCorner.current = corner;
      const svgPt = screenToSVG(e.clientX, e.clientY);
      scaleStart.current = { x: svgPt.x, y: svgPt.y, w, h };
      const target = e.currentTarget as SVGElement;
      target.setPointerCapture(e.pointerId);
    },
    [screenToSVG, w, h]
  );

  const handleScaleMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isScaling) return;
      const svgPt = screenToSVG(e.clientX, e.clientY);
      const dx = svgPt.x - scaleStart.current.x;
      const dy = svgPt.y - scaleStart.current.y;
      const corner = scaleCorner.current;

      let newW = scaleStart.current.w;
      let newH = scaleStart.current.h;

      // Scale based on which corner is being dragged
      if (corner.includes('r')) newW += dx * 2; // *2 because fixture is centered
      if (corner.includes('l')) newW -= dx * 2;
      if (corner.includes('b')) newH += dy * 2;
      if (corner.includes('t')) newH -= dy * 2;

      onScale(fixture.id, Math.round(newW), Math.round(newH));
    },
    [isScaling, fixture.id, onScale, screenToSVG]
  );

  const handleScaleUp = useCallback(
    (e: React.PointerEvent) => {
      setIsScaling(false);
      const target = e.currentTarget as SVGElement;
      target.releasePointerCapture(e.pointerId);
    },
    []
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(fixture.id);
    },
    [fixture.id, onSelect]
  );

  // Handle positions
  const rotateHandleDistance = h / 2 + 20;
  const HANDLE_SIZE = 6;

  // --- Text orientation & label fit logic ---
  // Text is always counter-rotated to stay upright. If it can't fit inside
  // the fixture body, it moves to an external label on the back (top edge,
  // opposite the light source which emits from the bottom).
  const rotation = layout.rotation || 0;
  const CHAR_WIDTH = 7;
  const LINE_HEIGHT = 14;
  const nameTextWidth = fixture.name.length * CHAR_WIDTH;
  const valueTextWidths = displayLines.map((l: string) => l.length * CHAR_WIDTH);
  const maxTextWidth = Math.max(nameTextWidth, ...valueTextWidths, 30);
  const textLineCount = 1 + displayLines.length;
  const totalTextHeight = textLineCount * LINE_HEIGHT;

  // When counter-rotated, the axis-aligned text bounding box in the
  // fixture's local (rotated) coordinate system expands:
  const rotRad = (rotation * Math.PI) / 180;
  const cosR = Math.abs(Math.cos(rotRad));
  const sinR = Math.abs(Math.sin(rotRad));
  const neededW = maxTextWidth * cosR + totalTextHeight * sinR;
  const neededH = maxTextWidth * sinR + totalTextHeight * cosR;

  const TEXT_PAD = 12;
  const textFitsInside = (neededW + TEXT_PAD) <= w && (neededH + TEXT_PAD) <= h;

  // External label metrics
  const LABEL_GAP = 10;
  const LABEL_PAD_X = 8;
  const LABEL_PAD_Y = 5;
  const labelW = maxTextWidth + LABEL_PAD_X * 2;
  const labelH = totalTextHeight + LABEL_PAD_Y * 2;
  const labelY = -h / 2 - LABEL_GAP - labelH / 2;  // back (top) of fixture

  // --- Barn door & glow cone geometry ---
  // All lights emit from the bottom edge in local coordinates.
  // User rotates the fixture to aim light in the desired direction.
  const BARN_LENGTH = Math.max(12, h * 0.25);   // barn door length scales with fixture
  const BARN_WIDTH = 4;                          // thickness of each barn door
  const BARN_ANGLE = 5;                          // inward angle at barn door tip
  const GLOW_DEPTH = Math.max(45, h * 0.8);     // how far glow cone extends
  const GLOW_CONE_SPREAD = w * 0.35;            // how much wider than fixture at far edge
  const GLOW_BLUR = 14;                         // Gaussian blur stdDeviation

  const barnTipInset = BARN_WIDTH + BARN_ANGLE;
  const coneTop = h / 2;
  const coneBottom = h / 2 + GLOW_DEPTH;
  const coneTopLeft = -w / 2 + barnTipInset;
  const coneTopRight = w / 2 - barnTipInset;
  const coneBottomLeft = -w / 2 - GLOW_CONE_SPREAD;
  const coneBottomRight = w / 2 + GLOW_CONE_SPREAD;

  const glowFilterId = `glow-blur-${fixture.id}`;
  const glowGradId = `glow-grad-${fixture.id}`;
  const glowClipId = `glow-clip-${fixture.id}`;

  // Corner handle positions (in local coords, fixture centered at 0,0)
  const corners = [
    { id: 'tl', x: -w / 2, y: -h / 2, cursor: 'nwse-resize' },
    { id: 'tr', x: w / 2, y: -h / 2, cursor: 'nesw-resize' },
    { id: 'bl', x: -w / 2, y: h / 2, cursor: 'nesw-resize' },
    { id: 'br', x: w / 2, y: h / 2, cursor: 'nwse-resize' },
  ];

  const showHandles = editMode && isSelected;

  return (
    <g
      className={`canvas-fixture ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${editMode ? 'edit-mode' : 'view-mode'}`}
      transform={`translate(${cx}, ${cy}) rotate(${layout.rotation || 0})`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      style={{ cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
    >
      {/* SVG defs: glow blur filter, gradient, and cone clip */}
      <defs>
        <filter id={glowFilterId} x="-100%" y="-50%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={GLOW_BLUR} />
        </filter>
        <linearGradient
          id={glowGradId}
          gradientUnits="userSpaceOnUse"
          x1="0" y1={coneTop}
          x2="0" y2={coneBottom}
        >
          <stop offset="0%" stopColor={liveValues.glowColor} stopOpacity={0.8} />
          <stop offset="50%" stopColor={liveValues.glowColor} stopOpacity={0.35} />
          <stop offset="100%" stopColor={liveValues.glowColor} stopOpacity={0} />
        </linearGradient>
        <clipPath id={glowClipId}>
          <polygon points={`${coneTopLeft},${coneTop} ${coneTopRight},${coneTop} ${coneBottomRight},${coneBottom} ${coneBottomLeft},${coneBottom}`} />
        </clipPath>
      </defs>

      {/* Glow cone — gradient fill, blurred, clipped to trapezoid */}
      <g clipPath={`url(#${glowClipId})`}>
        <rect
          x={coneBottomLeft - GLOW_BLUR * 2}
          y={coneTop - GLOW_BLUR}
          width={(coneBottomRight - coneBottomLeft) + GLOW_BLUR * 4}
          height={GLOW_DEPTH + GLOW_BLUR * 3}
          fill={`url(#${glowGradId})`}
          opacity={(isSelected ? 0.9 : 0.65) * liveValues.glowIntensity}
          filter={`url(#${glowFilterId})`}
          className="canvas-fixture-glow"
        />
      </g>

      {/* Barn doors — angled flaps at fixture bottom edge */}
      <polygon
        points={`${-w / 2},${h / 2} ${-w / 2 + BARN_WIDTH},${h / 2} ${-w / 2 + barnTipInset},${h / 2 + BARN_LENGTH} ${-w / 2},${h / 2 + BARN_LENGTH}`}
        className="canvas-fixture-barn-door"
      />
      <polygon
        points={`${w / 2},${h / 2} ${w / 2 - BARN_WIDTH},${h / 2} ${w / 2 - barnTipInset},${h / 2 + BARN_LENGTH} ${w / 2},${h / 2 + BARN_LENGTH}`}
        className="canvas-fixture-barn-door"
      />

      {/* Main body */}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={6}
        ry={6}
        className="canvas-fixture-body"
      />

      {/* Text — always upright; inside fixture or external label on back */}
      {textFitsInside ? (
        /* Counter-rotate so text stays upright inside the fixture body */
        <g transform={`rotate(${-rotation})`}>
          <text
            x={0}
            y={displayLines.length > 0 ? -6 : 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="canvas-fixture-label"
          >
            {fixture.name}
          </text>
          {displayLines.map((line, i) => (
            <text
              key={i}
              x={0}
              y={8 + i * 14}
              textAnchor="middle"
              dominantBaseline="central"
              className="canvas-fixture-value"
            >
              {line}
            </text>
          ))}
        </g>
      ) : (
        /* External label on the back (top) of the fixture */
        <g transform={`translate(0, ${labelY})`}>
          <g transform={`rotate(${-rotation})`}>
            {/* Label background */}
            <rect
              x={-labelW / 2}
              y={-labelH / 2}
              width={labelW}
              height={labelH}
              rx={4}
              ry={4}
              className="canvas-fixture-ext-label-bg"
            />
            {/* Connector line from label to fixture (in upright coords) */}
            <line
              x1={0}
              y1={labelH / 2}
              x2={0}
              y2={labelH / 2 + LABEL_GAP}
              className="canvas-fixture-ext-label-line"
            />
            <text
              x={0}
              y={displayLines.length > 0 ? -totalTextHeight / 2 + LINE_HEIGHT / 2 : 0}
              textAnchor="middle"
              dominantBaseline="central"
              className="canvas-fixture-label"
            >
              {fixture.name}
            </text>
            {displayLines.map((line, i) => (
              <text
                key={i}
                x={0}
                y={-totalTextHeight / 2 + LINE_HEIGHT / 2 + (i + 1) * LINE_HEIGHT}
                textAnchor="middle"
                dominantBaseline="central"
                className="canvas-fixture-value"
              >
                {line}
              </text>
            ))}
          </g>
        </g>
      )}

      {/* Edit mode handles (rotation + scale corners) */}
      {showHandles && (
        <>
          {/* Rotation handle line */}
          <line
            x1={0}
            y1={-h / 2}
            x2={0}
            y2={-rotateHandleDistance}
            stroke="var(--accent-glow)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            className="rotation-line"
          />

          {/* Rotation handle circle */}
          <circle
            cx={0}
            cy={-rotateHandleDistance}
            r={7}
            className="rotation-handle"
            onPointerDown={handleRotateDown}
            onPointerMove={handleRotateMove}
            onPointerUp={handleRotateUp}
            onPointerCancel={handleRotateUp}
            style={{ cursor: 'crosshair' }}
          />

          {/* Rotation icon */}
          <text
            x={0}
            y={-rotateHandleDistance}
            textAnchor="middle"
            dominantBaseline="central"
            className="rotation-icon"
            style={{ pointerEvents: 'none', fontSize: 9 }}
          >
            ↻
          </text>

          {/* Corner scale handles */}
          {corners.map((corner) => (
            <rect
              key={corner.id}
              x={corner.x - HANDLE_SIZE / 2}
              y={corner.y - HANDLE_SIZE / 2}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              className="scale-handle"
              onPointerDown={(e) => handleScaleDown(e, corner.id)}
              onPointerMove={handleScaleMove}
              onPointerUp={handleScaleUp}
              onPointerCancel={handleScaleUp}
              style={{ cursor: corner.cursor }}
            />
          ))}
        </>
      )}
    </g>
  );
};
