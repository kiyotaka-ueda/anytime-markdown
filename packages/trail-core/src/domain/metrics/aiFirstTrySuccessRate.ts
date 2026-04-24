import { classifyDoraLevel, DEFAULT_THRESHOLDS } from './thresholds';
import type { ThresholdsConfig } from './thresholds';
import type { DateRange, MetricValue } from './types';
import { buildTimeSeries } from './timeSeriesUtils';

const FIX_WINDOW_MS = 168 * 60 * 60 * 1000; // 7 days

type Commit = {
  hash: string;
  subject: string;
  committed_at: string;
  is_ai_assisted: boolean;
};

type Inputs = {
  commits: Commit[];
};

// Detects fix/revert/hotfix by conventional commits prefix (same logic as changeFailureRate).
function isFailureCommit(subject: string): boolean {
  const lower = subject.toLowerCase();
  if (/^fix(\([^)]*\))?[!]?:\s/.test(lower)) return true;
  if (/^revert(\([^)]*\))?[!]?:\s/.test(lower)) return true;
  if (/^hotfix(\([^)]*\))?[!]?:\s/.test(lower)) return true;
  return false;
}

function computeRate(inputs: Inputs, range: DateRange): {
  value: number;
  sampleSize: number;
  successes: Array<{ date: string }>;
} {
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();

  const aiCommitsInRange = inputs.commits.filter((c) => {
    if (!c.is_ai_assisted) return false;
    if (isFailureCommit(c.subject)) return false;
    const t = new Date(c.committed_at).getTime();
    return t >= fromMs && t <= toMs;
  });

  const allFixes = inputs.commits
    .filter((c) => isFailureCommit(c.subject))
    .map((c) => new Date(c.committed_at).getTime())
    .filter((t) => !Number.isNaN(t));

  const successes: Array<{ date: string }> = [];
  for (const commit of aiCommitsInRange) {
    const commitMs = new Date(commit.committed_at).getTime();
    if (Number.isNaN(commitMs)) continue;
    const hasFixInWindow = allFixes.some((fixMs) => fixMs > commitMs && fixMs - commitMs <= FIX_WINDOW_MS);
    if (!hasFixInWindow) {
      successes.push({ date: commit.committed_at });
    }
  }

  const value = aiCommitsInRange.length === 0
    ? 0
    : (successes.length / aiCommitsInRange.length) * 100;
  return { value, sampleSize: aiCommitsInRange.length, successes };
}

export function computeAiFirstTrySuccessRate(
  inputs: Inputs,
  range: DateRange,
  previousRange: DateRange,
  bucket: 'day' | 'week',
  previousInputs?: Inputs,
  thresholds: ThresholdsConfig = DEFAULT_THRESHOLDS,
): MetricValue {
  const { value, sampleSize, successes } = computeRate(inputs, range);
  const level = sampleSize > 0
    ? classifyDoraLevel('aiFirstTrySuccessRate', value, thresholds)
    : undefined;

  const timeSeries = buildTimeSeries(
    successes.map((s) => ({ date: s.date, value: 1 })),
    range,
    bucket,
    'sum',
  );

  let comparison: MetricValue['comparison'] | undefined;
  if (previousInputs !== undefined) {
    const prev = computeRate(previousInputs, previousRange);
    const deltaPct = prev.sampleSize === 0 ? null : ((value - prev.value) / prev.value) * 100;
    comparison = { previousValue: prev.value, deltaPct };
  }

  return {
    id: 'aiFirstTrySuccessRate',
    value,
    unit: 'percent',
    sampleSize,
    level,
    comparison,
    timeSeries,
  };
}
