import {
  COLOR_SHADOW, COLOR_SHADOW_LIGHT, COLOR_DRAG_GLOW,
} from '../theme';

// ── Handle / Hit-test ──

/** リサイズハンドルの半径 (px) */
export const HANDLE_SIZE = 8;
/** エッジヒットテストの許容距離 (px) */
export const EDGE_TOLERANCE = 6;
/** 接続ポイントの描画半径 (px) */
export const CONNECTION_POINT_RADIUS = 10;
/** エッジ端点ハンドルの半径 (px) */
export const ENDPOINT_HANDLE_RADIUS = 10;
/** スナップインジケータの半径 (px) */
export const SNAP_INDICATOR_RADIUS = 6;

// ── Shadow ──

export interface ShadowStyle {
  readonly color: string;
  readonly blur: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export const SHADOW_DEFAULT: ShadowStyle = { color: COLOR_SHADOW, blur: 12, offsetX: 3, offsetY: 3 };
export const SHADOW_STICKY: ShadowStyle = { color: COLOR_SHADOW_LIGHT, blur: 8, offsetX: 2, offsetY: 2 };
export const SHADOW_DRAGGING: ShadowStyle = { color: COLOR_DRAG_GLOW, blur: 16, offsetX: 4, offsetY: 4 };

// ── Font size ──

export const FONT_SIZE_BADGE = 10;
export const FONT_SIZE_PREVIEW = 11;
export const FONT_SIZE_TOOLTIP = 11;
export const FONT_SIZE_EDGE_LABEL = 12;
export const FONT_SIZE_LINK_ICON = 12;

// ── Dash patterns ──

export const DASH_DEFAULT: readonly number[] = [4, 4];
export const DASH_FRAME: readonly number[] = [6, 3];
export const DASH_OVERLAY: readonly number[] = [6, 4];

// ── Stroke width ──

export const STROKE_WIDTH_SELECTED = 3;

// ── Text limits ──

export const TEXT_PREVIEW_MAX_CHARS = 100;
export const TEXT_PREVIEW_MAX_LINES = 3;
export const TEXT_LINE_MAX_CHARS = 30;
export const URL_TRUNCATE_LENGTH = 50;

// ── Endpoint shape dimensions ──

export const ARROW_HEAD_LENGTH = 12;
export const ENDPOINT_CIRCLE_RADIUS = 5;
export const ENDPOINT_DIAMOND_SIZE = 8;
export const ENDPOINT_BAR_LENGTH = 8;
