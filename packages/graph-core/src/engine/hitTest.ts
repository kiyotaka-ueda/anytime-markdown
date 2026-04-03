import { GraphNode, GraphEdge } from '../types';
import { HANDLE_SIZE, EDGE_TOLERANCE, CONNECTION_POINT_RADIUS, ENDPOINT_HANDLE_RADIUS } from './constants';
import { getConnectionPoints } from './connector';

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left';

export type EdgeEndpointEnd = 'from' | 'to';

export interface HitResult {
  type: 'node' | 'edge' | 'resize-handle' | 'connection-point' | 'edge-segment' | 'edge-endpoint' | 'waypoint-handle' | 'none';
  id?: string;
  handle?: ResizeHandle;
  connectionSide?: ConnectionSide;
  /** ドラッグ可能なエッジセグメントの方向 */
  segmentDirection?: 'horizontal' | 'vertical';
  /** ヒットしたセグメントのインデックス（waypoints[i] → waypoints[i+1]） */
  segmentIndex?: number;
  /** エッジエンドポイント（from/to） */
  endpointEnd?: EdgeEndpointEnd;
  /** ヒットした manualWaypoints のインデックス */
  waypointIndex?: number;
}

function pointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

function pointInEllipse(px: number, py: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function hitTestResizeHandles(node: GraphNode, wx: number, wy: number, scale: number): ResizeHandle | null {
  const hs = HANDLE_SIZE / scale;
  const { x, y, width: w, height: h } = node;
  const handles: { handle: ResizeHandle; hx: number; hy: number }[] = [
    { handle: 'nw', hx: x, hy: y },
    { handle: 'ne', hx: x + w, hy: y },
    { handle: 'sw', hx: x, hy: y + h },
    { handle: 'se', hx: x + w, hy: y + h },
    { handle: 'n', hx: x + w / 2, hy: y },
    { handle: 's', hx: x + w / 2, hy: y + h },
    { handle: 'e', hx: x + w, hy: y + h / 2 },
    { handle: 'w', hx: x, hy: y + h / 2 },
  ];
  for (const { handle, hx, hy } of handles) {
    if (Math.abs(wx - hx) <= hs && Math.abs(wy - hy) <= hs) return handle;
  }
  return null;
}

function pointInPolygon(px: number, py: number, polygon: {x: number; y: number}[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function hitTestNode(node: GraphNode, wx: number, wy: number): boolean {
  if (node.type === 'ellipse') {
    return pointInEllipse(wx, wy, node.x + node.width / 2, node.y + node.height / 2, node.width / 2, node.height / 2);
  }
  if (node.type === 'diamond') {
    const { x, y, width: w, height: h } = node;
    return pointInPolygon(wx, wy, [
      { x: x + w / 2, y },
      { x: x + w, y: y + h / 2 },
      { x: x + w / 2, y: y + h },
      { x, y: y + h / 2 },
    ]);
  }
  if (node.type === 'parallelogram') {
    const { x, y, width: w, height: h } = node;
    const offset = w * 0.2;
    return pointInPolygon(wx, wy, [
      { x: x + offset, y },
      { x: x + w, y },
      { x: x + w - offset, y: y + h },
      { x, y: y + h },
    ]);
  }
  if (node.type === 'cylinder') {
    const { x, y, width: w, height: h } = node;
    const ellipseH = Math.min(h * 0.15, 15);
    // 上部楕円
    if (wy < y + ellipseH) {
      return pointInEllipse(wx, wy, x + w / 2, y + ellipseH, w / 2, ellipseH);
    }
    // 下部楕円
    if (wy > y + h - ellipseH) {
      return pointInEllipse(wx, wy, x + w / 2, y + h - ellipseH, w / 2, ellipseH);
    }
    // 胴体（矩形）
    return wx >= x && wx <= x + w;
  }
  return pointInRect(wx, wy, node.x, node.y, node.width, node.height);
}

export function hitTestEdge(edge: GraphEdge, wx: number, wy: number, scale: number): boolean {
  return distanceToEdge(edge, wx, wy) <= EDGE_TOLERANCE / scale;
}

/** エッジまでの最短距離を返す */
function distanceToEdge(edge: GraphEdge, wx: number, wy: number): number {
  if (edge.waypoints && edge.waypoints.length >= 2) {
    let minDist = Infinity;
    for (let i = 0; i < edge.waypoints.length - 1; i++) {
      const d = distanceToSegment(wx, wy, edge.waypoints[i].x, edge.waypoints[i].y, edge.waypoints[i + 1].x, edge.waypoints[i + 1].y);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }
  return distanceToSegment(wx, wy, edge.from.x, edge.from.y, edge.to.x, edge.to.y);
}

/** 折れ線コネクタの中間セグメントhit判定。ドラッグ方向とセグメントインデックスを返す */
export function hitTestEdgeSegment(
  edge: GraphEdge,
  wx: number, wy: number, scale: number,
): { segmentDirection: 'horizontal' | 'vertical'; segmentIndex: number } | null {
  if (!edge.waypoints || edge.waypoints.length < 4) return null;
  const tolerance = EDGE_TOLERANCE / scale;
  // 最初と最後のセグメントは端点接続なので除外。中間セグメントのみ判定
  for (let i = 1; i < edge.waypoints.length - 2; i++) {
    const p1 = edge.waypoints[i];
    const p2 = edge.waypoints[i + 1];
    if (distanceToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y) <= tolerance) {
      const isHorizontal = Math.abs(p1.y - p2.y) < 1;
      return { segmentDirection: isHorizontal ? 'horizontal' : 'vertical', segmentIndex: i };
    }
  }
  return null;
}

/** manualWaypoints のハンドルhit判定。ヒットしたインデックスを返す */
export function hitTestWaypointHandle(
  edge: GraphEdge,
  wx: number, wy: number, scale: number,
): number | null {
  if (!edge.manualWaypoints?.length) return null;
  const r = HANDLE_SIZE / scale;
  for (let i = 0; i < edge.manualWaypoints.length; i++) {
    const wp = edge.manualWaypoints[i];
    if (Math.hypot(wx - wp.x, wy - wp.y) <= r) return i;
  }
  return null;
}

function hitTestConnectionPoints(node: GraphNode, wx: number, wy: number, scale: number): ConnectionSide | null {
  const r = CONNECTION_POINT_RADIUS / scale;
  const points = getConnectionPoints(node);
  for (const { side, x: px, y: py } of points) {
    if (Math.hypot(wx - px, wy - py) <= r) return side;
  }
  return null;
}

function hitTestEdgeEndpoints(
  edge: GraphEdge,
  wx: number, wy: number, scale: number,
): EdgeEndpointEnd | null {
  const r = ENDPOINT_HANDLE_RADIUS / scale;
  const pts = edge.waypoints && edge.waypoints.length >= 2
    ? [edge.waypoints[0], edge.waypoints.at(-1)!]
    : [{ x: edge.from.x, y: edge.from.y }, { x: edge.to.x, y: edge.to.y }];
  if (Math.hypot(wx - pts[0].x, wy - pts[0].y) <= r) return 'from';
  if (Math.hypot(wx - pts[1].x, wy - pts[1].y) <= r) return 'to';
  return null;
}

export interface HitTestContext {
  nodes: GraphNode[];
  edges: GraphEdge[];
  wx: number;
  wy: number;
  scale: number;
  selectedNodeIds: string[];
  hoverNodeId?: string;
  selectedEdgeIds?: string[];
}

export function hitTest(ctx: HitTestContext): HitResult {
  const { nodes, edges, wx, wy, scale, selectedNodeIds, hoverNodeId, selectedEdgeIds } = ctx;
  // 選択中エッジのエンドポイントハンドル判定
  if (selectedEdgeIds) {
    for (const eid of selectedEdgeIds) {
      const edge = edges.find(e => e.id === eid);
      if (edge) {
        const end = hitTestEdgeEndpoints(edge, wx, wy, scale);
        if (end) return { type: 'edge-endpoint', id: edge.id, endpointEnd: end };
      }
    }
  }

  // 接続ポイント判定（ホバー中ノードのみ）
  if (hoverNodeId) {
    const hoverNode = nodes.find(n => n.id === hoverNodeId);
    if (hoverNode) {
      const side = hitTestConnectionPoints(hoverNode, wx, wy, scale);
      if (side) return { type: 'connection-point', id: hoverNode.id, connectionSide: side };
    }
  }

  for (const id of selectedNodeIds) {
    const node = nodes.find(n => n.id === id);
    if (node) {
      const handle = hitTestResizeHandles(node, wx, wy, scale);
      if (handle) return { type: 'resize-handle', id: node.id, handle };
    }
  }
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (hitTestNode(nodes[i], wx, wy)) return { type: 'node', id: nodes[i].id };
  }
  // 選択中エッジのウェイポイントハンドル判定
  if (selectedEdgeIds) {
    for (const eid of selectedEdgeIds) {
      const edge = edges.find(e => e.id === eid);
      if (edge) {
        const wpIdx = hitTestWaypointHandle(edge, wx, wy, scale);
        if (wpIdx !== null) return { type: 'waypoint-handle', id: edge.id, waypointIndex: wpIdx };
      }
    }
  }
  // エッジ判定: 複数ヒット時は最も近いエッジを優先
  const tolerance = EDGE_TOLERANCE / scale;
  let bestEdgeResult: HitResult | null = null;
  let bestEdgeDist = Infinity;
  for (let i = edges.length - 1; i >= 0; i--) {
    const dist = distanceToEdge(edges[i], wx, wy);
    if (dist > tolerance) continue;
    if (dist < bestEdgeDist) {
      bestEdgeDist = dist;
      const seg = hitTestEdgeSegment(edges[i], wx, wy, scale);
      bestEdgeResult = seg
        ? { type: 'edge-segment', id: edges[i].id, segmentDirection: seg.segmentDirection, segmentIndex: seg.segmentIndex }
        : { type: 'edge', id: edges[i].id };
    }
  }
  if (bestEdgeResult) return bestEdgeResult;
  return { type: 'none' };
}
