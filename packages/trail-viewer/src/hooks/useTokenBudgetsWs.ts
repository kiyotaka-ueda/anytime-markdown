import { useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenBudgetStatus {
  readonly sessionId: string;
  readonly sessionTokens: number;
  readonly dailyTokens: number;
  readonly dailyLimitTokens: number | null;
  readonly sessionLimitTokens: number | null;
  readonly alertThresholdPct: number;
  readonly turnCount: number;
  readonly messageCount: number;
}

interface WsMessage {
  readonly type: string;
}

export interface TokenBudgetsWsOptions {
  /**
   * Called when the server broadcasts a `sessions-updated` event over WS.
   * The orchestrator wires this to refresh sessions and analytics so the
   * cross-cutting behavior of the original useTrailDataSource is preserved.
   */
  readonly onSessionsUpdated?: () => void;
}

export interface TokenBudgetsWsResult {
  readonly tokenBudgets: readonly TokenBudgetStatus[];
  readonly connected: boolean;
}

// ---------------------------------------------------------------------------
// Helpers (module-level — keep in sync with useTrailDataSource.ts until P4 Task 6)
// ---------------------------------------------------------------------------

function isWsMessage(v: unknown): v is WsMessage {
  if (typeof v !== 'object' || v === null) return false;
  return typeof (v as Record<string, unknown>).type === 'string';
}

const RECONNECT_DELAY_MS = 3_000;
const MAX_RETRIES = 5;
const TOKEN_BUDGET_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTokenBudgetsWs(
  serverUrl: string,
  options?: TokenBudgetsWsOptions,
): TokenBudgetsWsResult {
  const [tokenBudgetMap, setTokenBudgetMap] = useState<ReadonlyMap<string, TokenBudgetStatus>>(
    new Map(),
  );
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenBudgetTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Hold latest options in a ref so the WS effect closure does not capture
  // stale callbacks while still being driven only by `serverUrl` changes.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Token budget timer cleanup on unmount
  useEffect(() => {
    const timers = tokenBudgetTimerRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  // WebSocket (only when serverUrl is an absolute URL)
  useEffect(() => {
    if (!serverUrl) return;

    function connect(): void {
      const host = new URL(serverUrl).host;
      const ws = new WebSocket(`ws://${host}/ws`);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setConnected(true);
        retryCountRef.current = 0;
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const parsed: unknown = JSON.parse(String(event.data));
          if (isWsMessage(parsed) && parsed.type === 'sessions-updated') {
            optionsRef.current?.onSessionsUpdated?.();
          }
          if (isWsMessage(parsed) && parsed.type === 'token-budget-updated') {
            const status = parsed as unknown as TokenBudgetStatus;
            setTokenBudgetMap((prev) => {
              const next = new Map(prev);
              next.set(status.sessionId, status);
              return next;
            });
            const existing = tokenBudgetTimerRef.current.get(status.sessionId);
            if (existing) clearTimeout(existing);
            const timer = setTimeout(() => {
              setTokenBudgetMap((prev) => {
                if (!prev.has(status.sessionId)) return prev;
                const next = new Map(prev);
                next.delete(status.sessionId);
                return next;
              });
              tokenBudgetTimerRef.current.delete(status.sessionId);
            }, TOKEN_BUDGET_TTL_MS);
            tokenBudgetTimerRef.current.set(status.sessionId, timer);
          }
        } catch {
          // Malformed message — ignore
        }
      });

      ws.addEventListener('close', () => {
        setConnected(false);
        scheduleReconnect();
      });

      ws.addEventListener('error', () => {
        setConnected(false);
        ws.close();
      });
    }

    function scheduleReconnect(): void {
      if (retryCountRef.current >= MAX_RETRIES) return;
      retryCountRef.current += 1;
      retryTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    }

    connect();

    return () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  const tokenBudgets = useMemo(() => Array.from(tokenBudgetMap.values()), [tokenBudgetMap]);

  return {
    tokenBudgets,
    connected,
  };
}
