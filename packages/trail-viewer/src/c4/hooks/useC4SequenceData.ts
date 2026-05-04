import { useEffect, useRef, useState } from 'react';
import type { SequenceModel } from '@anytime-markdown/trace-core/c4Sequence';
import { fetchC4SequenceApi } from './fetchC4SequenceApi';

export interface UseC4SequenceDataResult {
  readonly model: SequenceModel | null;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * 指定された C4 要素 ID から SequenceModel を取得するフック。
 *
 * @param serverUrl データソース URL
 * @param elementId 起点要素 ID。null/undefined の場合は fetch しない
 */
export function useC4SequenceData(
  serverUrl: string | undefined,
  elementId: string | null | undefined,
): UseC4SequenceDataResult {
  const [model, setModel] = useState<SequenceModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!serverUrl || !elementId) {
      abortRef.current?.abort();
      setModel(null);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    fetchC4SequenceApi(serverUrl, elementId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setModel(res);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const err = e instanceof Error ? e : new Error(String(e));
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [serverUrl, elementId]);

  return { model, loading, error };
}
