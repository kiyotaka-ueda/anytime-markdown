import { classifyDoraLevel, DEFAULT_THRESHOLDS } from './thresholds';
import type { ThresholdsConfig } from './thresholds';
import type { DateRange, MetricValue } from './types';
import { buildRatioTimeSeries, VALID_MESSAGE_COMMIT_CONFIDENCES } from './timeSeriesUtils';

type Inputs = {
  messages: Array<{ uuid: string; created_at: string }>;
  messageCommits: Array<{ message_uuid: string; commit_hash: string; match_confidence: string }>;
  commits: Array<{ hash: string; committed_at: string; lines_added?: number; lines_deleted?: number }>;
};

interface CommitSample {
  date: string;
  timeMin: number;
  churn: number;
}

function computeCommitSamples(inputs: Inputs, range: DateRange): CommitSample[] {
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();

  const msgMap = new Map(
    inputs.messages
      .filter((m) => {
        const t = new Date(m.created_at).getTime();
        return t >= fromMs && t <= toMs;
      })
      .map((m) => [m.uuid, m.created_at]),
  );

  type CommitMeta = { committedAt: string; churn: number };
  const commitMap = new Map<string, CommitMeta>(
    inputs.commits.map((c) => [c.hash, {
      committedAt: c.committed_at,
      churn: (c.lines_added ?? 0) + (c.lines_deleted ?? 0),
    }]),
  );

  const earliestMsgByCommit = new Map<string, string>();

  for (const mc of inputs.messageCommits) {
    if (!VALID_MESSAGE_COMMIT_CONFIDENCES.has(mc.match_confidence)) continue;
    const msgAt = msgMap.get(mc.message_uuid);
    if (!msgAt) continue;

    const existing = earliestMsgByCommit.get(mc.commit_hash);
    if (!existing || msgAt < existing) {
      earliestMsgByCommit.set(mc.commit_hash, msgAt);
    }
  }

  const samples: CommitSample[] = [];
  for (const [hash, earliestMsgAt] of earliestMsgByCommit) {
    const meta = commitMap.get(hash);
    if (!meta || meta.churn <= 0) continue;
    const diffMs = new Date(meta.committedAt).getTime() - new Date(earliestMsgAt).getTime();
    const timeMin = Math.max(0, diffMs / 60_000);
    samples.push({ date: meta.committedAt, timeMin, churn: meta.churn });
  }
  return samples;
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
