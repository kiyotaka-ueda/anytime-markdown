import type { TemporalCouplingControlsValue } from './components/overlays/TemporalCouplingControls';

export const UNKNOWN_REPO_KEY = '__unknown__';
export const CURRENT_RELEASE_TAG = 'current';
export const SELECTED_ELEMENT_DETAILS_WIDTH = 240;
export const SELECTED_ELEMENT_DETAILS_RIGHT_OFFSET = 8;
export const TREND_CHART_POPUP_GAP = 8;
export const TREND_CHART_POPUP_MAX_WIDTH = 1000;
export const TREND_CHART_RESERVED_RIGHT_WIDTH =
  SELECTED_ELEMENT_DETAILS_WIDTH + SELECTED_ELEMENT_DETAILS_RIGHT_OFFSET + TREND_CHART_POPUP_GAP;

export const DEFAULT_TC_VALUE: TemporalCouplingControlsValue = {
  enabled: false,
  windowDays: 30,
  threshold: 0.5,
  topK: 50,
  directional: false,
  confidenceThreshold: 0.5,
  directionalDiff: 0.3,
  granularity: 'commit',
};

/** チェックボックス非表示フィルタ対象の型（system は常時表示のため除外） */
export const FILTER_CHECKABLE_TYPES = new Set(['container', 'containerDb', 'component'] as const);
/** ドリルダウン時のスコープに含まれる型 */
export const DRILL_SCOPE_TYPES = new Set(['system', 'container', 'containerDb', 'component'] as const);
