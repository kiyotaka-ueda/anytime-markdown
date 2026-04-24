import { computeAiFirstTrySuccessRate } from '../../domain/metrics/aiFirstTrySuccessRate';
import type { DateRange } from '../../domain/metrics/types';

const range: DateRange = { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' };
const prevRange: DateRange = { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' };

function aiCommit(hash: string, at: string, subject: string) {
  return { hash, subject, committed_at: at, is_ai_assisted: true };
}

function humanCommit(hash: string, at: string, subject: string) {
  return { hash, subject, committed_at: at, is_ai_assisted: false };
}

describe('computeAiFirstTrySuccessRate', () => {
  it('no AI commits → value=0, sampleSize=0, no level', () => {
    const result = computeAiFirstTrySuccessRate({ commits: [] }, range, prevRange, 'day');
    expect(result.value).toBe(0);
    expect(result.sampleSize).toBe(0);
    expect(result.level).toBeUndefined();
    expect(result.unit).toBe('percent');
  });

  it('all AI commits without any follow-up fix → 100%', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: add A'),
      aiCommit('a2', '2026-04-02T09:00:00.000Z', 'feat: add B'),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.value).toBe(100);
    expect(result.sampleSize).toBe(2);
    expect(result.level).toBe('elite');
  });

  it('AI commit followed by fix within 168h → counted as failed (50%)', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: add A'),
      aiCommit('f1', '2026-04-05T09:00:00.000Z', 'fix: A was broken'),
      aiCommit('a2', '2026-04-10T09:00:00.000Z', 'feat: add B'),
    ];
    // Denominator: a1, a2 (f1 is a fix, excluded). a1 has fix within 168h → failed. a2 has no fix → success.
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(2);
    expect(result.value).toBe(50);
  });

  it('fix outside 168h window does not count as failure', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: add A'),
      aiCommit('f1', '2026-04-15T09:00:00.000Z', 'fix: unrelated, 14 days later'), // > 168h
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1); // only a1 in denominator
    expect(result.value).toBe(100); // no fix within 168h
  });

  it('revert and hotfix subjects also count as failure markers', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A'),
      aiCommit('r1', '2026-04-02T09:00:00.000Z', 'revert: A'),
      aiCommit('a2', '2026-04-10T09:00:00.000Z', 'feat: B'),
      aiCommit('h1', '2026-04-12T09:00:00.000Z', 'hotfix(scope): urgent'),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(2); // a1, a2
    expect(result.value).toBe(0); // both followed by failure markers within 168h
  });

  it('human commits (is_ai_assisted=false) are excluded from denominator', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A'),
      humanCommit('h1', '2026-04-02T09:00:00.000Z', 'feat: human change'),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1);
    expect(result.value).toBe(100);
  });

  it('human fix still counts as failure marker for AI commit', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A'),
      humanCommit('h1', '2026-04-03T09:00:00.000Z', 'fix: human had to patch'),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1); // denom excludes h1 (not AI); a1 is AI
    expect(result.value).toBe(0); // h1 fix within 168h
  });

  it('commits outside range are excluded from denominator but still used for fix detection', () => {
    const commits = [
      aiCommit('a0', '2026-03-31T09:00:00.000Z', 'feat: before'),  // outside range
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A'),       // inside range
      aiCommit('f1', '2026-04-04T09:00:00.000Z', 'fix: something'),// inside range, fix
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1); // only a1 (a0 is outside range; f1 is fix)
    expect(result.value).toBe(0); // a1 has fix within 168h
  });

  it('fix commit itself is not in denominator', () => {
    const commits = [
      aiCommit('f1', '2026-04-01T09:00:00.000Z', 'fix: something'),
      aiCommit('f2', '2026-04-02T09:00:00.000Z', 'revert: change'),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(0); // all fix/revert excluded
    expect(result.value).toBe(0);
  });

  it('deltaPct calculated from previous period', () => {
    const commits = [aiCommit('a1', '2026-04-10T00:00:00.000Z', 'feat: A')]; // 100%
    const prevCommits = [
      aiCommit('pa1', '2026-03-01T00:00:00.000Z', 'feat: A'),  // no fix within 168h → success
      aiCommit('pa2', '2026-03-10T00:00:00.000Z', 'feat: B'),  // pf1 within 168h → failed
      aiCommit('pf1', '2026-03-12T00:00:00.000Z', 'fix: B'),
    ]; // 1 success / 2 denominator = 50%
    const result = computeAiFirstTrySuccessRate(
      { commits },
      range,
      prevRange,
      'day',
      { commits: prevCommits },
    );
    expect(result.comparison).toBeDefined();
    expect(result.comparison!.previousValue).toBeCloseTo(50, 1);
    expect(result.comparison!.deltaPct).toBeCloseTo(100, 1); // 100% vs 50%
  });

  it('deltaPct=null when previous has 0 AI commits', () => {
    const commits = [aiCommit('a1', '2026-04-10T00:00:00.000Z', 'feat: A')];
    const result = computeAiFirstTrySuccessRate(
      { commits },
      range,
      prevRange,
      'day',
      { commits: [] },
    );
    expect(result.comparison!.deltaPct).toBeNull();
  });

  it('DORA level classification', () => {
    // 95% → elite (>= 90%)
    // 80% → high (>= 75%)
    // 65% → medium (>= 60%)
    // 40% → low
    // Use 10 commits with N fixes:
    function makeScenario(aiTotal: number, fixCount: number) {
      const commits = [];
      for (let i = 0; i < aiTotal; i++) {
        commits.push(aiCommit(`a${i}`, `2026-04-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`, `feat: ${i}`));
      }
      for (let i = 0; i < fixCount; i++) {
        // Place fix shortly after commit i (within 168h)
        commits.push(aiCommit(`f${i}`, `2026-04-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`, `fix: ${i}`));
      }
      return commits;
    }

    expect(computeAiFirstTrySuccessRate({ commits: makeScenario(20, 1) }, range, prevRange, 'day').level).toBe('elite');   // 95%
    expect(computeAiFirstTrySuccessRate({ commits: makeScenario(20, 4) }, range, prevRange, 'day').level).toBe('high');    // 80%
    expect(computeAiFirstTrySuccessRate({ commits: makeScenario(20, 7) }, range, prevRange, 'day').level).toBe('medium');  // 65%
    expect(computeAiFirstTrySuccessRate({ commits: makeScenario(20, 12) }, range, prevRange, 'day').level).toBe('low');    // 40%
  });

  it('timeSeries groups successes by commit date', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A'),         // followed by f1 → fail
      aiCommit('f1', '2026-04-02T09:00:00.000Z', 'fix: A'),           // excluded
      aiCommit('a2', '2026-04-03T09:00:00.000Z', 'feat: B'),         // no fix after → success
      aiCommit('a3', '2026-04-04T09:00:00.000Z', 'feat: C'),         // no fix after → success
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.timeSeries.length).toBeGreaterThan(0);
    const day3 = result.timeSeries.find((p) => p.bucketStart.startsWith('2026-04-03'));
    const day4 = result.timeSeries.find((p) => p.bucketStart.startsWith('2026-04-04'));
    expect(day3?.value).toBe(1);
    expect(day4?.value).toBe(1);
  });
});
