import { useEffect, useRef, useState } from 'react';

import {
  fetchActivityTrendApi,
  type ActivityTrendFetchParams,
  type ActivityTrendResponse,
} from './fetchActivityTrendApi';

export interface UseActivityTrendOptions extends ActivityTrendFetchParams {
  enabled: boolean;
  serverUrl: string | undefined;
  debounceMs?: number;
}

export interface UseActivityTrendResult {
  data: ActivityTrendResponse | null;
  loading: boolean;
  error: Error | null;
}

const DEFAULT_DEBOUNCE_MS = 300;

export function useActivityTrend(
  options: UseActivityTrendOptions,
): UseActivityTrendResult {
  const {
    enabled,
    serverUrl,
    elementId,
    period,
    granularity,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;
  const [data, setData] = useState<ActivityTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !serverUrl || !elementId) {
      abortRef.current?.abort();
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetchActivityTrendApi(serverUrl, { elementId, period, granularity }, controller.signal)
        .then((res) => {
          if (controller.signal.aborted) return;
          setData(res);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          const err = e instanceof Error ? e : new Error(String(e));
          if (err.name === 'AbortError') return;
          setError(err);
          setLoading(false);
        });
    }, debounceMs);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [enabled, serverUrl, elementId, period, granularity, debounceMs]);

  return { data, loading, error };
}
