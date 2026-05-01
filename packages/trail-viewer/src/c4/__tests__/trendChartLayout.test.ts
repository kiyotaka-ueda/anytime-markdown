import type { C4Model } from '@anytime-markdown/trail-core/c4';

import {
  canShowManualContextActions,
  getActivityTrendChartPlacement,
  getActivityTrendChartWidth,
} from '../components/C4ViewerCore';

describe('getActivityTrendChartWidth', () => {
  it('keeps the trend chart full width when element details are hidden', () => {
    expect(getActivityTrendChartWidth(false)).toBe('100%');
  });

  it('reserves the selected element details popup width when it is visible', () => {
    expect(getActivityTrendChartWidth(true)).toBe('calc(100% - 256px)');
  });

  it('overlays the trend chart so the graph area and popup height stay stable', () => {
    expect(getActivityTrendChartPlacement()).toEqual({
      position: 'absolute',
      left: 0,
      bottom: 0,
      zIndex: 9,
    });
  });
});

describe('canShowManualContextActions', () => {
  const model: C4Model = {
    level: 'context',
    elements: [
      { id: 'manual_system', type: 'system', name: 'Manual', manual: true },
      { id: 'generated_system', type: 'system', name: 'Generated' },
    ],
    relationships: [],
  };

  it('enables context actions only for manual elements', () => {
    expect(canShowManualContextActions(model, 'manual_system')).toBe(true);
    expect(canShowManualContextActions(model, 'generated_system')).toBe(false);
    expect(canShowManualContextActions(model, 'missing')).toBe(false);
  });

  it('keeps context actions hidden without a selected C4 element', () => {
    expect(canShowManualContextActions(model, null)).toBe(false);
    expect(canShowManualContextActions(null, 'manual_system')).toBe(false);
  });
});
