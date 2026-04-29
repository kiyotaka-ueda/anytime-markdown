import { useEffect, useRef, useState } from 'react';

import type { TemporalCouplingEdge } from '@anytime-markdown/trail-core';

import {
  fetchTemporalCouplingApi,
  type TemporalCouplingFetchParams,
} from './fetchTemporalCouplingApi';

export interface UseTemporalCouplingOptions extends TemporalCouplingFetchParams {
  enabled: boolean;
  serverUrl: string | undefined;
  debounceMs?: number;
}

export interface UseTemporalCouplingResult {
  edges: TemporalCouplingEdge[];
  loading: boolean;
  error: Error | null;
}

const DEFAULT_DEBOUNCE_MS = 300;

export function useTemporalCoupling(
  options: UseTemporalCouplingOptions,
): UseTemporalCouplingResult {
  const {
    enabled,
    serverUrl,
    repoName,
    windowDays,
    threshold,
    topK,
    minChange,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  const [edges, setEdges] = useState<TemporalCouplingEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !serverUrl || !repoName) {
      abortRef.current?.abort();
      setEdges([]);
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
      fetchTemporalCouplingApi(
        serverUrl,
        { repoName, windowDays, threshold, topK, minChange },
        controller.signal,
      )
        .then((res) => {
          if (controller.signal.aborted) return;
          setEdges(res.edges);
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
  }, [enabled, serverUrl, repoName, windowDays, threshold, topK, minChange, debounceMs]);

  return { edges, loading, error };
}
