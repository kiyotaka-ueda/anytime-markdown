import { useCallback, useEffect, useState } from 'react';

import type {
  TrailFilter,
  TrailMessage,
  TrailSession,
  TrailSessionCommit,
} from '../domain/parser/types';

// ---------------------------------------------------------------------------
// Helpers (module-level — keep in sync with useTrailDataSource.ts until P4 Task 6)
// ---------------------------------------------------------------------------

function buildQueryString(filter: TrailFilter): string {
  const params = new URLSearchParams();
  if (filter.gitBranch) params.set('branch', filter.gitBranch);
  if (filter.model) params.set('model', filter.model);
  if (filter.searchText) params.set('q', filter.searchText);
  if (filter.dateRange) {
    params.set('from', filter.dateRange.from);
    params.set('to', filter.dateRange.to);
  }
  if (filter.workspace) params.set('workspace', filter.workspace);
  if (filter.toolName) params.set('toolName', filter.toolName);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionsDataResult {
  readonly sessions: readonly TrailSession[];
  readonly allSessions: readonly TrailSession[];
  readonly sessionsLoading: boolean;
  readonly messages: readonly TrailMessage[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly loadSession: (id: string) => void;
  readonly searchSessions: (filter: TrailFilter) => void;
  readonly fetchSessionMessages: (id: string) => Promise<readonly TrailMessage[]>;
  readonly fetchSessionCommits: (id: string) => Promise<readonly TrailSessionCommit[]>;
  /**
   * Re-fetch the full session list. Exposed for the orchestrator to wire up
   * cross-cutting WS events (e.g. `sessions-updated`).
   */
  readonly refetchAll: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSessionsData(serverUrl: string): SessionsDataResult {
  const [sessions, setSessions] = useState<readonly TrailSession[]>([]);
  const [allSessions, setAllSessions] = useState<readonly TrailSession[]>([]);
  const [messages, setMessages] = useState<readonly TrailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = serverUrl;

  const fetchSessions = useCallback(
    async (filter?: TrailFilter, isInitial = false): Promise<void> => {
      setSessionsLoading(true);
      setError(null);
      try {
        const queryString = filter ? buildQueryString(filter) : '';
        const res = await fetch(`${baseUrl}/api/trail/sessions${queryString}`);
        if (!res.ok) {
          setError(`Failed to fetch sessions: ${res.status}`);
          return;
        }
        const data: unknown = await res.json();
        let parsed: readonly TrailSession[];
        if (Array.isArray(data)) {
          parsed = data as readonly TrailSession[];
        } else if (data && typeof data === 'object' && 'sessions' in data) {
          parsed = (data as { sessions: readonly TrailSession[] }).sessions;
        } else {
          parsed = [];
        }
        setSessions(parsed);
        if (isInitial) {
          setAllSessions(parsed);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
      } finally {
        setSessionsLoading(false);
      }
    },
    [baseUrl],
  );

  const loadSession = useCallback(
    (id: string): void => {
      setLoading(true);
      setError(null);

      fetch(`${baseUrl}/api/trail/sessions/${encodeURIComponent(id)}`)
        .then(async (res) => {
          if (!res.ok) {
            setError(`Failed to load session: ${res.status}`);
            return;
          }
          const data: unknown = await res.json();
          if (data && typeof data === 'object' && 'messages' in data) {
            setMessages((data as { messages: readonly TrailMessage[] }).messages);
          } else if (Array.isArray(data)) {
            setMessages(data as readonly TrailMessage[]);
          }
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to load session');
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [baseUrl],
  );

  const fetchSessionMessages = useCallback(
    async (id: string): Promise<readonly TrailMessage[]> => {
      const res = await fetch(`${baseUrl}/api/trail/sessions/${encodeURIComponent(id)}`);
      if (!res.ok) return [];
      const data: unknown = await res.json();
      if (data && typeof data === 'object' && 'messages' in data) {
        return (data as { messages: readonly TrailMessage[] }).messages;
      }
      if (Array.isArray(data)) return data as readonly TrailMessage[];
      return [];
    },
    [baseUrl],
  );

  const fetchSessionCommits = useCallback(
    async (id: string): Promise<readonly TrailSessionCommit[]> => {
      try {
        const res = await fetch(`${baseUrl}/api/trail/sessions/${encodeURIComponent(id)}/commits`);
        if (!res.ok) return [];
        const data = (await res.json()) as { commits: readonly TrailSessionCommit[] };
        return data.commits ?? [];
      } catch {
        return [];
      }
    },
    [baseUrl],
  );

  const searchSessions = useCallback(
    (filter: TrailFilter): void => {
      void fetchSessions(filter);
    },
    [fetchSessions],
  );

  const refetchAll = useCallback(
    async (): Promise<void> => {
      await fetchSessions(undefined, true);
    },
    [fetchSessions],
  );

  // Initial fetch
  useEffect(() => {
    void fetchSessions(undefined, true);
  }, [fetchSessions]);

  return {
    sessions,
    allSessions,
    sessionsLoading,
    messages,
    loading,
    error,
    loadSession,
    searchSessions,
    fetchSessionMessages,
    fetchSessionCommits,
    refetchAll,
  };
}
