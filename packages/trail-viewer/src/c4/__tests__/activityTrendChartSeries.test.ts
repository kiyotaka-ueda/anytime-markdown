import type { ActivityTrendResponse } from '../hooks/fetchActivityTrendApi';
import { buildActivityTrendSeries } from '../components/ActivityTrendChart';

function singleSeries(
  granularity: 'commit' | 'session',
  buckets: ReadonlyArray<{ readonly date: string; readonly count: number }>,
): ActivityTrendResponse {
  return {
    elementId: 'comp_a',
    period: '30d',
    granularity,
    from: '2026-04-01T00:00:00.000Z',
    to: '2026-04-30T00:00:00.000Z',
    type: 'single-series',
    bucketSize: '1d',
    buckets,
  };
}

describe('buildActivityTrendSeries', () => {
  it('combines commit, read, and write trends into three chart series', () => {
    const result = buildActivityTrendSeries(
      singleSeries('commit', [
        { date: '2026-04-01', count: 1 },
        { date: '2026-04-02', count: 2 },
      ]),
      singleSeries('session', [
        { date: '2026-04-01', count: 3 },
        { date: '2026-04-02', count: 4 },
      ]),
      singleSeries('session', [
        { date: '2026-04-01', count: 5 },
        { date: '2026-04-02', count: 6 },
      ]),
      { commit: 'Commit', read: 'Read', write: 'Write' },
      { commit: '#111111', read: '#222222', write: '#333333' },
    );

    expect(result).toEqual({
      xs: ['2026-04-01', '2026-04-02'],
      series: [
        { data: [1, 2], label: 'Commit', color: '#111111' },
        { data: [3, 4], label: 'Read', color: '#222222' },
        { data: [5, 6], label: 'Write', color: '#333333' },
      ],
    });
  });

  it('aligns read and write buckets to commit bucket dates', () => {
    const result = buildActivityTrendSeries(
      singleSeries('commit', [
        { date: '2026-04-01', count: 1 },
        { date: '2026-04-02', count: 2 },
      ]),
      singleSeries('session', [{ date: '2026-04-01', count: 3 }]),
      singleSeries('session', [{ date: '2026-04-02', count: 4 }]),
      { commit: 'Commit', read: 'Read', write: 'Write' },
      { commit: '#111111', read: '#222222', write: '#333333' },
    );

    expect(result?.series[1].data).toEqual([3, 0]);
    expect(result?.series[2].data).toEqual([0, 4]);
  });
});
