import {
  buildTemporalCouplingUrl,
  fetchTemporalCouplingApi,
} from '../fetchTemporalCouplingApi';

describe('buildTemporalCouplingUrl', () => {
  it('builds URL with required params', () => {
    const url = buildTemporalCouplingUrl('http://localhost:9999', {
      repoName: 'anytime-markdown',
      windowDays: 30,
      threshold: 0.5,
      topK: 50,
    });
    expect(url).toContain('http://localhost:9999/api/temporal-coupling?');
    expect(url).toContain('repo=anytime-markdown');
    expect(url).toContain('windowDays=30');
    expect(url).toContain('threshold=0.5');
    expect(url).toContain('topK=50');
    expect(url).not.toContain('minChange=');
  });

  it('includes minChange when provided', () => {
    const url = buildTemporalCouplingUrl('http://x', {
      repoName: 'r',
      windowDays: 7,
      threshold: 0.3,
      topK: 10,
      minChange: 5,
    });
    expect(url).toContain('minChange=5');
  });

  it('encodes repo names with special characters', () => {
    const url = buildTemporalCouplingUrl('http://x', {
      repoName: 'my repo/x',
      windowDays: 7,
      threshold: 0.3,
      topK: 10,
    });
    expect(url).toContain('repo=my+repo%2Fx');
  });
});

describe('fetchTemporalCouplingApi', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses successful JSON response', async () => {
    const mockResponse = {
      edges: [{ source: 'a.ts', target: 'b.ts', coChangeCount: 3, sourceChangeCount: 5, targetChangeCount: 6, jaccard: 0.5 }],
      computedAt: '2026-04-29T00:00:00.000Z',
      windowDays: 30,
      totalPairs: 1,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const res = await fetchTemporalCouplingApi('http://x', {
      repoName: 'r',
      windowDays: 30,
      threshold: 0.5,
      topK: 50,
    });
    expect(res).toEqual(mockResponse);
  });

  it('throws Error when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as unknown as typeof fetch;

    await expect(
      fetchTemporalCouplingApi('http://x', {
        repoName: 'r',
        windowDays: 30,
        threshold: 0.5,
        topK: 50,
      }),
    ).rejects.toThrow(/500/);
  });

  it('passes AbortSignal to fetch', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ edges: [], computedAt: '', windowDays: 0, totalPairs: 0 }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const controller = new AbortController();
    await fetchTemporalCouplingApi(
      'http://x',
      { repoName: 'r', windowDays: 30, threshold: 0.5, topK: 50 },
      controller.signal,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callArgs = fetchSpy.mock.calls[0];
    expect((callArgs[1] as { signal?: AbortSignal })?.signal).toBe(controller.signal);
  });
});
