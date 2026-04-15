import { GraphNode } from '../types';
import { CanvasColors, getCanvasColors } from '../theme';
import {
  SHADOW_DEFAULT,
  PARALLELOGRAM_OFFSET_RATIO, CYLINDER_ELLIPSE_RATIO,
} from './constants';
import type { ShadowStyle } from './constants';
/** drawNode 呼び出し中に有効な色設定（モジュールスコープ） */
let currentColors: CanvasColors = getCanvasColors(true);

export function getCurrentColors(): CanvasColors {
  return currentColors;
}

export function setCurrentColors(colors: CanvasColors): void {
  currentColors = colors;
}

const MAX_IMAGE_CACHE = 50;

/** 画像キャッシュ（dataURL → HTMLImageElement） */
const imageCache = new Map<string, HTMLImageElement>();

export function getOrLoadImage(dataUrl: string): HTMLImageElement | null {
  const cached = imageCache.get(dataUrl);
  if (cached) {
    // LRU: ヒット時にエントリを末尾に移動
    imageCache.delete(dataUrl);
    imageCache.set(dataUrl, cached);
    return cached.complete ? cached : null;
  }
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.src = dataUrl;
  imageCache.set(dataUrl, img);
  // LRU: 最大エントリ数を超えたら最古を削除
  if (imageCache.size > MAX_IMAGE_CACHE) {
    const oldest = imageCache.keys().next().value;
    if (oldest !== undefined) imageCache.delete(oldest);
  }
  return img.complete ? img : null;
}

/** ドキュメント切替時などにキャッシュをクリア */
export function clearImageCache(): void {
  imageCache.clear();
}

/** グラデーション fill を生成 */
export function makeFill(ctx: CanvasRenderingContext2D, style: GraphNode['style'], x: number, y: number, w: number, h: number): string | CanvasGradient {
  if (!style.gradientTo) return style.fill;
  const dir = style.gradientDirection ?? 'vertical';
  let grd: CanvasGradient;
  if (dir === 'horizontal') grd = ctx.createLinearGradient(x, y, x + w, y);
  else if (dir === 'diagonal') grd = ctx.createLinearGradient(x, y, x + w, y + h);
  else grd = ctx.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, style.fill);
  grd.addColorStop(1, style.gradientTo);
  return grd;
}

/** 影を適用 */
export function applyShadow(ctx: CanvasRenderingContext2D, style: GraphNode['style'], shadow: ShadowStyle = SHADOW_DEFAULT): void {
  if (style.shadow) {
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetX = shadow.offsetX;
    ctx.shadowOffsetY = shadow.offsetY;
  }
}

export function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** borderRadius の実効値を算出（未設定時はフォールバック値を使用） */
export function effectiveBorderRadius(style: GraphNode['style'], fallback: number): number {
  return Math.max(fallback, style.borderRadius ?? 0);
}

export function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

export function drawParallelogram(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const offset = w * PARALLELOGRAM_OFFSET_RATIO;
  ctx.beginPath();
  ctx.moveTo(x + offset, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - offset, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

export function drawCylinderBody(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const ry = h * CYLINDER_ELLIPSE_RATIO;
  ctx.beginPath();
  ctx.moveTo(x, y + ry);
  ctx.lineTo(x, y + h - ry);
  ctx.ellipse(x + w / 2, y + h - ry, w / 2, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + w, y + ry);
  ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, 0, Math.PI, true);
  ctx.closePath();
}

export function drawCylinderTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const ry = h * CYLINDER_ELLIPSE_RATIO;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}
