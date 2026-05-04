import { useCallback, useEffect, useState } from 'react';
import type { CodeGraph } from '@anytime-markdown/trail-core/codeGraph';

export interface UseCodeGraphResult {
  graph: CodeGraph | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseCodeGraphOptions {
  /** false の場合 fetch を行わず、graph は null のまま保持される */
  readonly enabled?: boolean;
  /** リリースタグ（'current' で最新スナップショット）。デフォルト 'current' */
  readonly release?: string;
  /** リポジトリ名。release !== 'current' のとき releases.repo_name による帰属確認に使用 */
  readonly repo?: string;
}

export function useCodeGraph(
  serverUrl: string,
  options: UseCodeGraphOptions = {},
): UseCodeGraphResult {
  const { enabled = true, release = 'current', repo } = options;
  const [graph, setGraph] = useState<CodeGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (release && release !== 'current') params.set('release', release);
      if (repo) params.set('repo', repo);
      const qs = params.toString();
      const url = `${serverUrl}/api/code-graph${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      if (res.status === 404) {
        setGraph(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CodeGraph;
      setGraph(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [serverUrl, enabled, release, repo]);

  useEffect(() => {
    void load();
  }, [load]);

  return { graph, loading, error, refetch: load };
}
