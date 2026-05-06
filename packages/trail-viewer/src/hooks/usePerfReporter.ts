import { useCallback, useEffect, useRef } from 'react';

export interface PerfMetric {
  readonly metric: string;
  readonly ms: number;
  readonly meta?: Record<string, unknown>;
}

export interface PerfReporter {
  /** 計測値を perf-report として送信する。WebSocket 未接続時はキューイング。 */
  readonly report: (metric: string, ms: number, meta?: Record<string, unknown>) => void;
}

type SendFn = (cmd: string, payload?: unknown) => void;

/**
 * Standalone Viewer の perf 計測値を WebSocket 経由で extension に送るための薄い hook。
 *
 * - send 関数 (useC4DataSource().sendCommand など) を受け取り、`perf-report` コマンドに変換して送信
 * - WebSocket 未接続時 (`connected=false`) は in-memory queue に保持
 * - 接続が確立した瞬間 (connected が true に遷移) に蓄積した queue を順序保持で flush
 * - WebSocket close 後の再接続キューは持たない (perf 計測は best-effort)
 *
 * Web アプリ版では `disableWebSocket=true` により sendCommand は no-op、
 * connected も常に false なので queue は積まれるだけで送信されない（拡張機能のみで有効）。
 */
export function usePerfReporter(send: SendFn, connected: boolean): PerfReporter {
  const queueRef = useRef<PerfMetric[]>([]);
  const sendRef = useRef<SendFn>(send);
  // 最新の send を ref で参照して useEffect の deps を増やさない
  sendRef.current = send;

  // connected が true に遷移したとき、queue を flush
  useEffect(() => {
    if (!connected) return;
    if (queueRef.current.length === 0) return;
    const drained = queueRef.current;
    queueRef.current = [];
    for (const m of drained) {
      sendRef.current('perf-report', m);
    }
  }, [connected]);

  const report = useCallback(
    (metric: string, ms: number, meta?: Record<string, unknown>) => {
      const payload: PerfMetric = meta !== undefined
        ? { metric, ms, meta }
        : { metric, ms };
      if (connected) {
        sendRef.current('perf-report', payload);
      } else {
        queueRef.current.push(payload);
      }
    },
    [connected],
  );

  return { report };
}
