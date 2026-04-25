import { classifyDoraLevel, DEFAULT_THRESHOLDS } from './thresholds';
import type { ThresholdsConfig } from './thresholds';
import { extractCommitPrefix } from '../model/commitPrefix';
import type { DateRange, MetricValue } from './types';
import { buildRatioTimeSeries, buildTimeSeries } from './timeSeriesUtils';

type Inputs = {
  messages: Array<{ uuid: string; created_at: string; session_id?: string; type?: string; role?: string }>;
  commits: Array<{ hash: string; subject?: string; committed_at: string; session_id?: string; lines_added?: number; lines_deleted?: number }>;
};

interface CommitSample {
  date: string;
  timeMin: number;
  churn: number;
  prefix: string;
}

interface CommitSamplesResult {
  samples: CommitSample[];
  unmappedDates: string[];
}

function isUserMessage(m: Inputs['messages'][number]): boolean {
  return m.role === 'user' || m.type === 'user';
}

function computeCommitSamples(inputs: Inputs, range: DateRange): CommitSamplesResult {
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
  type SessionCommit = { hash: string; committedAt: string; churn: number; prefix: string };
  const commitsBySession = new Map<string, SessionCommit[]>();
  for (const c of inputs.commits) {
    if (!c.session_id) continue;
    const churn = (c.lines_added ?? 0) + (c.lines_deleted ?? 0);
    const prefix = c.subject ? extractCommitPrefix(c.subject) : 'other';
    const entry: SessionCommit = { hash: c.hash, committedAt: c.committed_at, churn, prefix };
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
        const sample: CommitSample = { date: c.committedAt, timeMin, churn: c.churn, prefix: c.prefix };
        const existing = bestByCommit.get(c.hash);
        if (!existing || sample.timeMin < existing.timeMin) {
          bestByCommit.set(c.hash, sample);
        }
      }

      prevCommitTs = c.committedAt;
    }
  }

  // Track all commits eligible for lead-time but not actually mapped to a prompt.
  // "Eligible" = in range, churn > 0. Includes commits with no session_id.
  const allEligibleByHash = new Map<string, string>();
  for (const c of inputs.commits) {
    const churn = (c.lines_added ?? 0) + (c.lines_deleted ?? 0);
    if (churn <= 0) continue;
    const ms = new Date(c.committed_at).getTime();
    if (ms < fromMs || ms > toMs) continue;
    allEligibleByHash.set(c.hash, c.committed_at);
  }

  const unmappedDates: string[] = [];
  for (const [hash, date] of allEligibleByHash) {
    if (!bestByCommit.has(hash)) unmappedDates.push(date);
  }

  return { samples: Array.from(bestByCommit.values()), unmappedDates };
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
  const { samples } = computeCommitSamples(inputs, range);
  const value = aggregate(samples);

  const level = classifyDoraLevel('leadTimePerLoc', value, thresholds);

  const timeSeries = buildRatioTimeSeries(
    samples.map((s) => ({ date: s.date, numerator: s.timeMin, denominator: s.churn })),
    range,
    bucket,
  );

  let comparison: MetricValue['comparison'] | undefined;
  if (previousInputs !== undefined) {
    const { samples: prevSamples } = computeCommitSamples(previousInputs, previousRange);
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

export function computeLeadTimeMinTimeSeries(
  inputs: Inputs,
  range: DateRange,
  bucket: 'day' | 'week',
): Array<{ bucketStart: string; value: number }> {
  const { samples } = computeCommitSamples(inputs, range);
  return buildTimeSeries(
    samples.map((s) => ({ date: s.date, value: s.timeMin })),
    range,
    bucket,
    'sum',
  );
}

export function computeLeadTimeUnmappedTimeSeries(
  inputs: Inputs,
  range: DateRange,
  bucket: 'day' | 'week',
): Array<{ bucketStart: string; value: number }> {
  const { unmappedDates } = computeCommitSamples(inputs, range);
  return buildTimeSeries(
    unmappedDates.map((d) => ({ date: d, value: 1 })),
    range,
    bucket,
    'sum',
  );
}

export function computeLeadTimeMinByPrefixTimeSeries(
  inputs: Inputs,
  range: DateRange,
  bucket: 'day' | 'week',
): { prefixes: string[]; series: Array<{ bucketStart: string; byPrefix: Record<string, number> }> } {
  const { samples } = computeCommitSamples(inputs, range);
  const prefixSet = new Set<string>();
  for (const s of samples) prefixSet.add(s.prefix);
  const prefixes = [...prefixSet].sort();

  const seriesByPrefix = new Map<string, Array<{ bucketStart: string; value: number }>>();
  for (const p of prefixes) {
    const seriesForPrefix = buildTimeSeries(
      samples.filter((s) => s.prefix === p).map((s) => ({ date: s.date, value: s.timeMin })),
      range,
      bucket,
      'sum',
    );
    seriesByPrefix.set(p, seriesForPrefix);
  }

  const bucketStarts = (seriesByPrefix.get(prefixes[0]) ?? []).map((b) => b.bucketStart);
  const series = bucketStarts.map((bucketStart, i) => {
    const byPrefix: Record<string, number> = {};
    for (const p of prefixes) {
      byPrefix[p] = seriesByPrefix.get(p)?.[i]?.value ?? 0;
    }
    return { bucketStart, byPrefix };
  });

  return { prefixes, series };
}
