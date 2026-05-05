import type { HeatmapAxis, HeatmapMatrix } from '@anytime-markdown/trail-core/c4';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { truncate } from '../canvasHelpers';
import { getC4Colors } from '../c4Theme';

const CELL = 24;
const ROW_HEADER = 160;
const COL_HEADER = 80;
const LEGEND_WIDTH = 60;
const FOOTER_HEIGHT = 28;
const COL_LABEL_ROTATION = -Math.PI / 4;

export type HeatmapColorScale = 'amber' | 'sumi';

export interface HeatmapCanvasProps {
  readonly matrix: HeatmapMatrix;
  readonly colorScale: HeatmapColorScale;
  readonly selectedElementId?: string | null;
  readonly onCellClick?: (column: HeatmapAxis) => void;
  readonly isDark?: boolean;
}

interface HoverState {
  readonly rowIndex: number;
  readonly colIndex: number;
  readonly value: number;
  readonly clientX: number;
  readonly clientY: number;
}

interface ColorBase {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly minAlpha: number;
  readonly maxAlpha: number;
}

const AMBER_BASE: ColorBase = { r: 232, g: 160, b: 18, minAlpha: 0.05, maxAlpha: 1.0 };
const SUMI_BASE: ColorBase = { r: 31, g: 30, b: 28, minAlpha: 0.08, maxAlpha: 0.85 };

function pickColorBase(scale: HeatmapColorScale): ColorBase {
  return scale === 'amber' ? AMBER_BASE : SUMI_BASE;
}

function cellColor(value: number, maxValue: number, base: ColorBase): string {
  if (value <= 0 || maxValue <= 0) return 'transparent';
  const t = Math.min(1, value / maxValue);
  const alpha = base.minAlpha + (base.maxAlpha - base.minAlpha) * t;
  return `rgba(${base.r}, ${base.g}, ${base.b}, ${alpha.toFixed(3)})`;
}

function gridColor(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
}

function textColor(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.78)' : 'rgba(0, 0, 0, 0.78)';
}

function selectionColor(isDark: boolean): string {
  return isDark ? '#7a8eff' : '#3554d1';
}

function drawColumnLabels(
  ctx: CanvasRenderingContext2D,
  columns: readonly HeatmapAxis[],
  isDark: boolean,
): void {
  ctx.save();
  ctx.fillStyle = textColor(isDark);
  ctx.font = '10px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < columns.length; i++) {
    const x = ROW_HEADER + i * CELL + CELL / 2;
    ctx.save();
    ctx.translate(x, COL_HEADER - 4);
    ctx.rotate(COL_LABEL_ROTATION);
    ctx.textAlign = 'left';
    ctx.fillText(truncate(columns[i].label, 18), 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawRowLabels(
  ctx: CanvasRenderingContext2D,
  rows: readonly HeatmapAxis[],
  isDark: boolean,
): void {
  ctx.save();
  ctx.fillStyle = textColor(isDark);
  ctx.font = '11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let i = 0; i < rows.length; i++) {
    const y = COL_HEADER + i * CELL + CELL / 2;
    ctx.fillText(truncate(rows[i].label, 22), ROW_HEADER - 6, y);
  }
  ctx.restore();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  rows: number,
  cols: number,
  isDark: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = gridColor(isDark);
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= rows; i++) {
    const y = COL_HEADER + i * CELL;
    ctx.beginPath();
    ctx.moveTo(ROW_HEADER, y);
    ctx.lineTo(ROW_HEADER + cols * CELL, y);
    ctx.stroke();
  }
  for (let j = 0; j <= cols; j++) {
    const x = ROW_HEADER + j * CELL;
    ctx.beginPath();
    ctx.moveTo(x, COL_HEADER);
    ctx.lineTo(x, COL_HEADER + rows * CELL);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCells(
  ctx: CanvasRenderingContext2D,
  matrix: HeatmapMatrix,
  base: ColorBase,
): void {
  const maxValue = Math.max(matrix.maxValue, 1);
  for (const cell of matrix.cells) {
    const x = ROW_HEADER + cell.colIndex * CELL;
    const y = COL_HEADER + cell.rowIndex * CELL;
    ctx.fillStyle = cellColor(cell.value, maxValue, base);
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
  }
}

function drawSelectionColumn(
  ctx: CanvasRenderingContext2D,
  matrix: HeatmapMatrix,
  selectedElementId: string | null | undefined,
  isDark: boolean,
): void {
  if (!selectedElementId) return;
  const colIndex = matrix.columns.findIndex((c) => c.id === selectedElementId);
  if (colIndex < 0) return;
  ctx.save();
  ctx.strokeStyle = selectionColor(isDark);
  ctx.lineWidth = 2;
  const x = ROW_HEADER + colIndex * CELL;
  const y = COL_HEADER;
  ctx.strokeRect(x, y, CELL, matrix.rows.length * CELL);
  ctx.restore();
}

function drawHoverHighlight(
  ctx: CanvasRenderingContext2D,
  matrix: HeatmapMatrix,
  hover: HoverState | null,
  isDark: boolean,
): void {
  if (!hover) return;
  ctx.save();
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  ctx.fillRect(ROW_HEADER, COL_HEADER + hover.rowIndex * CELL, matrix.columns.length * CELL, CELL);
  ctx.fillRect(ROW_HEADER + hover.colIndex * CELL, COL_HEADER, CELL, matrix.rows.length * CELL);
  ctx.restore();
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  base: ColorBase,
  rowsLen: number,
  cols: number,
  isDark: boolean,
): void {
  const x = ROW_HEADER + cols * CELL + 12;
  const y = COL_HEADER;
  const height = Math.max(120, rowsLen * CELL);
  const grad = ctx.createLinearGradient(0, y, 0, y + height);
  grad.addColorStop(0, `rgba(${base.r}, ${base.g}, ${base.b}, ${base.maxAlpha})`);
  grad.addColorStop(1, `rgba(${base.r}, ${base.g}, ${base.b}, ${base.minAlpha})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, 16, height);
  ctx.strokeStyle = gridColor(isDark);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, 16, height);
  ctx.fillStyle = textColor(isDark);
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('high', x + 20, y);
  ctx.fillText('low', x + 20, y + height - 10);
  ctx.restore();
}

function hitTest(
  matrix: HeatmapMatrix,
  cssX: number,
  cssY: number,
): { rowIndex: number; colIndex: number } | null {
  if (cssX < ROW_HEADER || cssY < COL_HEADER) return null;
  const colIndex = Math.floor((cssX - ROW_HEADER) / CELL);
  const rowIndex = Math.floor((cssY - COL_HEADER) / CELL);
  if (colIndex < 0 || colIndex >= matrix.columns.length) return null;
  if (rowIndex < 0 || rowIndex >= matrix.rows.length) return null;
  return { rowIndex, colIndex };
}

function findCellValue(matrix: HeatmapMatrix, rowIndex: number, colIndex: number): number {
  for (const cell of matrix.cells) {
    if (cell.rowIndex === rowIndex && cell.colIndex === colIndex) return cell.value;
  }
  return 0;
}

export function HeatmapCanvas({
  matrix,
  colorScale,
  selectedElementId,
  onCellClick,
  isDark = false,
}: Readonly<HeatmapCanvasProps>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const base = useMemo(() => pickColorBase(colorScale), [colorScale]);

  const cssWidth = ROW_HEADER + matrix.columns.length * CELL + LEGEND_WIDTH;
  const cssHeight = COL_HEADER + matrix.rows.length * CELL + FOOTER_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    drawHoverHighlight(ctx, matrix, hover, isDark);
    drawCells(ctx, matrix, base);
    drawGrid(ctx, matrix.rows.length, matrix.columns.length, isDark);
    drawColumnLabels(ctx, matrix.columns, isDark);
    drawRowLabels(ctx, matrix.rows, isDark);
    drawSelectionColumn(ctx, matrix, selectedElementId ?? null, isDark);
    drawLegend(ctx, base, matrix.rows.length, matrix.columns.length, isDark);
  }, [matrix, base, hover, isDark, selectedElementId, cssWidth, cssHeight]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      const hit = hitTest(matrix, cssX, cssY);
      if (!hit) {
        setHover(null);
        return;
      }
      setHover({
        rowIndex: hit.rowIndex,
        colIndex: hit.colIndex,
        value: findCellValue(matrix, hit.rowIndex, hit.colIndex),
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    [matrix],
  );

  const handleMouseLeave = useCallback(() => {
    setHover(null);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onCellClick) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      const hit = hitTest(matrix, cssX, cssY);
      if (!hit) return;
      onCellClick(matrix.columns[hit.colIndex]);
    },
    [matrix, onCellClick],
  );

  return (
    <div
      style={{ position: 'relative', overflow: 'auto', maxWidth: '100%', maxHeight: '100%' }}
      role="region"
      aria-label="Activity heatmap"
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ display: 'block', cursor: hover ? 'pointer' : 'default' }}
      />
      {hover && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: hover.clientX + 12,
            top: hover.clientY + 12,
            padding: '4px 8px',
            background: getC4Colors(isDark).heatmapTooltipBg,
            color: getC4Colors(isDark).heatmapTooltipText,
            border: `1px solid ${getC4Colors(isDark).heatmapTooltipBorder}`,
            borderRadius: 4,
            fontSize: 11,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {`${matrix.rows[hover.rowIndex].label} × ${matrix.columns[hover.colIndex].label}: ${hover.value}`}
        </div>
      )}
    </div>
  );
}
