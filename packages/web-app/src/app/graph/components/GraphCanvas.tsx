'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { GraphNode, GraphEdge, Viewport, SelectionState } from '../types';
import { render, drawSelectionRect, drawEdgePreview, drawShapePreview } from '../engine/renderer';
import { resolveConnectorEndpoints } from '../engine/connector';
import type { DragPreview } from '../hooks/useCanvasInteraction';

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: Viewport;
  selection: SelectionState;
  showGrid: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  previewRef: React.RefObject<DragPreview>;
}

export function GraphCanvas({
  nodes, edges, viewport, selection, showGrid, canvasRef,
  onMouseDown, onMouseMove, onMouseUp, onWheel, onDoubleClick, previewRef,
}: GraphCanvasProps) {
  const rafRef = useRef<number>(0);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resolvedEdges = edges.map(e => {
      if (e.type === 'connector') {
        const pts = resolveConnectorEndpoints(e, nodes);
        return { ...e, from: { ...e.from, ...pts.from }, to: { ...e.to, ...pts.to } };
      }
      return e;
    });

    render(ctx, canvas.width, canvas.height, nodes, resolvedEdges, viewport, selection, showGrid);

    // ドラッグプレビュー描画
    const preview = previewRef.current;
    if (preview.type !== 'none') {
      ctx.save();
      ctx.translate(viewport.offsetX, viewport.offsetY);
      ctx.scale(viewport.scale, viewport.scale);
      if (preview.type === 'edge' && preview.edgeType) {
        drawEdgePreview(ctx, preview.fromX, preview.fromY, preview.toX, preview.toY, preview.edgeType);
      } else if (preview.type === 'shape' && preview.shapeType) {
        drawShapePreview(ctx, preview.fromX, preview.fromY, preview.toX, preview.toY, preview.shapeType);
      } else if (preview.type === 'select-rect') {
        const x = Math.min(preview.fromX, preview.toX);
        const y = Math.min(preview.fromY, preview.toY);
        const w = Math.abs(preview.toX - preview.fromX);
        const h = Math.abs(preview.toY - preview.fromY);
        drawSelectionRect(ctx, x, y, w, h);
      }
      ctx.restore();
    }
  }, [canvasRef, nodes, edges, viewport, selection, showGrid, previewRef]);

  useEffect(() => {
    const loop = () => {
      renderFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderFrame]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', cursor: 'default' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
    />
  );
}
