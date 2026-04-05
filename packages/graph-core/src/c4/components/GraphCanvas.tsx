import type { GraphDocument, GraphNode, SelectionState, Viewport } from '../../types';
import { render, pan, zoom, screenToWorld, hitTestNode, drawSelectionRect } from '../../engine/index';
import type { Action } from '../../state/index';
import { useCallback, useEffect, useRef, useState } from 'react';

interface C4GraphCanvasProps {
  readonly document: GraphDocument;
  readonly viewport: Viewport;
  readonly dispatch: React.Dispatch<Action>;
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
  readonly selectedNodeId?: string | null;
  readonly onNodeSelect?: (nodeId: string | null) => void;
  readonly onNodeDoubleClick?: (nodeId: string) => void;
}

const EMPTY_SELECTION: SelectionState = { nodeIds: [], edgeIds: [] };
const PAN_STEP = 20;

const CANVAS_COLORS = {
  selectionRect: 'rgba(144, 202, 249, 0.15)',
  selectionRectStroke: 'rgba(144, 202, 249, 0.6)',
};

type DragMode = 'none' | 'pan' | 'select-rect';

export function GraphCanvas({ document, viewport, dispatch, canvasRef, selectedNodeId, onNodeSelect, onNodeDoubleClick }: Readonly<C4GraphCanvasProps>) {
  const rafRef = useRef<number>(0);
  const viewportRef = useRef(viewport);
  const dispatchRef = useRef(dispatch);
  const nodesRef = useRef(document.nodes);
  const [isFocused, setIsFocused] = useState(false);
  viewportRef.current = viewport;
  dispatchRef.current = dispatch;
  nodesRef.current = document.nodes;

  // Drag state
  const dragRef = useRef<{
    mode: DragMode;
    startScreenX: number;
    startScreenY: number;
    startWorldX: number;
    startWorldY: number;
  }>({ mode: 'none', startScreenX: 0, startScreenY: 0, startWorldX: 0, startWorldY: 0 });
  const selectRectRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Selection state (multiple node IDs for marquee)
  const selectionRef = useRef<string[]>(selectedNodeId ? [selectedNodeId] : []);
  useEffect(() => {
    selectionRef.current = selectedNodeId ? [selectedNodeId] : [];
  }, [selectedNodeId]);

  // Center on selected node
  useEffect(() => {
    if (!selectedNodeId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const node = document.nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    const vp = viewportRef.current;
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;
    const canvasCenterX = canvas.clientWidth / 2;
    const canvasCenterY = canvas.clientHeight / 2;

    dispatchRef.current({
      type: 'SET_VIEWPORT',
      viewport: {
        ...vp,
        offsetX: canvasCenterX - centerX * vp.scale,
        offsetY: canvasCenterY - centerY * vp.scale,
      },
    });
  }, [selectedNodeId, document.nodes, canvasRef]);

  // Resolve connector edges to line endpoints (simple center-to-center)
  const resolvedEdges = document.edges.map(e => {
    if (e.type === 'connector' && e.from.nodeId && e.to.nodeId) {
      const fromNode = document.nodes.find(n => n.id === e.from.nodeId);
      const toNode = document.nodes.find(n => n.id === e.to.nodeId);
      if (fromNode && toNode) {
        return {
          ...e,
          type: 'line' as const,
          from: { ...e.from, x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 },
          to: { ...e.to, x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 },
        };
      }
    }
    return e;
  });

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cvs = canvas;
    const context = ctx;

    function draw() {
      const w = cvs.clientWidth;
      const h = cvs.clientHeight;
      const dpr = globalThis.devicePixelRatio ?? 1;
      cvs.width = w * dpr;
      cvs.height = h * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sel = selectionRef.current;
      render({
        ctx: context,
        width: w,
        height: h,
        nodes: document.nodes,
        edges: resolvedEdges,
        viewport: viewportRef.current,
        selection: sel.length > 0 ? { nodeIds: sel, edgeIds: [] } : EMPTY_SELECTION,
        showGrid: false,
        isDark: true,
      });

      // Draw selection rectangle overlay
      const rect = selectRectRef.current;
      if (rect) {
        const vp = viewportRef.current;
        context.save();
        context.translate(vp.offsetX, vp.offsetY);
        context.scale(vp.scale, vp.scale);
        const x = Math.min(rect.x1, rect.x2);
        const y = Math.min(rect.y1, rect.y2);
        const rw = Math.abs(rect.x2 - rect.x1);
        const rh = Math.abs(rect.y2 - rect.y1);
        drawSelectionRect(context, x, y, rw, rh, CANVAS_COLORS);
        context.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [document.nodes, resolvedEdges, canvasRef]);

  // Find node at screen position
  const nodeAtScreen = useCallback((sx: number, sy: number): GraphNode | undefined => {
    const vp = viewportRef.current;
    const world = screenToWorld(vp, sx, sy);
    // Check in reverse order (top-most first), skip frames
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.type === 'frame') continue;
      if (hitTestNode(n, world.x, world.y)) return n;
    }
    return undefined;
  }, []);

  // Mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const vp = viewportRef.current;
    const world = screenToWorld(vp, sx, sy);

    // Middle button or right button → pan
    if (e.button === 1 || e.button === 2) {
      dragRef.current = { mode: 'pan', startScreenX: sx, startScreenY: sy, startWorldX: world.x, startWorldY: world.y };
      return;
    }

    // Left button
    if (e.button === 0) {
      const hit = nodeAtScreen(sx, sy);
      if (hit) {
        // Click on node → select it
        selectionRef.current = [hit.id];
        const c4Id = hit.metadata?.c4Id as string | undefined;
        onNodeSelect?.(c4Id ?? hit.id);
        dispatchRef.current({ type: 'SET_SELECTION', selection: { nodeIds: [hit.id], edgeIds: [] } });
        // Start pan so user can still drag to move view
        dragRef.current = { mode: 'pan', startScreenX: sx, startScreenY: sy, startWorldX: world.x, startWorldY: world.y };
      } else {
        // Click on empty area → start marquee selection
        if (!e.shiftKey) {
          selectionRef.current = [];
          onNodeSelect?.(null);
          dispatchRef.current({ type: 'SET_SELECTION', selection: EMPTY_SELECTION });
        }
        dragRef.current = { mode: 'select-rect', startScreenX: sx, startScreenY: sy, startWorldX: world.x, startWorldY: world.y };
        selectRectRef.current = { x1: world.x, y1: world.y, x2: world.x, y2: world.y };
      }
    }
  }, [canvasRef, nodeAtScreen, onNodeSelect]);

  // Mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (drag.mode === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (drag.mode === 'pan') {
      const dx = sx - drag.startScreenX;
      const dy = sy - drag.startScreenY;
      drag.startScreenX = sx;
      drag.startScreenY = sy;
      const newViewport = pan(viewportRef.current, dx, dy);
      dispatchRef.current({ type: 'SET_VIEWPORT', viewport: newViewport });
    }

    if (drag.mode === 'select-rect') {
      const vp = viewportRef.current;
      const world = screenToWorld(vp, sx, sy);
      selectRectRef.current = { x1: drag.startWorldX, y1: drag.startWorldY, x2: world.x, y2: world.y };
    }
  }, [canvasRef]);

  // Mouse up
  const handleMouseUp = useCallback(() => {
    const drag = dragRef.current;

    if (drag.mode === 'select-rect') {
      const r = selectRectRef.current;
      if (r) {
        const minX = Math.min(r.x1, r.x2);
        const maxX = Math.max(r.x1, r.x2);
        const minY = Math.min(r.y1, r.y2);
        const maxY = Math.max(r.y1, r.y2);
        if (maxX - minX > 2 || maxY - minY > 2) {
          const nodes = nodesRef.current;
          const selectedIds = nodes
            .filter(n => n.type !== 'frame' && n.x + n.width >= minX && n.x <= maxX && n.y + n.height >= minY && n.y <= maxY)
            .map(n => n.id);
          selectionRef.current = selectedIds;
          dispatchRef.current({ type: 'SET_SELECTION', selection: { nodeIds: selectedIds, edgeIds: [] } });
        }
      }
      selectRectRef.current = null;
    }

    dragRef.current = { mode: 'none', startScreenX: 0, startScreenY: 0, startWorldX: 0, startWorldY: 0 };
  }, []);

  // Double click
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const hit = nodeAtScreen(sx, sy);
    if (hit) {
      const c4Id = hit.metadata?.c4Id as string | undefined;
      onNodeDoubleClick?.(c4Id ?? hit.id);
    }
  }, [canvasRef, nodeAtScreen, onNodeDoubleClick]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const vp = viewportRef.current;
    switch (e.key) {
      case 'ArrowUp': {
        e.preventDefault();
        dispatchRef.current({ type: 'SET_VIEWPORT', viewport: pan(vp, 0, PAN_STEP) });
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        dispatchRef.current({ type: 'SET_VIEWPORT', viewport: pan(vp, 0, -PAN_STEP) });
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        dispatchRef.current({ type: 'SET_VIEWPORT', viewport: pan(vp, PAN_STEP, 0) });
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        dispatchRef.current({ type: 'SET_VIEWPORT', viewport: pan(vp, -PAN_STEP, 0) });
        break;
      }
      case '+':
      case '=': {
        e.preventDefault();
        dispatchRef.current({ type: 'SET_VIEWPORT', viewport: { ...vp, scale: vp.scale * 1.1 } });
        break;
      }
      case '-': {
        e.preventDefault();
        dispatchRef.current({ type: 'SET_VIEWPORT', viewport: { ...vp, scale: vp.scale * 0.9 } });
        break;
      }
    }
  }, []);

  // Zoom (non-passive listener, registered once)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const newViewport = zoom(viewportRef.current, cx, cy, e.deltaY);
      dispatchRef.current({ type: 'SET_VIEWPORT', viewport: newViewport });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasRef]);

  // Prevent context menu on right-click (used for pan)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const cursorStyle = dragRef.current.mode === 'select-rect' ? 'crosshair'
    : dragRef.current.mode === 'pan' ? 'grabbing' : 'default';

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      role="img"
      aria-roledescription="architecture diagram"
      aria-label={`C4 architecture graph with ${document.nodes.length} nodes`}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: cursorStyle,
        outline: 'none',
        boxShadow: isFocused ? 'inset 0 0 0 2px #4FC3F7' : 'none',
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    />
  );
}
