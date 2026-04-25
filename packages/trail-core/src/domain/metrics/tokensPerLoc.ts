import { classifyDoraLevel, DEFAULT_THRESHOLDS } from './thresholds';
import type { ThresholdsConfig } from './thresholds';
import type { DateRange, MetricValue } from './types';
import { buildRatioTimeSeries } from './timeSeriesUtils';

type Inputs = {
  messages: Array<{
    uuid: string;
    created_at: string;
    session_id?: string;
    type?: string;
    role?: string;
    input_tokens?: number;
    output_tokens?: number;
    cache_read_tokens?: number;
    cache_creation_tokens?: number;
    cost_usd?: number;
  }>;
  commits: Array<{ hash: string; committed_at: string; session_id?: string; lines_added?: number; lines_deleted?: number }>;
};

interface CommitSample {
  date: string;
  tokens: number;
  cost: number;
  churn: number;
}

function isUserMessage(m: Inputs['messages'][number]): boolean {
  return m.role === 'user' || m.type === 'user';
}

function totalTokens(m: Inputs['messages'][number]): number {
  return (m.input_tokens ?? 0) + (m.output_tokens ?? 0) + (m.cache_read_tokens ?? 0) + (m.cache_creation_tokens ?? 0);
}

function computeCommitSamples(inputs: Inputs, range: DateRange): CommitSample[] {
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();

  type UserEntry = { ts: string; tokens: number; cost: number };
  const userMsgsBySession = new Map<string, UserEntry[]>();
  for (const m of inputs.messages) {
    if (!m.session_id) continue;
    if (!isUserMessage(m)) continue;
    const arr = userMsgsBySession.get(m.session_id);
    const entry: UserEntry = { ts: m.created_at, tokens: totalTokens(m), cost: m.cost_usd ?? 0 };
    if (arr) arr.push(entry);
    else userMsgsBySession.set(m.session_id, [entry]);
  }
  for (const arr of userMsgsBySession.values()) {
    arr.sort((a, b) => a.ts.localeCompare(b.ts));
  }

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

  const bestByCommit = new Map<string, CommitSample>();

  for (const [sessionId, commits] of commitsBySession) {
    const userMsgs = userMsgsBySession.get(sessionId) ?? [];
    let prevCommitTs: string | null = null;
    let userIdx = 0;

    for (const c of commits) {
      if (c.churn <= 0) {
        prevCommitTs = c.committedAt;
        continue;
      }
      const commitMs = new Date(c.committedAt).getTime();
      if (commitMs < fromMs || commitMs > toMs) {
        prevCommitTs = c.committedAt;
        continue;
      }

      // Sum tokens and cost of user messages in (prevCommitTs, c.committedAt].
      let tokens = 0;
      let cost = 0;
      let attributed = 0;
      for (; userIdx < userMsgs.length; userIdx++) {
        const u = userMsgs[userIdx];
        if (prevCommitTs !== null && u.ts <= prevCommitTs) continue;
        if (u.ts > c.committedAt) break;
        tokens += u.tokens;
        cost += u.cost;
        attributed += 1;
      }

      if (attributed > 0) {
        const sample: CommitSample = { date: c.committedAt, tokens, cost, churn: c.churn };
        const existing = bestByCommit.get(c.hash);
        // Keep the smallest tokens-per-LOC ratio (most accurate attribution).
        if (!existing || sample.tokens / sample.churn < existing.tokens / existing.churn) {
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
  const sumTokens = samples.reduce((a, s) => a + s.tokens, 0);
  const sumChurn = samples.reduce((a, s) => a + s.churn, 0);
  return sumChurn > 0 ? sumTokens / sumChurn : 0;
}

export function computeTokensPerLoc(
  inputs: Inputs,
  range: DateRange,
  previousRange: DateRange,
  bucket: 'day' | 'week',
  previousInputs?: Inputs,
  thresholds: ThresholdsConfig = DEFAULT_THRESHOLDS,
): MetricValue {
  const samples = computeCommitSamples(inputs, range);
  const value = aggregate(samples);

  const level = classifyDoraLevel('tokensPerLoc', value, thresholds);

  const timeSeries = buildRatioTimeSeries(
    samples.map((s) => ({ date: s.date, numerator: s.tokens, denominator: s.churn })),
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
    id: 'tokensPerLoc',
    value,
    unit: 'tokensPerLoc',
    sampleSize: samples.length,
    level,
    comparison,
    timeSeries,
  };
}

export function computeTokensAndCostPerLocTimeSeries(
  inputs: Inputs,
  range: DateRange,
  bucket: 'day' | 'week',
): {
  tokens: Array<{ bucketStart: string; value: number }>;
  cost: Array<{ bucketStart: string; value: number }>;
} {
  const samples = computeCommitSamples(inputs, range);
  const tokens = buildRatioTimeSeries(
    samples.map((s) => ({ date: s.date, numerator: s.tokens, denominator: s.churn })),
    range,
    bucket,
  );
  const cost = buildRatioTimeSeries(
    samples.map((s) => ({ date: s.date, numerator: s.cost, denominator: s.churn })),
    range,
    bucket,
  );
  return { tokens, cost };
}
