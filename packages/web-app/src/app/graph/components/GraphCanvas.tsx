'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { GraphNode, GraphEdge, Viewport, SelectionState } from '../types';
import { render, drawSelectionRect, drawEdgePreview, drawShapePreview, drawSnapHighlight, drawSmartGuides } from '../engine/renderer';
import { resolveConnectorEndpoints, computeOrthogonalPath } from '../engine/connector';
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
  onContextMenu: (e: React.MouseEvent) => void;
  previewRef: React.RefObject<DragPreview>;
  hoverNodeIdRef: React.RefObject<string | undefined>;
  mouseWorldRef: React.RefObject<{ x: number; y: number }>;
  onDropImage?: (dataUrl: string, x: number, y: number, width: number, height: number) => void;
}

export function GraphCanvas({
  nodes, edges, viewport, selection, showGrid, canvasRef,
  onMouseDown, onMouseMove, onMouseUp, onWheel, onDoubleClick, onContextMenu,
  previewRef, hoverNodeIdRef, mouseWorldRef, onDropImage,
}: GraphCanvasProps) {
  const rafRef = useRef<number>(0);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resolvedEdges = edges.map(e => {
      if (e.type === 'connector' && e.from.nodeId && e.to.nodeId) {
        const fromNode = nodes.find(n => n.id === e.from.nodeId);
        const toNode = nodes.find(n => n.id === e.to.nodeId);
        if (fromNode && toNode) {
          const waypoints = computeOrthogonalPath(fromNode, toNode, 20, e.manualMidpoint);
          return { ...e, from: { ...e.from, ...waypoints[0] }, to: { ...e.to, ...waypoints[waypoints.length - 1] }, waypoints };
        }
        const pts = resolveConnectorEndpoints(e, nodes);
        return { ...e, from: { ...e.from, ...pts.from }, to: { ...e.to, ...pts.to } };
      }
      if (e.type === 'connector') {
        const pts = resolveConnectorEndpoints(e, nodes);
        return { ...e, from: { ...e.from, ...pts.from }, to: { ...e.to, ...pts.to } };
      }
      return e;
    });

    render(ctx, canvas.width, canvas.height, nodes, resolvedEdges, viewport, selection, showGrid, hoverNodeIdRef.current, mouseWorldRef.current.x, mouseWorldRef.current.y);

    // ドラッグプレビュー描画
    const preview = previewRef.current;
    if (preview.type !== 'none') {
      ctx.save();
      ctx.translate(viewport.offsetX, viewport.offsetY);
      ctx.scale(viewport.scale, viewport.scale);
      if (preview.type === 'edge' && preview.edgeType) {
        if (preview.snapNodeId) {
          const snapNode = nodes.find(n => n.id === preview.snapNodeId);
          if (snapNode) drawSnapHighlight(ctx, snapNode);
        }
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

    // スマートガイド描画
    if (preview.guides && preview.guides.length > 0) {
      ctx.save();
      ctx.translate(viewport.offsetX, viewport.offsetY);
      ctx.scale(viewport.scale, viewport.scale);
      drawSmartGuides(ctx, preview.guides);
      ctx.restore();
    }
  }, [canvasRef, nodes, edges, viewport, selection, showGrid, previewRef, hoverNodeIdRef, mouseWorldRef]);

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0 || !onDropImage || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          // アスペクト比を維持して最大300px幅に
          const maxW = 300;
          const scale = img.width > maxW ? maxW / img.width : 1;
          const w = img.width * scale;
          const h = img.height * scale;
          onDropImage(dataUrl, sx, sy, w, h);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  }, [canvasRef, onDropImage]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    />
  );
}
