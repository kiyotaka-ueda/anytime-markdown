import { useEffect, useRef, useState } from 'react';
import { fetchElementFunctionsApi, type ElementFunctionsResponse } from './fetchElementFunctionsApi';

export interface UseElementFunctionsOptions {
  serverUrl: string | undefined;
  elementId: string | null;
  enabled: boolean;
}

export interface UseElementFunctionsResult {
  data: ElementFunctionsResponse | null;
  loading: boolean;
}

export function useElementFunctions(options: UseElementFunctionsOptions): UseElementFunctionsResult {
  const { serverUrl, elementId, enabled } = options;
  const [data, setData] = useState<ElementFunctionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !serverUrl || !elementId) {
      abortRef.current?.abort();
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);
    fetchElementFunctionsApi(serverUrl, elementId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setData(res);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const err = e instanceof Error ? e : new Error(String(e));
        if (err.name === 'AbortError') return;
        setLoading(false);
      });
    return () => { controller.abort(); };
  }, [enabled, serverUrl, elementId]);

  return { data, loading };
}
