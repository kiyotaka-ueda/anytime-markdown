import { GraphNode } from '../types';
import {
  CANVAS_SELECTION, COLOR_TEXT_PRIMARY, COLOR_TEXT_SECONDARY, FONT_FAMILY,
  DOC_ICON_COLOR, FRAME_TITLE_BG, COLOR_ICE_BLUE,
} from '../theme';

const MAX_IMAGE_CACHE = 50;

/** 画像キャッシュ（dataURL → HTMLImageElement） */
const imageCache = new Map<string, HTMLImageElement>();

function getOrLoadImage(dataUrl: string): HTMLImageElement | null {
  const cached = imageCache.get(dataUrl);
  if (cached) return cached.complete ? cached : null;
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
function makeFill(ctx: CanvasRenderingContext2D, style: GraphNode['style'], x: number, y: number, w: number, h: number): string | CanvasGradient {
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
function applyShadow(ctx: CanvasRenderingContext2D, style: GraphNode['style']): void {
  if (style.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
  }
}

function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function drawNode(
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  selected: boolean,
  isDragging: boolean = false,
): void {
  ctx.save();

  // ドラッグ中の浮き上がりエフェクト
  if (isDragging) {
    ctx.shadowColor = 'rgba(144, 202, 249, 0.3)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
  }

  const { x, y, width, height, type, style, text } = node;
  const radius = style.borderRadius ?? 0;
  const fill = makeFill(ctx, style, x, y, width, height);

  if (type === 'sticky') {
    // sticky は常に影・角丸（ドラッグ中は上で設定済み）
    if (!isDragging) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }
    if (!isDragging && style.shadow) { ctx.shadowBlur = 12; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3; }

    ctx.fillStyle = fill;
    drawRoundedRect(ctx, x, y, width, height, Math.max(4, radius));
    ctx.fill();

    clearShadow(ctx);
    ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
    ctx.lineWidth = selected ? 2 : style.strokeWidth;
    drawRoundedRect(ctx, x, y, width, height, Math.max(4, radius));
    ctx.stroke();
  } else if (type === 'ellipse') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rx = width / 2;
    const ry = height / 2;

    applyShadow(ctx, style);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    clearShadow(ctx);
    ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
    ctx.lineWidth = selected ? 2 : style.strokeWidth;
    ctx.stroke();
  } else if (type === 'text') {
    if (selected) {
      ctx.strokeStyle = CANVAS_SELECTION;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    }
  } else if (type === 'diamond') {
    applyShadow(ctx, style);
    ctx.fillStyle = fill;
    drawDiamond(ctx, x, y, width, height);
    ctx.fill();
    clearShadow(ctx);
    ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
    ctx.lineWidth = selected ? 2 : style.strokeWidth;
    drawDiamond(ctx, x, y, width, height);
    ctx.stroke();
  } else if (type === 'parallelogram') {
    applyShadow(ctx, style);
    ctx.fillStyle = fill;
    drawParallelogram(ctx, x, y, width, height);
    ctx.fill();
    clearShadow(ctx);
    ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
    ctx.lineWidth = selected ? 2 : style.strokeWidth;
    drawParallelogram(ctx, x, y, width, height);
    ctx.stroke();
  } else if (type === 'cylinder') {
    applyShadow(ctx, style);
    ctx.fillStyle = fill;
    drawCylinderBody(ctx, x, y, width, height);
    ctx.fill();
    clearShadow(ctx);
    ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
    ctx.lineWidth = selected ? 2 : style.strokeWidth;
    drawCylinderBody(ctx, x, y, width, height);
    ctx.stroke();
    ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
    ctx.lineWidth = selected ? 2 : style.strokeWidth;
    drawCylinderTop(ctx, x, y, width, height);
    ctx.stroke();
  } else if (type === 'insight') {
    applyShadow(ctx, style);
    drawRoundedRect(ctx, x, y, width, height, Math.max(8, radius));
    ctx.fillStyle = fill;
    ctx.fill();
    clearShadow(ctx);
    ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
    ctx.lineWidth = selected ? 2 : style.strokeWidth;
    drawRoundedRect(ctx, x, y, width, height, Math.max(8, radius));
    ctx.stroke();
    // Label badge
    if (node.label) {
      const labelFont = `bold 10px ${FONT_FAMILY}`;
      ctx.font = labelFont;
      const labelW = ctx.measureText(node.label).width + 12;
      const badgeH = 18;
      const badgeX = x + 10;
      const badgeY = y + 10;
      drawRoundedRect(ctx, badgeX, badgeY, labelW, badgeH, 4);
      ctx.fillStyle = node.labelColor ?? COLOR_ICE_BLUE;
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.87)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, badgeX + 6, badgeY + badgeH / 2);
    }
    // Title (bold)
    if (text) {
      ctx.fillStyle = COLOR_TEXT_PRIMARY;
      ctx.font = `bold ${style.fontSize}px ${style.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(text, x + 10, y + 34, width - 20);
    }
  } else if (type === 'doc') {
    applyShadow(ctx, style);
    drawRoundedRect(ctx, x, y, width, height, Math.max(8, radius));
    ctx.fillStyle = fill;
    ctx.fill();
    clearShadow(ctx);
    ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
    ctx.lineWidth = selected ? 2 : style.strokeWidth;
    drawRoundedRect(ctx, x, y, width, height, Math.max(8, radius));
    ctx.stroke();
    // Doc icon
    ctx.fillStyle = DOC_ICON_COLOR;
    ctx.font = `18px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('\u{1F4C4}', x + 10, y + 10);
    // Title
    if (text) {
      ctx.fillStyle = COLOR_TEXT_PRIMARY;
      ctx.font = `bold ${style.fontSize}px ${style.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(text, x + 34, y + 14, width - 44);
    }
    // Preview text
    if (node.docContent) {
      ctx.fillStyle = COLOR_TEXT_SECONDARY;
      ctx.font = `11px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const preview = node.docContent.slice(0, 100).split('\n').slice(0, 3);
      preview.forEach((line, i) => {
        ctx.fillText(line.slice(0, 30), x + 10, y + 40 + i * 15, width - 20);
      });
    }
  } else if (type === 'image') {
    const r = radius > 0 ? radius : 4;
    applyShadow(ctx, style);
    // 背景プレースホルダー
    ctx.fillStyle = style.fill;
    drawRoundedRect(ctx, x, y, width, height, r);
    ctx.fill();
    clearShadow(ctx);
    // 画像描画
    if (node.imageData) {
      const img = getOrLoadImage(node.imageData);
      if (img) {
        ctx.save();
        drawRoundedRect(ctx, x, y, width, height, r);
        ctx.clip();
        ctx.drawImage(img, x, y, width, height);
        ctx.restore();
      }
    }
    // 枠線
    ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
    ctx.lineWidth = selected ? 2 : style.strokeWidth;
    drawRoundedRect(ctx, x, y, width, height, r);
    ctx.stroke();
  } else if (type === 'frame') {
    // フレーム背景
    const fr = radius > 0 ? radius : 8;
    ctx.fillStyle = fill;
    drawRoundedRect(ctx, x, y, width, height, fr);
    ctx.fill();
    ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
    ctx.lineWidth = selected ? 2 : style.strokeWidth;
    ctx.setLineDash([6, 3]);
    drawRoundedRect(ctx, x, y, width, height, fr);
    ctx.stroke();
    ctx.setLineDash([]);
    // タイトルバー
    const titleH = 28;
    ctx.fillStyle = FRAME_TITLE_BG;
    drawRoundedRect(ctx, x, y, width, titleH, fr);
    ctx.fill();
    // 下の角を矩形で埋める
    ctx.fillRect(x, y + titleH - fr, width, fr);
    // タイトルテキスト
    if (text) {
      ctx.fillStyle = COLOR_TEXT_SECONDARY;
      ctx.font = `bold ${style.fontSize}px ${style.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 12, y + titleH / 2, width - 24);
    }
  } else {
    // rect
    applyShadow(ctx, style);
    ctx.fillStyle = fill;
    if (radius > 0) {
      drawRoundedRect(ctx, x, y, width, height, radius);
      ctx.fill();
      clearShadow(ctx);
      ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
      ctx.lineWidth = selected ? 2 : style.strokeWidth;
      drawRoundedRect(ctx, x, y, width, height, radius);
      ctx.stroke();
    } else {
      ctx.fillRect(x, y, width, height);
      clearShadow(ctx);
      ctx.strokeStyle = selected ? CANVAS_SELECTION : style.stroke;
      ctx.lineWidth = selected ? 2 : style.strokeWidth;
      ctx.strokeRect(x, y, width, height);
    }
  }

  if (text && type !== 'insight' && type !== 'doc' && type !== 'frame' && type !== 'image') {
    ctx.fillStyle = COLOR_TEXT_PRIMARY;
    ctx.font = `${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const padding = 8;
    const maxWidth = width - padding * 2;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = style.fontSize * 1.3;
    const totalHeight = lines.length * lineHeight;
    const startY = y + height / 2 - totalHeight / 2 + lineHeight / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, x + width / 2, startY + i * lineHeight, maxWidth);
    });
  }

  // リンクアイコン（URL設定済みノード）
  if (node.url) {
    ctx.save();
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR_ICE_BLUE;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('\u{1F517}', x + width - 4, y + 4);
    ctx.restore();
  }

  ctx.restore();
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
  const offset = w * 0.2;
  ctx.beginPath();
  ctx.moveTo(x + offset, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - offset, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

export function drawCylinderBody(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const ry = h * 0.12;
  ctx.beginPath();
  ctx.moveTo(x, y + ry);
  ctx.lineTo(x, y + h - ry);
  ctx.ellipse(x + w / 2, y + h - ry, w / 2, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + w, y + ry);
  ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, 0, Math.PI, true);
  ctx.closePath();
}

export function drawCylinderTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const ry = h * 0.12;
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

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let currentLine = '';

  for (const char of text) {
    if (char === '\n') {
      lines.push(currentLine);
      currentLine = '';
      continue;
    }

    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/** ロック中ノードに南京錠アイコンを描画 */
export function drawLockIndicator(ctx: CanvasRenderingContext2D, node: GraphNode, scale: number): void {
  const size = 14 / scale;
  const px = node.x + node.width - size - 4 / scale;
  const py = node.y + 4 / scale;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `${size}px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('\u{1F512}', px, py);
  ctx.restore();
}
