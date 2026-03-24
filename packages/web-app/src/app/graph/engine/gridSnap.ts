const DEFAULT_GRID = 20;

/** 値を最も近いグリッド倍数にスナップ */
export function snapToGrid(value: number, gridSize: number = DEFAULT_GRID): number {
  return Math.round(value / gridSize) * gridSize || 0;
}

/** 矩形の位置（とオプションでサイズ）をグリッドにスナップ */
export function snapRect(
  x: number, y: number, width: number, height: number,
  gridSize: number = DEFAULT_GRID,
  snapSize: boolean = false,
): { x: number; y: number; width: number; height: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
    width: snapSize ? snapToGrid(width, gridSize) : width,
    height: snapSize ? snapToGrid(height, gridSize) : height,
  };
}
