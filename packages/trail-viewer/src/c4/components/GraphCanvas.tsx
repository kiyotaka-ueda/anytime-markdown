import type { GraphDocument, GraphGroup, GraphNode, SelectionState, Viewport } from '@anytime-markdown/graph-core';
import { render, nodeIntersection, hitTestGroup, hitTestNode, screenToWorld } from '@anytime-markdown/graph-core/engine';
import type { Action } from '@anytime-markdown/graph-core/state';
import { useCanvasBase } from '@anytime-markdown/graph-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DIM_OPACITY = 10;
const COMMUNITY_OVERLAY_ALPHA = 0.5;
const GOD_NODE_STROKE_WIDTH = 3;

export interface CommunityOverlayStyle {
  readonly color: string;
  readonly isGodNode: boolean;
}

/** hex `#rrggbb` → [r,g,b] 数値配列 */
function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

/** [r,g,b] → `#rrggbb` */
function toHex(rgb: readonly [number, number, number]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * `base` の上に `overlay` を `alpha` の不透明度で重ねた色を返す。
 * パースに失敗した場合は base を返す。
 */
function blendColors(base: string, overlay: string, alpha: number): string {
  const baseRgb = parseHex(base);
  const overRgb = parseHex(overlay);
  if (!baseRgb || !overRgb) return base;
  return toHex([
    baseRgb[0] * (1 - alpha) + overRgb[0] * alpha,
    baseRgb[1] * (1 - alpha) + overRgb[1] * alpha,
    baseRgb[2] * (1 - alpha) + overRgb[2] * alpha,
  ]);
}

/** `#rrggbb` の各成分を `factor` 倍した色を返す（< 1 で暗く、> 1 で明るく）。 */
function adjustBrightness(hex: string, factor: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex([rgb[0] * factor, rgb[1] * factor, rgb[2] * factor]);
}

interface C4GraphCanvasProps {
  readonly document: GraphDocument;
  readonly viewport: Viewport;
  readonly dispatch: React.Dispatch<Action>;
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
  readonly selectedNodeId?: string | null;
  readonly centerOnSelect?: boolean;
  readonly overlayMap?: ReadonlyMap<string, string> | null;
  readonly claudeActivityMap?: ReadonlyMap<string, string> | null;
  readonly communityMap?: ReadonlyMap<string, CommunityOverlayStyle> | null;
  readonly onNodeSelect?: (nodeId: string | null) => void;
  readonly onNodeDoubleClick?: (nodeId: string) => void;
  readonly onNodeContextMenu?: (c4Id: string, x: number, y: number, nodeType: string) => void;
  readonly onGroupContextMenu?: (groupId: string, x: number, y: number) => void;
  readonly isDark?: boolean;
}

const EMPTY_SELECTION: SelectionState = { nodeIds: [], edgeIds: [] };

export function GraphCanvas({ document, viewport, dispatch, canvasRef, selectedNodeId, centerOnSelect, overlayMap, claudeActivityMap, communityMap, onNodeSelect, onNodeDoubleClick, onNodeContextMenu, onGroupContextMenu, isDark }: Readonly<C4GraphCanvasProps>) {
  const rafRef = useRef<number>(0);
  const viewportRef = useRef(viewport);
  const dispatchRef = useRef(dispatch);
  const nodesRef = useRef(document.nodes);
  const groupsRef = useRef<readonly GraphGroup[]>(document.groups ?? []);
  const [isFocused, setIsFocused] = useState(false);
  viewportRef.current = viewport;
  dispatchRef.current = dispatch;
  nodesRef.current = document.nodes;
  groupsRef.current = document.groups ?? [];

  // Selection state
  const selectionRef = useRef<string[]>(selectedNodeId ? [selectedNodeId] : []);
  useEffect(() => {
    selectionRef.current = selectedNodeId ? [selectedNodeId] : [];
  }, [selectedNodeId]);

  // --- useCanvasBase ---
  const canvas = useCanvasBase({
    canvasRef,
    getViewport: () => viewportRef.current,
    getNodes: () => nodesRef.current,
    getGroups: () => groupsRef.current,
    getSelection: () => ({ nodeIds: selectionRef.current, edgeIds: [] }),
    dispatch: (action) => dispatchRef.current(action as Action),
    skipFrames: false,
    setViewport: (vp) => dispatchRef.current({ type: 'SET_VIEWPORT', viewport: vp }),
    setSelection: (sel) => {
      selectionRef.current = sel.nodeIds;
      dispatchRef.current({ type: 'SET_SELECTION', selection: sel });
    },
    onNodeClick: (node) => {
      if (node) {
        selectionRef.current = [node.id];
        const c4Id = node.metadata?.c4Id as string | undefined;
        onNodeSelect?.(c4Id ?? node.id);
      } else {
        selectionRef.current = [];
        onNodeSelect?.(null);
      }
    },
    onNodeDoubleClick: (node) => {
      if (node) {
        const c4Id = node.metadata?.c4Id as string | undefined;
        onNodeDoubleClick?.(c4Id ?? node.id);
      }
    },
    onNodeContextMenu: (node, x, y) => {
      const c4Id = node.metadata?.c4Id as string | undefined;
      if (c4Id) onNodeContextMenu?.(c4Id, x, y, node.type);
    },
  });

  // Center on selected node (only when centerOnSelect is true, e.g. tree panel selection)
  useEffect(() => {
    if (!centerOnSelect || !selectedNodeId) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const node = document.nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    const vp = viewportRef.current;
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;
    const canvasCenterX = cvs.clientWidth / 2;
    const canvasCenterY = cvs.clientHeight / 2;

    dispatchRef.current({
      type: 'SET_VIEWPORT',
      viewport: {
        ...vp,
        offsetX: canvasCenterX - centerX * vp.scale,
        offsetY: canvasCenterY - centerY * vp.scale,
      },
    });
  }, [centerOnSelect, selectedNodeId, document.nodes, canvasRef]);

  // Resolve connector edges to line endpoints
  const resolvedEdges = useMemo(() => document.edges.map(e => {
    if (e.type === 'connector' && e.from.nodeId && e.to.nodeId) {
      const fromNode = document.nodes.find(n => n.id === e.from.nodeId);
      const toNode = document.nodes.find(n => n.id === e.to.nodeId);
      if (fromNode && toNode) {
        const fromCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
        const toCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };
        const fromPt = nodeIntersection(fromNode, toCenter.x, toCenter.y);
        const toPt = nodeIntersection(toNode, fromCenter.x, fromCenter.y);
        return {
          ...e,
          type: 'line' as const,
          from: { ...e.from, x: fromPt.x, y: fromPt.y },
          to: { ...e.to, x: toPt.x, y: toPt.y },
        };
      }
    }
    return e;
  }), [document.edges, document.nodes]);

  const focusScope = useMemo(() => {
    if (!selectedNodeId) return null;
    const nodeIds = new Set<string>([selectedNodeId]);
    const edgeIds = new Set<string>();
    for (const edge of resolvedEdges) {
      const fromId = edge.from.nodeId;
      const toId = edge.to.nodeId;
      if (!fromId || !toId) continue;
      if (fromId === selectedNodeId || toId === selectedNodeId) {
        edgeIds.add(edge.id);
        nodeIds.add(fromId);
        nodeIds.add(toId);
      }
    }
    return { nodeIds, edgeIds };
  }, [resolvedEdges, selectedNodeId]);

  // Metric overlay: replace node fill colors
  const styledNodes = useMemo(() => {
    if (!overlayMap) return document.nodes;
    return document.nodes.map(n => {
      const c4Id = n.metadata?.c4Id as string | undefined;
      if (!c4Id) return n;
      const fill = overlayMap.get(c4Id);
      if (!fill) return n;
      return { ...n, style: { ...n.style, fill } };
    });
  }, [document.nodes, overlayMap]);

  // Community overlay: 背景塗りをコミュニティ色で置換 / godNode は枠線強調
  // overlayMap が同じ要素にも当たっている場合は、overlay を 50% 透過してコミュニティ色とブレンドする
  const communityStyledNodes = useMemo(() => {
    if (!communityMap || communityMap.size === 0) return styledNodes;
    return styledNodes.map(n => {
      const c4Id = n.metadata?.c4Id as string | undefined;
      if (!c4Id) return n;
      const community = communityMap.get(c4Id);
      if (!community) return n;
      const overlayFill = overlayMap?.get(c4Id);
      const fill = overlayFill
        ? blendColors(community.color, overlayFill, COMMUNITY_OVERLAY_ALPHA)
        : community.color;
      const style = community.isGodNode
        ? { ...n.style, fill, stroke: adjustBrightness(community.color, 0.6), strokeWidth: GOD_NODE_STROKE_WIDTH }
        : { ...n.style, fill };
      return { ...n, style };
    });
  }, [styledNodes, communityMap, overlayMap]);

  // Claude activity overlay: metric overlay とは独立した常時表示レイヤー
  const activityStyledNodes = useMemo(() => {
    if (!claudeActivityMap) return communityStyledNodes;
    return communityStyledNodes.map(n => {
      const c4Id = n.metadata?.c4Id as string | undefined;
      if (!c4Id) return n;
      const fill = claudeActivityMap.get(c4Id);
      if (!fill) return n;
      return { ...n, style: { ...n.style, fill } };
    });
  }, [communityStyledNodes, claudeActivityMap]);

  const focusStyledNodes = useMemo(() => {
    if (!focusScope) return activityStyledNodes;
    return activityStyledNodes.map((node) => {
      if (focusScope.nodeIds.has(node.id)) return node;
      return {
        ...node,
        style: {
          ...node.style,
          opacity: DIM_OPACITY,
        },
      };
    });
  }, [activityStyledNodes, focusScope]);

  const focusStyledEdges = useMemo(() => {
    if (!focusScope) return resolvedEdges;
    return resolvedEdges.map((edge) => {
      if (focusScope.edgeIds.has(edge.id)) return edge;
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: DIM_OPACITY,
        },
      };
    });
  }, [focusScope, resolvedEdges]);

  // Render loop
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    function draw() {
      const w = cvs!.clientWidth;
      const h = cvs!.clientHeight;
      const dpr = globalThis.devicePixelRatio ?? 1;
      cvs!.width = w * dpr;
      cvs!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sel = selectionRef.current;
      render({
        ctx: ctx!,
        width: w,
        height: h,
        nodes: focusStyledNodes,
        edges: focusStyledEdges,
        groups: groupsRef.current,
        viewport: viewportRef.current,
        selection: sel.length > 0 ? { nodeIds: sel, edgeIds: [] } : EMPTY_SELECTION,
        showGrid: false,
        isDark: isDark ?? true,
      });

      // Selection rectangle overlay
      canvas.drawSelectOverlay(ctx!, viewportRef.current);

      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [focusStyledNodes, focusStyledEdges, canvasRef, canvas]);

  const nodeMap = useMemo(
    () => new Map<string, GraphNode>(document.nodes.map(n => [n.id, n])),
    [document.nodes],
  );

  // グループ右クリック検出を含む拡張コンテキストメニュー
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!onGroupContextMenu) {
      canvas.handleContextMenu(e);
      return;
    }
    const cvs = canvasRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(viewportRef.current, sx, sy);

    // ノードが hit する場合は node コンテキストメニューを優先
    for (let i = document.nodes.length - 1; i >= 0; i--) {
      if (hitTestNode(document.nodes[i], world.x, world.y)) {
        canvas.handleContextMenu(e);
        return;
      }
    }
    // グループ hit test
    const group = hitTestGroup(world.x, world.y, groupsRef.current, nodeMap);
    if (group) {
      onGroupContextMenu(group.id, e.clientX, e.clientY);
    }
  }, [canvas, canvasRef, document.nodes, nodeMap, onGroupContextMenu]);

  const getCursor = useCallback(() => {
    const mode = canvas.getDragMode();
    if (mode === 'select-rect') return 'crosshair';
    if (mode === 'pan' || mode === 'move') return 'grabbing';
    return 'default';
  }, [canvas]);

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
        cursor: getCursor(),
        outline: 'none',
        boxShadow: isFocused ? 'inset 0 0 0 2px #4FC3F7' : 'none',
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={canvas.handleKeyDown}
      onKeyUp={canvas.handleKeyUp}
      onMouseDown={canvas.handleMouseDown}
      onMouseMove={canvas.handleMouseMove}
      onMouseUp={canvas.handleMouseUp}
      onMouseLeave={canvas.handleMouseUp}
      onDoubleClick={canvas.handleDoubleClick}
      onContextMenu={handleContextMenu}
    />
  );
}
