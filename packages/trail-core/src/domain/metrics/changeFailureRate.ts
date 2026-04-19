import { classifyDoraLevel, DEFAULT_THRESHOLDS } from './thresholds';
import type { ThresholdsConfig } from './thresholds';
import type { DateRange, MetricValue } from './types';
import { buildTimeSeries } from './timeSeriesUtils';

// fix_count: pre-computed from DB (optional shortcut; if provided and commit_hashes is empty, used directly)
type Release = { id: string; tag_date: string; commit_hashes: string[]; fix_count?: number };
type Commit = { hash: string; subject: string };

type Inputs = {
  releases: Release[];
  commits: Commit[];
};

// Detects fix/revert/hotfix by conventional commits prefix or keywords.
// classifyCommitType only handles feat/fix/refactor/test (returns 'other' for revert/hotfix),
// so we check directly here.
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
  failures: Array<{ date: string }>;
} {
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();

  const inRange = inputs.releases.filter((r) => {
    const t = new Date(r.tag_date).getTime();
    return t >= fromMs && t <= toMs;
  });

  const commitMap = new Map(inputs.commits.map((c) => [c.hash, c.subject]));

  const failures: Array<{ date: string }> = [];
  for (const release of inRange) {
    const hasFailure =
      release.fix_count !== undefined && release.commit_hashes.length === 0
        ? release.fix_count > 0
        : release.commit_hashes.some((hash) => {
            const subject = commitMap.get(hash);
            return subject !== undefined && isFailureCommit(subject);
          });
    if (hasFailure) {
      failures.push({ date: release.tag_date });
    }
  }

  const value = inRange.length === 0 ? 0 : (failures.length / inRange.length) * 100;
  return { value, sampleSize: inRange.length, failures };
}

export function computeChangeFailureRate(
  inputs: Inputs,
  range: DateRange,
  previousRange: DateRange,
  bucket: 'day' | 'week',
  previousInputs?: Inputs,
  thresholds: ThresholdsConfig = DEFAULT_THRESHOLDS,
): MetricValue {
  const { value, sampleSize, failures } = computeRate(inputs, range);
  const level = classifyDoraLevel('changeFailureRate', value, thresholds);

  const timeSeries = buildTimeSeries(
    failures.map((f) => ({ date: f.date, value: 1 })),
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
    id: 'changeFailureRate',
    value,
    unit: 'percent',
    sampleSize,
    level,
    comparison,
    timeSeries,
  };
}
