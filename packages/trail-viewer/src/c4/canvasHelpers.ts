/** Truncate text to maxLen, appending ellipsis if needed. */
export function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text;
}

export interface Viewport {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
}

/** Clamp viewport so the cell top-left corner never exceeds the header area. */
export function clampViewport(
  vp: Viewport,
  headerW: number,
  headerH: number,
): Viewport {
  const maxOffsetX = headerW * (1 - vp.scale);
  const maxOffsetY = headerH * (1 - vp.scale);
  return {
    scale: vp.scale,
    offsetX: Math.min(vp.offsetX, maxOffsetX),
    offsetY: Math.min(vp.offsetY, maxOffsetY),
  };
}
