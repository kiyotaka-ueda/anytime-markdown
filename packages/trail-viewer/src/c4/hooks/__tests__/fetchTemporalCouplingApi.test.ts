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

  it('omits directional params when directional is false/undefined', () => {
    const url = buildTemporalCouplingUrl('http://x', {
      repoName: 'r',
      windowDays: 7,
      threshold: 0.3,
      topK: 10,
    });
    expect(url).not.toContain('directional=');
    expect(url).not.toContain('confidenceThreshold=');
    expect(url).not.toContain('directionalDiff=');
  });

  it('includes directional params when directional=true', () => {
    const url = buildTemporalCouplingUrl('http://x', {
      repoName: 'r',
      windowDays: 7,
      threshold: 0.3,
      topK: 10,
      directional: true,
      confidenceThreshold: 0.5,
      directionalDiff: 0.3,
    });
    expect(url).toContain('directional=true');
    expect(url).toContain('confidenceThreshold=0.5');
    expect(url).toContain('directionalDiff=0.3');
  });

  it('omits directional sub-params when directional flag is false', () => {
    const url = buildTemporalCouplingUrl('http://x', {
      repoName: 'r',
      windowDays: 7,
      threshold: 0.3,
      topK: 10,
      directional: false,
      confidenceThreshold: 0.5,
      directionalDiff: 0.3,
    });
    expect(url).not.toContain('directional=true');
    expect(url).not.toContain('confidenceThreshold=');
    expect(url).not.toContain('directionalDiff=');
  });

  it('omits granularity when not specified', () => {
    const url = buildTemporalCouplingUrl('http://x', {
      repoName: 'r',
      windowDays: 7,
      threshold: 0.3,
      topK: 10,
    });
    expect(url).not.toContain('granularity=');
  });

  it('includes granularity=session when specified', () => {
    const url = buildTemporalCouplingUrl('http://x', {
      repoName: 'r',
      windowDays: 7,
      threshold: 0.3,
      topK: 10,
      granularity: 'session',
    });
    expect(url).toContain('granularity=session');
  });

  it('includes granularity=commit when explicitly specified', () => {
    const url = buildTemporalCouplingUrl('http://x', {
      repoName: 'r',
      windowDays: 7,
      threshold: 0.3,
      topK: 10,
      granularity: 'commit',
    });
    expect(url).toContain('granularity=commit');
  });

  it('includes granularity=subagentType when specified', () => {
    const url = buildTemporalCouplingUrl('http://x', {
      repoName: 'r',
      windowDays: 7,
      threshold: 0.3,
      topK: 10,
      granularity: 'subagentType',
    });
    expect(url).toContain('granularity=subagentType');
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

  it('parses directional response shape', async () => {
    const mockResponse = {
      directional: true,
      edges: [
        {
          source: 'login.ts',
          target: 'auth.ts',
          direction: 'A→B',
          confidenceForward: 1.0,
          confidenceBackward: 0.25,
          coChangeCount: 1,
          sourceChangeCount: 1,
          targetChangeCount: 4,
          jaccard: 0.25,
        },
      ],
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
      directional: true,
      confidenceThreshold: 0.5,
      directionalDiff: 0.3,
    });
    expect(res).toEqual(mockResponse);
    if ('directional' in res && res.directional === true) {
      expect(res.edges[0].direction).toBe('A→B');
    }
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
