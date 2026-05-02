import { useEffect, useRef, useState } from 'react';

import {
  fetchActivityHeatmapApi,
  type ActivityHeatmapFetchParams,
  type ActivityHeatmapResponse,
} from './fetchActivityHeatmapApi';

export interface UseActivityHeatmapOptions extends ActivityHeatmapFetchParams {
  enabled: boolean;
  serverUrl: string | undefined;
  debounceMs?: number;
}

export interface UseActivityHeatmapResult {
  data: ActivityHeatmapResponse | null;
  loading: boolean;
  error: Error | null;
}

const DEFAULT_DEBOUNCE_MS = 300;

export function useActivityHeatmap(
  options: UseActivityHeatmapOptions,
): UseActivityHeatmapResult {
  const { enabled, serverUrl, period, mode, topK, repoName, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  const [data, setData] = useState<ActivityHeatmapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !serverUrl) {
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
      fetchActivityHeatmapApi(serverUrl, { period, mode, topK, repoName }, controller.signal)
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
  }, [enabled, serverUrl, period, mode, topK, repoName, debounceMs]);

  return { data, loading, error };
}
