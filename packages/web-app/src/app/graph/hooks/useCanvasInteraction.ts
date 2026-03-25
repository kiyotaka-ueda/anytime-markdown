'use client';

import { useCallback, useRef, useEffect } from 'react';
import { ToolType, GraphNode, GraphEdge, Viewport, SelectionState, createNode, createEdge } from '../types';
import { screenToWorld } from '../engine/viewport';
import { hitTest, HitResult, ResizeHandle } from '../engine/hitTest';
import { pan as panViewport, zoom as zoomViewport } from '../engine/viewport';
import { snapToGrid } from '../engine/gridSnap';
import { computeSmartGuides, GuideLine } from '../engine/smartGuide';
import { computeOrthogonalPath } from '../engine/connector';

/** edges に waypoints を付与して hitTest で使えるようにする */
function resolveEdgesWithWaypoints(edges: GraphEdge[], nodes: GraphNode[]): (GraphEdge & { waypoints?: { x: number; y: number }[] })[] {
  return edges.map(e => {
    if (e.type === 'connector' && e.from.nodeId && e.to.nodeId) {
      const fromNode = nodes.find(n => n.id === e.from.nodeId);
      const toNode = nodes.find(n => n.id === e.to.nodeId);
      if (fromNode && toNode) {
        const waypoints = computeOrthogonalPath(fromNode, toNode, 20, e.manualMidpoint);
        return { ...e, waypoints };
      }
    }
    return e;
  });
}

interface DragState {
  type: 'none' | 'pan' | 'move' | 'resize' | 'create-shape' | 'select-rect' | 'create-edge' | 'move-edge-segment';
  startWorldX: number;
  startWorldY: number;
  startScreenX: number;
  startScreenY: number;
  handle?: ResizeHandle;
  nodeId?: string;
  edgeId?: string;
  segmentDirection?: 'horizontal' | 'vertical';
  endpointEnd?: 'from' | 'to';
  fromConnectionPoint?: boolean;
  initialMidpoint?: number;
  initialNodes?: Map<string, { x: number; y: number; width: number; height: number }>;
}

interface UseCanvasInteractionProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  tool: ToolType;
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: Viewport;
  selection: SelectionState;
  dispatch: React.Dispatch<any>;
  onTextEdit: (nodeId: string) => void;
  onToolChange: (tool: ToolType) => void;
  showGrid: boolean;
  onLiveMessage?: (message: string) => void;
}

export interface DragPreview {
  type: 'none' | 'edge' | 'shape' | 'select-rect';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  shapeType?: 'rect' | 'ellipse' | 'sticky' | 'text' | 'diamond' | 'parallelogram' | 'cylinder' | 'insight' | 'doc' | 'frame';
  edgeType?: 'line' | 'arrow' | 'connector';
  /** ドラッグ中にスナップしているノードID */
  snapNodeId?: string;
  /** スマートガイドライン */
  guides?: GuideLine[];
}

const EMPTY_PREVIEW: DragPreview = { type: 'none', fromX: 0, fromY: 0, toX: 0, toY: 0 };

// ---- Module-level pure helper functions ----

function buildEdgeEndpointDrag(
  hit: HitResult,
  edges: GraphEdge[],
  sx: number, sy: number,
): DragState | null {
  if (hit.type !== 'edge-endpoint' || !hit.id || !hit.endpointEnd) return null;
  const edge = edges.find(ed => ed.id === hit.id);
  if (!edge) return null;
  const endpoint = hit.endpointEnd === 'from' ? edge.from : edge.to;
  return {
    type: 'create-edge', startWorldX: endpoint.x, startWorldY: endpoint.y,
    startScreenX: sx, startScreenY: sy,
    edgeId: hit.id, endpointEnd: hit.endpointEnd,
    nodeId: hit.endpointEnd === 'from' ? edge.to.nodeId : edge.from.nodeId,
  };
}

function buildConnectionPointDrag(
  hit: HitResult,
  nodes: GraphNode[],
  sx: number, sy: number,
): DragState | null {
  if (hit.type !== 'connection-point' || !hit.id) return null;
  const node = nodes.find(n => n.id === hit.id);
  if (!node) return null;
  const cpMap = {
    top: { x: node.x + node.width / 2, y: node.y },
    right: { x: node.x + node.width, y: node.y + node.height / 2 },
    bottom: { x: node.x + node.width / 2, y: node.y + node.height },
    left: { x: node.x, y: node.y + node.height / 2 },
  };
  const cp = cpMap[hit.connectionSide!];
  return {
    type: 'create-edge', startWorldX: cp.x, startWorldY: cp.y,
    startScreenX: sx, startScreenY: sy, nodeId: hit.id,
    fromConnectionPoint: true,
  };
}

function buildResizeDrag(
  hit: HitResult,
  nodes: GraphNode[],
  world: { x: number; y: number },
  sx: number, sy: number,
): DragState | null {
  if (hit.type !== 'resize-handle' || !hit.id || !hit.handle) return null;
  const node = nodes.find(n => n.id === hit.id);
  if (!node || node.locked) return null;
  return {
    type: 'resize', startWorldX: world.x, startWorldY: world.y,
    startScreenX: sx, startScreenY: sy, handle: hit.handle, nodeId: hit.id,
    initialNodes: new Map([[node.id, { x: node.x, y: node.y, width: node.width, height: node.height }]]),
  };
}

function buildNodeSelectedIds(
  hitId: string,
  nodes: GraphNode[],
  selection: SelectionState,
  shiftKey: boolean,
): string[] {
  const isSelected = selection.nodeIds.includes(hitId);
  let selectedIds: string[];
  if (shiftKey) {
    selectedIds = isSelected
      ? selection.nodeIds.filter(id => id !== hitId)
      : [...selection.nodeIds, hitId];
  } else {
    selectedIds = isSelected ? selection.nodeIds : [hitId];
  }

  // グループ展開
  const groupIds = new Set(nodes.filter(n => selectedIds.includes(n.id) && n.groupId).map(n => n.groupId));
  if (groupIds.size > 0) {
    nodes.forEach(n => { if (n.groupId && groupIds.has(n.groupId)) selectedIds.push(n.id); });
    selectedIds = [...new Set(selectedIds)];
  }

  // フレーム選択時: 内部ノードも移動対象に含める
  const frameNodes = nodes.filter(n => selectedIds.includes(n.id) && n.type === 'frame');
  for (const frame of frameNodes) {
    nodes.forEach(n => {
      if (n.id !== frame.id && n.type !== 'frame' &&
          n.x >= frame.x && n.y >= frame.y &&
          n.x + n.width <= frame.x + frame.width &&
          n.y + n.height <= frame.y + frame.height) {
        selectedIds.push(n.id);
      }
    });
  }
  return [...new Set(selectedIds)];
}

const RESIZE_CURSORS: Record<string, string> = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
};

function getCursorForHit(hit: HitResult, nodes: GraphNode[], ctrlKey: boolean): string {
  if (hit.type === 'resize-handle' && hit.handle) return RESIZE_CURSORS[hit.handle] ?? 'default';
  if (hit.type === 'edge-endpoint') return 'crosshair';
  if (hit.type === 'connection-point') return 'crosshair';
  if (hit.type === 'edge-segment') return hit.segmentDirection === 'vertical' ? 'ew-resize' : 'ns-resize';
  if (hit.type === 'node') {
    const hitNode = nodes.find(n => n.id === hit.id);
    return ctrlKey && hitNode?.url ? 'pointer' : 'move';
  }
  if (hit.type === 'edge') return 'pointer';
  return 'default';
}

function getCursorForDragState(
  drag: DragState,
  hoverNodeIdRef: React.MutableRefObject<string | undefined>,
): string | null {
  if (drag.type === 'move') { hoverNodeIdRef.current = undefined; return 'grabbing'; }
  if (drag.type === 'resize') { hoverNodeIdRef.current = undefined; return null; }
  if (drag.type === 'pan') { hoverNodeIdRef.current = undefined; return 'grabbing'; }
  if (drag.type === 'create-edge') { hoverNodeIdRef.current = undefined; return 'crosshair'; }
  if (drag.type === 'create-shape') { hoverNodeIdRef.current = undefined; return 'crosshair'; }
  if (drag.type !== 'none') { hoverNodeIdRef.current = undefined; }
  return null;
}

function dispatchCreateEdge(
  drag: DragState,
  world: { x: number; y: number },
  tool: ToolType,
  nodes: GraphNode[],
  edges: GraphEdge[],
  viewport: Viewport,
  dispatch: React.Dispatch<any>,
  onTextEdit: (nodeId: string) => void,
  onToolChange: (tool: ToolType) => void,
): void {
  const hit = hitTest({ nodes, edges, wx: world.x, wy: world.y, scale: viewport.scale, selectedNodeIds: [] });
  const edgeType: 'line' | 'arrow' | 'connector' =
    (tool === 'line' || tool === 'arrow' || tool === 'connector') ? tool : 'connector';
  const dist = Math.hypot(world.x - drag.startWorldX, world.y - drag.startWorldY);

  if (drag.edgeId && drag.endpointEnd) {
    const targetNodeId = hit.type === 'node' ? hit.id : undefined;
    if (drag.endpointEnd === 'from') {
      dispatch({ type: 'UPDATE_EDGE', id: drag.edgeId, changes: {
        from: { nodeId: targetNodeId, x: world.x, y: world.y },
        to: { nodeId: drag.nodeId, x: drag.startWorldX, y: drag.startWorldY },
        manualMidpoint: undefined,
      } });
    } else {
      dispatch({ type: 'UPDATE_EDGE', id: drag.edgeId, changes: {
        from: { nodeId: drag.nodeId, x: drag.startWorldX, y: drag.startWorldY },
        to: { nodeId: targetNodeId, x: world.x, y: world.y },
        manualMidpoint: undefined,
      } });
    }
  } else if (dist > 5) {
    dispatchNewEdgeFromDrag(drag, hit, world, edgeType, tool, nodes, dispatch, onTextEdit);
  }
  onToolChange('select');
}

function dispatchNewEdgeFromDrag(
  drag: DragState,
  hit: HitResult,
  world: { x: number; y: number },
  edgeType: 'line' | 'arrow' | 'connector',
  tool: ToolType,
  nodes: GraphNode[],
  dispatch: React.Dispatch<any>,
  onTextEdit: (nodeId: string) => void,
): void {
  if (hit.type === 'node' && hit.id) {
    const edge = createEdge(
      edgeType,
      { nodeId: drag.nodeId, x: drag.startWorldX, y: drag.startWorldY },
      { nodeId: hit.id, x: world.x, y: world.y },
    );
    dispatch({ type: 'ADD_EDGE', edge });
    return;
  }
  if (!drag.fromConnectionPoint && (tool === 'line' || tool === 'arrow' || tool === 'connector')) {
    const edge = createEdge(
      edgeType,
      { nodeId: drag.nodeId, x: drag.startWorldX, y: drag.startWorldY },
      { x: world.x, y: world.y },
    );
    dispatch({ type: 'ADD_EDGE', edge });
    return;
  }
  if (drag.fromConnectionPoint) {
    dispatchChildNodeFromConnectionPoint(drag, world, edgeType, nodes, dispatch, onTextEdit);
  }
}

function dispatchChildNodeFromConnectionPoint(
  drag: DragState,
  world: { x: number; y: number },
  edgeType: 'line' | 'arrow' | 'connector',
  nodes: GraphNode[],
  dispatch: React.Dispatch<any>,
  onTextEdit: (nodeId: string) => void,
): void {
  const parentNode = drag.nodeId ? nodes.find(n => n.id === drag.nodeId) : undefined;
  const childType = parentNode?.type === 'sticky' ? 'sticky'
    : parentNode?.type === 'insight' ? 'insight'
    : parentNode?.type === 'ellipse' ? 'ellipse'
    : 'rect';
  const childW = 150;
  const childH = childType === 'insight' ? 140 : 100;
  const child = createNode(childType, world.x - childW / 2, world.y - childH / 2, {
    width: childW,
    height: childH,
  });
  const edge = createEdge(
    edgeType,
    { nodeId: drag.nodeId, x: drag.startWorldX, y: drag.startWorldY },
    { nodeId: child.id, x: world.x, y: world.y },
  );
  dispatch({ type: 'ADD_NODE', node: child });
  dispatch({ type: 'ADD_EDGE', edge });
  onTextEdit(child.id);
}

function handleCtrlKey(
  e: KeyboardEvent,
  nodes: GraphNode[],
  dispatch: React.Dispatch<any>,
  copySelected: () => void,
  pasteFromClipboard: () => Promise<void>,
  onLiveMessage?: (message: string) => void,
): void {
  if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); onLiveMessage?.('undo'); return; }
  if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); dispatch({ type: 'REDO' }); onLiveMessage?.('redo'); return; }
  if (e.key === 'g' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'GROUP_SELECTED', groupId: crypto.randomUUID() }); return; }
  if (e.key === 'g' && e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNGROUP_SELECTED' }); return; }
  if (e.key === 'a') {
    e.preventDefault();
    dispatch({ type: 'SET_SELECTION', selection: { nodeIds: nodes.map(n => n.id), edgeIds: [] } });
    return;
  }
  if (e.key === 'c') { e.preventDefault(); copySelected(); return; }
  if (e.key === 'v') { e.preventDefault(); pasteFromClipboard(); }
}

export function useCanvasInteraction({
  canvasRef, tool, nodes, edges, viewport, selection, dispatch, onTextEdit, onToolChange, showGrid, onLiveMessage,
}: UseCanvasInteractionProps) {
  const dragRef = useRef<DragState>({
    type: 'none', startWorldX: 0, startWorldY: 0, startScreenX: 0, startScreenY: 0,
  });
  const spaceRef = useRef(false);
  const previewRef = useRef<DragPreview>({ ...EMPTY_PREVIEW });
  const clipboardRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const hoverNodeIdRef = useRef<string | undefined>(undefined);
  const mouseWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cursorRef = useRef<string>('default');
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const panHistoryRef = useRef<{ x: number; y: number; t: number }[]>([]);

  const getWorldPos = useCallback((e: MouseEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(viewport, e.clientX - rect.left, e.clientY - rect.top);
  }, [canvasRef, viewport]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(viewport, sx, sy);

    if (spaceRef.current || e.button === 1 || tool === 'pan') {
      dragRef.current = { type: 'pan', startWorldX: 0, startWorldY: 0, startScreenX: sx, startScreenY: sy };
      return;
    }

    if (tool === 'select') {
      handleSelectToolMouseDown(e, world, sx, sy, nodes, edges, viewport, selection, hoverNodeIdRef, dragRef, previewRef, dispatch);
      return;
    }

    if (['rect', 'ellipse', 'sticky', 'text', 'diamond', 'parallelogram', 'cylinder', 'insight', 'doc', 'frame'].includes(tool)) {
      dragRef.current = {
        type: 'create-shape', startWorldX: world.x, startWorldY: world.y,
        startScreenX: sx, startScreenY: sy,
      };
      return;
    }

    if (['line', 'arrow', 'connector'].includes(tool)) {
      const hit = hitTest({ nodes, edges, wx: world.x, wy: world.y, scale: viewport.scale, selectedNodeIds: [] });
      dragRef.current = {
        type: 'create-edge', startWorldX: world.x, startWorldY: world.y,
        startScreenX: sx, startScreenY: sy,
        nodeId: hit.type === 'node' ? hit.id : undefined,
      };
      return;
    }
  }, [canvasRef, viewport, tool, nodes, edges, selection, dispatch]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const drag = dragRef.current;

    // ツール別デフォルトカーソル（ドラッグ中でないとき）
    if (drag.type === 'none') {
      if (tool === 'pan') {
        cursorRef.current = 'grab';
      } else if (['rect', 'ellipse', 'sticky', 'text', 'diamond', 'parallelogram', 'cylinder', 'insight', 'doc', 'line', 'arrow', 'connector'].includes(tool)) {
        cursorRef.current = 'crosshair';
      }
    }

    // ホバーノード検出 + カーソル更新（ドラッグ中でないとき）
    if (drag.type === 'none' && tool === 'select') {
      const world = screenToWorld(viewport, sx, sy);
      mouseWorldRef.current = world;
      const resolved = resolveEdgesWithWaypoints(edges, nodes);
      const fullHit = hitTest({ nodes, edges: resolved, wx: world.x, wy: world.y, scale: viewport.scale, selectedNodeIds: selection.nodeIds, selectedEdgeIds: selection.edgeIds });
      const hoverHit = hitTest({ nodes, edges: resolved, wx: world.x, wy: world.y, scale: viewport.scale, selectedNodeIds: [] });
      hoverNodeIdRef.current = hoverHit.type === 'node' ? hoverHit.id : undefined;
      cursorRef.current = getCursorForHit(fullHit, nodes, e.ctrlKey || e.metaKey);
    } else {
      const cursor = getCursorForDragState(drag, hoverNodeIdRef);
      if (cursor !== null) cursorRef.current = cursor;
    }

    // カーソルをcanvasに反映
    if (canvasRef.current) {
      canvasRef.current.style.cursor = cursorRef.current;
    }

    if (drag.type === 'pan') {
      const dx = sx - drag.startScreenX;
      const dy = sy - drag.startScreenY;
      dispatch({ type: 'SET_VIEWPORT', viewport: panViewport(viewport, dx, dy) });
      dragRef.current = { ...drag, startScreenX: sx, startScreenY: sy };
      const now = performance.now();
      panHistoryRef.current.push({ x: sx, y: sy, t: now });
      if (panHistoryRef.current.length > 3) panHistoryRef.current.shift();
      return;
    }

    if (drag.type === 'move' && drag.initialNodes) {
      const world = screenToWorld(viewport, sx, sy);
      const dx = world.x - drag.startWorldX;
      const dy = world.y - drag.startWorldY;
      const ids = [...drag.initialNodes.keys()];

      if (!showGrid && ids.length > 0) {
        const draggedInits = ids.map(id => ({ id, init: drag.initialNodes!.get(id)! }));
        const bboxX = Math.min(...draggedInits.map(d => d.init.x + dx));
        const bboxY = Math.min(...draggedInits.map(d => d.init.y + dy));
        const bboxRight = Math.max(...draggedInits.map(d => d.init.x + dx + d.init.width));
        const bboxBottom = Math.max(...draggedInits.map(d => d.init.y + dy + d.init.height));
        const otherRects = nodes
          .filter(n => !drag.initialNodes!.has(n.id))
          .map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height }));
        const result = computeSmartGuides(bboxX, bboxY, bboxRight - bboxX, bboxBottom - bboxY, otherRects, 5);
        const snapDx = result.snappedX - bboxX;
        const snapDy = result.snappedY - bboxY;
        const snapUpdates = ids.map(id => {
          const init = drag.initialNodes!.get(id)!;
          return { id, x: init.x + dx + snapDx, y: init.y + dy + snapDy };
        });
        dispatch({ type: 'SET_NODE_POSITIONS', updates: snapUpdates });
        previewRef.current = { type: 'none', fromX: 0, fromY: 0, toX: 0, toY: 0, guides: result.guides };
      } else {
        const moveUpdates = ids.map(id => {
          const init = drag.initialNodes!.get(id)!;
          return {
            id,
            x: showGrid ? snapToGrid(init.x + dx) : init.x + dx,
            y: showGrid ? snapToGrid(init.y + dy) : init.y + dy,
          };
        });
        dispatch({ type: 'SET_NODE_POSITIONS', updates: moveUpdates });
        previewRef.current = { type: 'none', fromX: 0, fromY: 0, toX: 0, toY: 0 };
      }
      return;
    }

    if (drag.type === 'resize' && drag.nodeId && drag.handle && drag.initialNodes) {
      const world = screenToWorld(viewport, sx, sy);
      const init = drag.initialNodes.get(drag.nodeId)!;
      const MIN = 20;
      const resized = computeResize(init, drag.handle, world.x, world.y, drag.startWorldX, drag.startWorldY);
      const x = showGrid ? snapToGrid(resized.x) : resized.x;
      const y = showGrid ? snapToGrid(resized.y) : resized.y;
      const width = showGrid ? Math.max(MIN, snapToGrid(resized.width)) : resized.width;
      const height = showGrid ? Math.max(MIN, snapToGrid(resized.height)) : resized.height;
      dispatch({ type: 'RESIZE_NODE', id: drag.nodeId, x, y, width, height });
      return;
    }

    if (drag.type === 'move-edge-segment' && drag.edgeId) {
      const world = screenToWorld(viewport, sx, sy);
      const newMidpoint = drag.segmentDirection === 'vertical' ? world.x : world.y;
      dispatch({ type: 'UPDATE_EDGE', id: drag.edgeId, changes: { manualMidpoint: newMidpoint } });
      return;
    }

    if (drag.type === 'create-edge') {
      const world = screenToWorld(viewport, sx, sy);
      const hit = hitTest({ nodes, edges, wx: world.x, wy: world.y, scale: viewport.scale, selectedNodeIds: [] });
      previewRef.current = {
        type: 'edge',
        fromX: drag.startWorldX, fromY: drag.startWorldY,
        toX: world.x, toY: world.y,
        edgeType: (tool === 'line' || tool === 'arrow' || tool === 'connector') ? tool : 'connector',
        snapNodeId: hit.type === 'node' ? hit.id : undefined,
      };
      return;
    }

    if (drag.type === 'create-shape') {
      const world = screenToWorld(viewport, sx, sy);
      previewRef.current = {
        type: 'shape',
        fromX: drag.startWorldX, fromY: drag.startWorldY,
        toX: world.x, toY: world.y,
        shapeType: tool as 'rect' | 'ellipse' | 'sticky' | 'text' | 'diamond' | 'parallelogram' | 'cylinder' | 'insight' | 'doc' | 'frame',
      };
      return;
    }

    if (drag.type === 'select-rect') {
      const world = screenToWorld(viewport, sx, sy);
      previewRef.current = {
        type: 'select-rect',
        fromX: drag.startWorldX, fromY: drag.startWorldY,
        toX: world.x, toY: world.y,
      };
      return;
    }
  }, [canvasRef, viewport, tool, nodes, edges, selection, dispatch, showGrid]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(viewport, sx, sy);
    const drag = dragRef.current;

    if (drag.type === 'create-shape') {
      const w = Math.abs(world.x - drag.startWorldX);
      const h = Math.abs(world.y - drag.startWorldY);
      let x = Math.min(world.x, drag.startWorldX);
      let y = Math.min(world.y, drag.startWorldY);
      let fw = Math.max(w, 80);
      let fh = Math.max(h, (tool as string) === 'text' ? 30 : 50);
      if (showGrid) {
        x = snapToGrid(x);
        y = snapToGrid(y);
        fw = snapToGrid(fw);
        fh = snapToGrid(fh);
      }
      const nodeType = tool as 'rect' | 'ellipse' | 'sticky' | 'text' | 'diamond' | 'parallelogram' | 'cylinder' | 'insight' | 'doc' | 'frame';
      const node = createNode(nodeType, x, y, { width: fw, height: fh });
      dispatch({ type: 'ADD_NODE', node });
      onToolChange('select');
    }

    if (drag.type === 'create-edge') {
      dispatchCreateEdge(drag, world, tool, nodes, edges, viewport, dispatch, onTextEdit, onToolChange);
    }

    if (drag.type === 'select-rect') {
      const minX = Math.min(drag.startWorldX, world.x);
      const maxX = Math.max(drag.startWorldX, world.x);
      const minY = Math.min(drag.startWorldY, world.y);
      const maxY = Math.max(drag.startWorldY, world.y);
      if (maxX - minX > 2 || maxY - minY > 2) {
        const selectedIds = nodes
          .filter(n => n.x + n.width >= minX && n.x <= maxX && n.y + n.height >= minY && n.y <= maxY)
          .map(n => n.id);
        dispatch({ type: 'SET_SELECTION', selection: { nodeIds: selectedIds, edgeIds: [] } });
      }
    }

    if (drag.type === 'pan') {
      const history = panHistoryRef.current;
      if (history.length >= 2) {
        const first = history[0];
        const last = history[history.length - 1];
        const dt = last.t - first.t;
        if (dt > 0 && dt < 100) {
          velocityRef.current = {
            vx: (last.x - first.x) / dt * 16,
            vy: (last.y - first.y) / dt * 16,
          };
        }
      }
      panHistoryRef.current = [];
    }

    dragRef.current = { type: 'none', startWorldX: 0, startWorldY: 0, startScreenX: 0, startScreenY: 0 };
    previewRef.current = { ...EMPTY_PREVIEW };
  }, [canvasRef, viewport, tool, nodes, edges, dispatch, showGrid]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    dispatch({ type: 'SET_VIEWPORT', viewport: zoomViewport(viewport, sx, sy, e.deltaY) });
  }, [canvasRef, viewport, dispatch]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const world = getWorldPos(e as unknown as MouseEvent);
    const hit = hitTest({ nodes, edges, wx: world.x, wy: world.y, scale: viewport.scale, selectedNodeIds: selection.nodeIds });
    if (hit.type === 'node' && hit.id) {
      onTextEdit(hit.id);
    }
  }, [getWorldPos, nodes, edges, viewport, selection, onTextEdit]);

  const copySelected = useCallback(() => {
    if (selection.nodeIds.length === 0) return;
    const selectedSet = new Set(selection.nodeIds);
    const copiedNodes: GraphNode[] = JSON.parse(JSON.stringify(nodes.filter(n => selectedSet.has(n.id))));
    const copiedEdges: GraphEdge[] = JSON.parse(JSON.stringify(
      edges.filter(edge => selectedSet.has(edge.from.nodeId ?? '') && selectedSet.has(edge.to.nodeId ?? '')),
    ));
    clipboardRef.current = { nodes: copiedNodes, edges: copiedEdges };
    try {
      const data = JSON.stringify({ type: 'anytime-graph', nodes: copiedNodes, edges: copiedEdges });
      navigator.clipboard.writeText(data).catch(() => {/* ignore clipboard errors */});
    } catch {
      // Clipboard API not available, internal clipboard still works
    }
  }, [selection.nodeIds, nodes, edges]);

  const pasteFromClipboard = useCallback(async () => {
    const doPaste = (sourceNodes: GraphNode[], sourceEdges: GraphEdge[]) => {
      const idMap = new Map<string, string>();
      const newNodes = sourceNodes.map(n => {
        const newId = crypto.randomUUID();
        idMap.set(n.id, newId);
        return { ...n, id: newId, x: n.x + 20, y: n.y + 20 };
      });
      const newEdges = sourceEdges.map(edge => ({
        ...edge,
        id: crypto.randomUUID(),
        from: { ...edge.from, nodeId: edge.from.nodeId ? idMap.get(edge.from.nodeId) : undefined },
        to: { ...edge.to, nodeId: edge.to.nodeId ? idMap.get(edge.to.nodeId) : undefined },
      }));
      dispatch({ type: 'PASTE_NODES', nodes: newNodes, edges: newEdges });
      return {
        nodes: sourceNodes.map(n => ({ ...n, x: n.x + 20, y: n.y + 20 })),
        edges: sourceEdges,
      };
    };

    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (parsed?.type === 'anytime-graph' && Array.isArray(parsed.nodes)) {
        const updated = doPaste(parsed.nodes, parsed.edges ?? []);
        clipboardRef.current = updated;
        try {
          const data = JSON.stringify({ type: 'anytime-graph', nodes: updated.nodes, edges: updated.edges });
          navigator.clipboard.writeText(data).catch(() => {/* ignore */});
        } catch {
          // ignore
        }
        return;
      }
    } catch {
      // Fall through to internal clipboard
    }

    if (!clipboardRef.current) return;
    clipboardRef.current = doPaste(clipboardRef.current.nodes, clipboardRef.current.edges);
  }, [dispatch]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      spaceRef.current = true;
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      dispatch({ type: 'SET_SELECTION', selection: { nodeIds: [], edgeIds: [] } });
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && (selection.nodeIds.length > 0 || selection.edgeIds.length > 0)) {
      e.preventDefault();
      const hasLocked = selection.nodeIds.some(id => nodes.find(n => n.id === id)?.locked);
      if (hasLocked) {
        const unlocked = selection.nodeIds.filter(id => !nodes.find(n => n.id === id)?.locked);
        dispatch({ type: 'SET_SELECTION', selection: { nodeIds: unlocked, edgeIds: selection.edgeIds } });
      }
      dispatch({ type: 'DELETE_SELECTED' });
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      handleCtrlKey(e, nodes, dispatch, copySelected, pasteFromClipboard, onLiveMessage);
    }
  }, [canvasRef, selection, nodes, dispatch, copySelected, pasteFromClipboard, onLiveMessage]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      spaceRef.current = false;
      if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    }
  }, [canvasRef]);

  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (dragRef.current.type !== 'none') {
        dragRef.current = { type: 'none', startWorldX: 0, startWorldY: 0, startScreenX: 0, startScreenY: 0 };
        previewRef.current = { ...EMPTY_PREVIEW };
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleDoubleClick,
    dragRef,
    previewRef,
    clipboardRef,
    hoverNodeIdRef,
    mouseWorldRef,
    cursorRef,
    velocityRef,
    copySelected,
    pasteFromClipboard,
  };
}

/** select ツール時の mousedown ハンドラ（module-level helper） */
function handleSelectToolMouseDown(
  e: React.MouseEvent,
  world: { x: number; y: number },
  sx: number, sy: number,
  nodes: GraphNode[],
  edges: GraphEdge[],
  viewport: Viewport,
  selection: SelectionState,
  hoverNodeIdRef: React.MutableRefObject<string | undefined>,
  dragRef: React.MutableRefObject<DragState>,
  previewRef: React.MutableRefObject<DragPreview>,
  dispatch: React.Dispatch<any>,
): void {
  const resolved = resolveEdgesWithWaypoints(edges, nodes);
  const hit = hitTest({ nodes, edges: resolved, wx: world.x, wy: world.y, scale: viewport.scale, selectedNodeIds: selection.nodeIds, hoverNodeId: hoverNodeIdRef.current, selectedEdgeIds: selection.edgeIds });

  const edgeDrag = buildEdgeEndpointDrag(hit, edges, sx, sy);
  if (edgeDrag) {
    dispatch({ type: 'SNAPSHOT' });
    dragRef.current = edgeDrag;
    return;
  }

  const connDrag = buildConnectionPointDrag(hit, nodes, sx, sy);
  if (connDrag) {
    dragRef.current = connDrag;
    return;
  }

  const resizeDrag = buildResizeDrag(hit, nodes, world, sx, sy);
  if (resizeDrag) {
    dragRef.current = resizeDrag;
    dispatch({ type: 'SNAPSHOT' });
    return;
  }

  // Ctrl+クリック（またはCmd+クリック）でURLを開く
  if ((e.ctrlKey || e.metaKey) && hit.type === 'node' && hit.id) {
    const node = nodes.find(n => n.id === hit.id);
    if (node?.url) {
      window.open(node.url, '_blank', 'noopener,noreferrer');
      return;
    }
  }

  if (hit.type === 'node' && hit.id) {
    const selectedIds = buildNodeSelectedIds(hit.id, nodes, selection, e.shiftKey);
    dispatch({ type: 'SET_SELECTION', selection: { nodeIds: selectedIds, edgeIds: [] } });

    const hitNode = nodes.find(n => n.id === hit.id);
    if (hitNode?.locked) return;

    const initialNodes = new Map<string, { x: number; y: number; width: number; height: number }>();
    selectedIds.forEach(id => {
      const n = nodes.find(nd => nd.id === id);
      if (n && !n.locked) initialNodes.set(id, { x: n.x, y: n.y, width: n.width, height: n.height });
    });
    dragRef.current = {
      type: 'move', startWorldX: world.x, startWorldY: world.y,
      startScreenX: sx, startScreenY: sy, initialNodes,
    };
    dispatch({ type: 'SNAPSHOT' });
    return;
  }

  if (hit.type === 'edge-segment' && hit.id && hit.segmentDirection) {
    const edge = edges.find(ed => ed.id === hit.id);
    dispatch({ type: 'SET_SELECTION', selection: { nodeIds: [], edgeIds: [hit.id] } });
    dispatch({ type: 'SNAPSHOT' });
    dragRef.current = {
      type: 'move-edge-segment', startWorldX: world.x, startWorldY: world.y,
      startScreenX: sx, startScreenY: sy,
      edgeId: hit.id, segmentDirection: hit.segmentDirection,
      initialMidpoint: edge?.manualMidpoint,
    };
    return;
  }

  if (hit.type === 'edge' && hit.id) {
    dispatch({ type: 'SET_SELECTION', selection: { nodeIds: [], edgeIds: [hit.id] } });
    return;
  }

  if (!e.shiftKey) {
    dispatch({ type: 'SET_SELECTION', selection: { nodeIds: [], edgeIds: [] } });
  }
  dragRef.current = {
    type: 'select-rect', startWorldX: world.x, startWorldY: world.y,
    startScreenX: sx, startScreenY: sy,
  };
}

function computeResize(
  init: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
  wx: number, wy: number,
  startWx: number, startWy: number,
): { x: number; y: number; width: number; height: number } {
  const dx = wx - startWx;
  const dy = wy - startWy;
  let { x, y, width, height } = init;
  const MIN = 20;

  if (handle.includes('e')) { width = Math.max(MIN, init.width + dx); }
  if (handle.includes('w')) { width = Math.max(MIN, init.width - dx); x = init.x + init.width - width; }
  if (handle.includes('s')) { height = Math.max(MIN, init.height + dy); }
  if (handle.includes('n')) { height = Math.max(MIN, init.height - dy); y = init.y + init.height - height; }

  return { x, y, width, height };
}
