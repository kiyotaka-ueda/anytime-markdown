import { probeServerAlive, clearProbeCache } from '../probe';

const BASE_URL = 'http://localhost:3000';

function mockFetch(status: number): jest.Mock {
  return jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status });
}

describe('probeServerAlive', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    clearProbeCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearProbeCache();
  });

  it('200 → true を返す', async () => {
    (globalThis as Record<string, unknown>).fetch = mockFetch(200);
    expect(await probeServerAlive(BASE_URL)).toBe(true);
  });

  it('500 → false を返す', async () => {
    (globalThis as Record<string, unknown>).fetch = mockFetch(500);
    expect(await probeServerAlive(BASE_URL)).toBe(false);
  });

  it('fetch が reject → false を返す', async () => {
    (globalThis as Record<string, unknown>).fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    expect(await probeServerAlive(BASE_URL)).toBe(false);
  });

  it('AbortError (timeout) → false を返す', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    (globalThis as Record<string, unknown>).fetch = jest.fn().mockRejectedValue(abortError);
    expect(await probeServerAlive(BASE_URL)).toBe(false);
  });

  it('キャッシュヒット: 同じ URL を連続呼び出しすると fetch は1回しか呼ばれない', async () => {
    const fetchMock = mockFetch(200);
    (globalThis as Record<string, unknown>).fetch = fetchMock;
    await probeServerAlive(BASE_URL);
    await probeServerAlive(BASE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clearProbeCache() 後 → 再度 fetch が呼ばれる', async () => {
    const fetchMock = mockFetch(200);
    (globalThis as Record<string, unknown>).fetch = fetchMock;
    await probeServerAlive(BASE_URL);
    clearProbeCache();
    await probeServerAlive(BASE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('TTL 経過後 → 再度 fetch が呼ばれる', async () => {
    jest.useFakeTimers();
    const fetchMock = mockFetch(200);
    (globalThis as Record<string, unknown>).fetch = fetchMock;
    await probeServerAlive(BASE_URL, 1000);
    // TTL 経過
    jest.advanceTimersByTime(2000);
    await probeServerAlive(BASE_URL, 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
