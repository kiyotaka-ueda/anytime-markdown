interface Point {
  readonly x: number;
  readonly y: number;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface VNode {
  readonly x: number;
  readonly y: number;
  readonly id: number;
}

export interface VEdge {
  readonly from: number;
  readonly to: number;
  readonly distance: number;
  readonly horizontal: boolean;
}

/** 各矩形をマージン分拡張する */
export function buildMarginRects(
  rects: readonly Rect[],
  margin: number,
): Rect[] {
  return rects.map((r) => ({
    x: r.x - margin,
    y: r.y - margin,
    width: r.width + margin * 2,
    height: r.height + margin * 2,
  }));
}

/**
 * 水平/垂直の線分が矩形と交差するか判定する。
 * padding で矩形を仮想的に拡張できる。
 */
function segmentIntersectsRect(
  p1: Point,
  p2: Point,
  rect: Rect,
  padding: number = 0,
): boolean {
  const rMinX = rect.x - padding;
  const rMinY = rect.y - padding;
  const rMaxX = rect.x + rect.width + padding;
  const rMaxY = rect.y + rect.height + padding;

  if (p1.y === p2.y) {
    const y = p1.y;
    if (y < rMinY || y > rMaxY) return false;
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    return maxX > rMinX && minX < rMaxX;
  }

  if (p1.x === p2.x) {
    const x = p1.x;
    if (x < rMinX || x > rMaxX) return false;
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    return maxY > rMinY && minY < rMaxY;
  }

  return false;
}

/** 2ノード間が水平/垂直に整列しており、障害物に遮られていないか判定する */
export function isVisible(
  a: VNode,
  b: VNode,
  obstacles: readonly Rect[],
): boolean {
  const isHorizontal = a.y === b.y;
  const isVertical = a.x === b.x;

  if (!isHorizontal && !isVertical) return false;

  for (const obstacle of obstacles) {
    if (segmentIntersectsRect(a, b, obstacle)) {
      return false;
    }
  }

  return true;
}

/** 全ノードペアの可視性を判定し、可視エッジのリストを返す */
export function buildVisibilityGraph(
  nodes: readonly VNode[],
  obstacles: readonly Rect[],
): VEdge[] {
  const edges: VEdge[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      if (!isVisible(a, b, obstacles)) continue;

      const horizontal = a.y === b.y;
      const distance = horizontal
        ? Math.abs(a.x - b.x)
        : Math.abs(a.y - b.y);

      edges.push({
        from: a.id,
        to: b.id,
        distance,
        horizontal,
      });
    }
  }

  return edges;
}
