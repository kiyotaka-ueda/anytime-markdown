import type { Side } from './connector';

interface Point { x: number; y: number }
interface Rect { x: number; y: number; width: number; height: number }

/** A*グリッドベースの障害物回避ルーティング */
export function computeAvoidancePath(
  fromPt: Point,
  fromSide: Side,
  toPt: Point,
  toSide: Side,
  obstacles: Rect[],
  gridSize: number = 20,
): Point[] {
  if (obstacles.length === 0) {
    return computeDirectPath(fromPt, fromSide, toPt, toSide);
  }

  const margin = gridSize * 3;

  // グリッド範囲を算出
  const allX = [fromPt.x, toPt.x, ...obstacles.flatMap(o => [o.x, o.x + o.width])];
  const allY = [fromPt.y, toPt.y, ...obstacles.flatMap(o => [o.y, o.y + o.height])];
  const minX = Math.min(...allX) - margin;
  const minY = Math.min(...allY) - margin;
  const maxX = Math.max(...allX) + margin;
  const maxY = Math.max(...allY) + margin;

  const cols = Math.ceil((maxX - minX) / gridSize) + 1;
  const rows = Math.ceil((maxY - minY) / gridSize) + 1;

  // グリッド上の座標変換
  const toGrid = (p: Point): [number, number] => [
    Math.round((p.x - minX) / gridSize),
    Math.round((p.y - minY) / gridSize),
  ];
  const toWorld = (col: number, row: number): Point => ({
    x: minX + col * gridSize,
    y: minY + row * gridSize,
  });

  // 障害物マップ（padding付き）
  const blocked = new Set<string>();
  const pad = 1; // グリッドセル単位のパディング
  for (const o of obstacles) {
    const [oMinC, oMinR] = toGrid({ x: o.x, y: o.y });
    const [oMaxC, oMaxR] = toGrid({ x: o.x + o.width, y: o.y + o.height });
    for (let c = oMinC - pad; c <= oMaxC + pad; c++) {
      for (let r = oMinR - pad; r <= oMaxR + pad; r++) {
        if (c >= 0 && c < cols && r >= 0 && r < rows) {
          blocked.add(`${c},${r}`);
        }
      }
    }
  }

  const [startC, startR] = toGrid(fromPt);
  const [endC, endR] = toGrid(toPt);

  // start/endは通過可能にする
  blocked.delete(`${startC},${startR}`);
  blocked.delete(`${endC},${endR}`);

  // A*探索
  const path = astar(startC, startR, endC, endR, cols, rows, blocked);

  if (!path) {
    // 探索失敗 → 直線フォールバック
    return computeDirectPath(fromPt, fromSide, toPt, toSide);
  }

  // グリッド座標 → ワールド座標に変換
  const worldPath = path.map(([c, r]) => toWorld(c, r));

  // 始点と終点を正確な座標に置換
  worldPath[0] = fromPt;
  worldPath[worldPath.length - 1] = toPt;

  // 冗長な中間点を除去（同じ方向のセグメントを統合）
  return simplifyPath(worldPath);
}

/** 障害物なしの直交パス */
function computeDirectPath(fromPt: Point, fromSide: Side, toPt: Point, toSide: Side): Point[] {
  const isHorizontalStart = fromSide === 'left' || fromSide === 'right';
  const isHorizontalEnd = toSide === 'left' || toSide === 'right';

  if (isHorizontalStart && isHorizontalEnd) {
    const midX = (fromPt.x + toPt.x) / 2;
    return [fromPt, { x: midX, y: fromPt.y }, { x: midX, y: toPt.y }, toPt];
  } else if (!isHorizontalStart && !isHorizontalEnd) {
    const midY = (fromPt.y + toPt.y) / 2;
    return [fromPt, { x: fromPt.x, y: midY }, { x: toPt.x, y: midY }, toPt];
  } else if (isHorizontalStart) {
    return [fromPt, { x: toPt.x, y: fromPt.y }, toPt];
  } else {
    return [fromPt, { x: fromPt.x, y: toPt.y }, toPt];
  }
}

/** A* 探索（直交移動のみ） */
function astar(
  startC: number, startR: number,
  endC: number, endR: number,
  cols: number, rows: number,
  blocked: Set<string>,
): [number, number][] | null {
  const key = (c: number, r: number) => `${c},${r}`;
  const heuristic = (c: number, r: number) => Math.abs(c - endC) + Math.abs(r - endR);

  const openSet = new Map<string, { c: number; r: number; g: number; f: number }>();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();

  const startKey = key(startC, startR);
  const endKey = key(endC, endR);
  openSet.set(startKey, { c: startC, r: startR, g: 0, f: heuristic(startC, startR) });
  gScore.set(startKey, 0);

  const dirs: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  let iterations = 0;
  const maxIterations = cols * rows * 2; // 安全弁

  while (openSet.size > 0 && iterations < maxIterations) {
    iterations++;

    // 最小 f のノードを取得
    let bestKey = '';
    let bestF = Infinity;
    for (const [k, v] of openSet) {
      if (v.f < bestF) { bestF = v.f; bestKey = k; }
    }
    const current = openSet.get(bestKey)!;
    openSet.delete(bestKey);

    if (bestKey === endKey) {
      // パスを再構築
      const path: [number, number][] = [[endC, endR]];
      let k = endKey;
      while (cameFrom.has(k)) {
        k = cameFrom.get(k)!;
        const [c, r] = k.split(',').map(Number);
        path.unshift([c, r]);
      }
      return path;
    }

    for (const [dc, dr] of dirs) {
      const nc = current.c + dc;
      const nr = current.r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nk = key(nc, nr);
      if (blocked.has(nk)) continue;

      const tentG = current.g + 1;
      if (tentG < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentG);
        cameFrom.set(nk, bestKey);
        openSet.set(nk, { c: nc, r: nr, g: tentG, f: tentG + heuristic(nc, nr) });
      }
    }
  }

  return null; // パスが見つからない
}

/** 同方向の連続セグメントを統合して冗長なウェイポイントを除去 */
function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path;

  const result: Point[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    const next = path[i + 1];
    // prev→curr と curr→next が同方向なら curr をスキップ
    const sameX = prev.x === curr.x && curr.x === next.x;
    const sameY = prev.y === curr.y && curr.y === next.y;
    if (!sameX && !sameY) {
      result.push(curr);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}
