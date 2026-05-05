/**
 * Metric / quality visualization colors — mode-independent.
 * Used by CoverageCanvas, MatrixPanel, OverlayLegend, DeadCodeDetailSection,
 * ActivityTrendChart, and related components.
 */

// ---------------------------------------------------------------------------
// Coverage threshold colors
// ---------------------------------------------------------------------------

export const COVERAGE_HIGH = '#2e7d32';
export const COVERAGE_MID  = '#f9a825';
export const COVERAGE_LOW  = '#c62828';
export const COVERAGE_NONE = '#616161';

/** Used as a "zero" / "search" reference color in DSM and complexity legends. */
export const METRIC_LEGEND_BLUE = '#1565c0';

/** Returns the appropriate coverage color for a given percentage. */
export function getCoverageColor(pct: number): string {
  if (pct >= 80) return COVERAGE_HIGH;
  if (pct >= 50) return COVERAGE_MID;
  return COVERAGE_LOW;
}

/** Returns foreground text color for a coverage percentage background. */
export function getCoverageTextColor(pct: number): string {
  if (pct >= 50 && pct < 80) return '#1a1a1a';
  return '#ffffff';
}

// ---------------------------------------------------------------------------
// Coverage delta colors
// ---------------------------------------------------------------------------

export const DELTA_POSITIVE = '#4caf50';
export const DELTA_NEGATIVE = '#ef5350';

// ---------------------------------------------------------------------------
// Dead code severity colors
// ---------------------------------------------------------------------------

export const DEAD_CODE_COLORS: Readonly<Record<'strong' | 'review' | 'healthy' | 'ignored', string>> = {
  strong:  '#f44336',
  review:  '#ffc107',
  healthy: '#4caf50',
  ignored: '#9e9e9e',
};

// ---------------------------------------------------------------------------
// Activity trend chart series colors
// ---------------------------------------------------------------------------

export const ACTIVITY_TREND_COLORS = {
  dark: {
    commit: '#E8A012',
    read:   '#7AB8FF',
    write:  '#76C893',
    defect: '#FF8A80',
  },
  light: {
    commit: '#3D4A52',
    read:   '#1565C0',
    write:  '#2E7D32',
    defect: '#C62828',
  },
} as const;
