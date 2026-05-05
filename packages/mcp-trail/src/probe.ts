const cache = new Map<string, { result: boolean; expiresAt: number }>();

const DEFAULT_TTL_MS = 10000;

export async function probeServerAlive(serverUrl: string, ttlMs: number = DEFAULT_TTL_MS): Promise<boolean> {
  const now = Date.now();
  const cached = cache.get(serverUrl);
  if (cached !== undefined && now < cached.expiresAt) {
    return cached.result;
  }

  let result = false;
  try {
    const res = await fetch(`${serverUrl}/api/analyze/status`, {
      signal: AbortSignal.timeout(500),
    });
    result = res.ok;
  } catch {
    result = false;
  }

  cache.set(serverUrl, { result, expiresAt: now + ttlMs });
  return result;
}

export function clearProbeCache(): void {
  cache.clear();
}
