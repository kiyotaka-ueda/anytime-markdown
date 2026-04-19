import { classifyDoraLevel, DEFAULT_THRESHOLDS } from './thresholds';
import type { ThresholdsConfig } from './thresholds';
import type { DateRange, MetricValue } from './types';
import { buildTimeSeries, median } from './timeSeriesUtils';

type Inputs = {
  messages: Array<{ uuid: string; created_at: string }>;
  messageCommits: Array<{ message_uuid: string; detected_at: string; match_confidence: string }>;
};

const VALID_CONFIDENCES = new Set(['realtime', 'high', 'medium']);

function computeSamples(
  inputs: Inputs,
  range: DateRange,
): Array<{ date: string; hours: number }> {
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

  const samples: Array<{ date: string; hours: number }> = [];
  for (const mc of inputs.messageCommits) {
    if (!VALID_CONFIDENCES.has(mc.match_confidence)) continue;
    const msgAt = msgMap.get(mc.message_uuid);
    if (!msgAt) continue;
    const diffMs = new Date(mc.detected_at).getTime() - new Date(msgAt).getTime();
    const hours = Math.max(0, diffMs / 3_600_000);
    samples.push({ date: mc.detected_at, hours });
  }
  return samples;
}

export function computeLeadTimeForChanges(
  inputs: Inputs,
  range: DateRange,
  previousRange: DateRange,
  bucket: 'day' | 'week',
  previousInputs?: Inputs,
  thresholds: ThresholdsConfig = DEFAULT_THRESHOLDS,
): MetricValue {
  const samples = computeSamples(inputs, range);
  const value = median(samples.map((s) => s.hours));

  const level = samples.length > 0
    ? classifyDoraLevel('leadTimeForChanges', value, thresholds)
    : classifyDoraLevel('leadTimeForChanges', value, thresholds);

  const timeSeries = buildTimeSeries(
    samples.map((s) => ({ date: s.date, value: s.hours })),
    range,
    bucket,
    'median',
  );

  let comparison: MetricValue['comparison'] | undefined;
  if (previousInputs !== undefined) {
    const prevSamples = computeSamples(previousInputs, previousRange);
    const previousValue = median(prevSamples.map((s) => s.hours));
    const deltaPct =
      prevSamples.length === 0 ? null : ((value - previousValue) / previousValue) * 100;
    comparison = { previousValue, deltaPct };
  }

  return {
    id: 'leadTimeForChanges',
    value,
    unit: 'hours',
    sampleSize: samples.length,
    level,
    comparison,
    timeSeries,
  };
}
