import { getActivityTrendChartPlacement, getActivityTrendChartWidth } from '../components/C4ViewerCore';

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
