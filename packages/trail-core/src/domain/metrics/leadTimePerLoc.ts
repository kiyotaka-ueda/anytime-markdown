import { classifyDoraLevel, DEFAULT_THRESHOLDS } from './thresholds';
import type { ThresholdsConfig } from './thresholds';
import type { DateRange, MetricValue } from './types';
import { buildRatioTimeSeries } from './timeSeriesUtils';

type Inputs = {
  messages: Array<{ uuid: string; created_at: string; session_id?: string; type?: string; role?: string }>;
  commits: Array<{ hash: string; committed_at: string; session_id?: string; lines_added?: number; lines_deleted?: number }>;
};

interface CommitSample {
  date: string;
  timeMin: number;
  churn: number;
}

function isUserMessage(m: Inputs['messages'][number]): boolean {
  return m.role === 'user' || m.type === 'user';
}

function computeCommitSamples(inputs: Inputs, range: DateRange): CommitSample[] {
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();

  // user messages grouped by session, sorted ascending by created_at
  const userMsgsBySession = new Map<string, Array<{ ts: string }>>();
  for (const m of inputs.messages) {
    if (!m.session_id) continue;
    if (!isUserMessage(m)) continue;
    const arr = userMsgsBySession.get(m.session_id);
    const entry = { ts: m.created_at };
    if (arr) arr.push(entry);
    else userMsgsBySession.set(m.session_id, [entry]);
  }
  for (const arr of userMsgsBySession.values()) {
    arr.sort((a, b) => a.ts.localeCompare(b.ts));
  }

  // commits grouped by session, sorted ascending by committed_at
  type SessionCommit = { hash: string; committedAt: string; churn: number };
  const commitsBySession = new Map<string, SessionCommit[]>();
  for (const c of inputs.commits) {
    if (!c.session_id) continue;
    const churn = (c.lines_added ?? 0) + (c.lines_deleted ?? 0);
    const entry: SessionCommit = { hash: c.hash, committedAt: c.committed_at, churn };
    const arr = commitsBySession.get(c.session_id);
    if (arr) arr.push(entry);
    else commitsBySession.set(c.session_id, [entry]);
  }
  for (const arr of commitsBySession.values()) {
    arr.sort((a, b) => a.committedAt.localeCompare(b.committedAt));
  }

  // Take the smallest lead-time across multi-session attributions (most accurate).
  const bestByCommit = new Map<string, CommitSample>();

  for (const [sessionId, commits] of commitsBySession) {
    const userMsgs = userMsgsBySession.get(sessionId) ?? [];
    let prevCommitTs: string | null = null;

    for (const c of commits) {
      if (c.churn <= 0) {
        prevCommitTs = c.committedAt;
        continue;
      }
      // Only count commits whose committed_at falls in the requested range.
      const commitMs = new Date(c.committedAt).getTime();
      if (commitMs < fromMs || commitMs > toMs) {
        prevCommitTs = c.committedAt;
        continue;
      }

      // Earliest user message in (prevCommitTs, c.committedAt].
      let earliest: string | null = null;
      for (const u of userMsgs) {
        if (prevCommitTs !== null && u.ts <= prevCommitTs) continue;
        if (u.ts > c.committedAt) break;
        earliest = u.ts;
        break;
      }

      if (earliest !== null) {
        const diffMs = new Date(c.committedAt).getTime() - new Date(earliest).getTime();
        const timeMin = Math.max(0, diffMs / 60_000);
        const sample: CommitSample = { date: c.committedAt, timeMin, churn: c.churn };
        const existing = bestByCommit.get(c.hash);
        if (!existing || sample.timeMin < existing.timeMin) {
          bestByCommit.set(c.hash, sample);
        }
      }

      prevCommitTs = c.committedAt;
    }
  }

  return Array.from(bestByCommit.values());
}

function aggregate(samples: CommitSample[]): number {
  if (samples.length === 0) return 0;
  const sumTime = samples.reduce((a, s) => a + s.timeMin, 0);
  const sumChurn = samples.reduce((a, s) => a + s.churn, 0);
  return sumChurn > 0 ? sumTime / sumChurn : 0;
}

export function computeLeadTimePerLoc(
  inputs: Inputs,
  range: DateRange,
  previousRange: DateRange,
  bucket: 'day' | 'week',
  previousInputs?: Inputs,
  thresholds: ThresholdsConfig = DEFAULT_THRESHOLDS,
): MetricValue {
  const samples = computeCommitSamples(inputs, range);
  const value = aggregate(samples);

  const level = classifyDoraLevel('leadTimePerLoc', value, thresholds);

  const timeSeries = buildRatioTimeSeries(
    samples.map((s) => ({ date: s.date, numerator: s.timeMin, denominator: s.churn })),
    range,
    bucket,
  );

  let comparison: MetricValue['comparison'] | undefined;
  if (previousInputs !== undefined) {
    const prevSamples = computeCommitSamples(previousInputs, previousRange);
    const previousValue = aggregate(prevSamples);
    const deltaPct =
      prevSamples.length === 0 || previousValue === 0
        ? null
        : ((value - previousValue) / previousValue) * 100;
    comparison = { previousValue, deltaPct };
  }

  return {
    id: 'leadTimePerLoc',
    value,
    unit: 'minPerLoc',
    sampleSize: samples.length,
    level,
    comparison,
    timeSeries,
  };
}
