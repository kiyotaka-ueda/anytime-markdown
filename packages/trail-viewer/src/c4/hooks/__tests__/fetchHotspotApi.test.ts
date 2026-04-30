import { buildHotspotUrl, fetchHotspotApi } from '../fetchHotspotApi';

describe('buildHotspotUrl', () => {
  it('builds URL with default params', () => {
    const url = buildHotspotUrl('http://localhost:9999', { period: '30d', granularity: 'commit' });
    expect(url).toBe('http://localhost:9999/api/hotspot?period=30d&granularity=commit');
  });

  it('encodes session granularity', () => {
    const url = buildHotspotUrl('http://x', { period: '7d', granularity: 'session' });
    expect(url).toContain('granularity=session');
    expect(url).toContain('period=7d');
  });
});

describe('fetchHotspotApi', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('throws when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal' }) as typeof fetch;
    await expect(
      fetchHotspotApi('http://x', { period: '30d', granularity: 'commit' }),
    ).rejects.toThrow(/500/);
  });

  it('returns parsed JSON when response is ok', async () => {
    const payload = { period: '30d', granularity: 'commit', from: 'a', to: 'b', files: [] };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    }) as typeof fetch;
    const res = await fetchHotspotApi('http://x', { period: '30d', granularity: 'commit' });
    expect(res).toEqual(payload);
  });
});
