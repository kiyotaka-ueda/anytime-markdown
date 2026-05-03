import { buildActivityHeatmapUrl, fetchActivityHeatmapApi } from '../fetchActivityHeatmapApi';

describe('buildActivityHeatmapUrl', () => {
  it('builds URL with mode and period', () => {
    const url = buildActivityHeatmapUrl('http://x', { period: '30d', mode: 'session-file' });
    expect(url).toContain('mode=session-file');
    expect(url).toContain('period=30d');
    expect(url).not.toContain('topK=');
  });

  it('includes topK when provided', () => {
    const url = buildActivityHeatmapUrl('http://x', {
      period: '30d',
      mode: 'session-file',
      topK: 5,
    });
    expect(url).toContain('topK=5');
  });
});

describe('fetchActivityHeatmapApi', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  it('throws on 4xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, statusText: 'Bad' }) as typeof fetch;
    await expect(
      fetchActivityHeatmapApi('http://x', { period: '30d', mode: 'session-file' }),
    ).rejects.toThrow(/400/);
  });
});
