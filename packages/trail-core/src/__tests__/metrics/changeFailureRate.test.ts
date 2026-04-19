import { computeChangeFailureRate } from '../../domain/metrics/changeFailureRate';
import type { DateRange } from '../../domain/metrics/types';

const range: DateRange = { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' };
const prevRange: DateRange = { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' };

function makeRelease(id: string, tag_date: string, commit_hashes: string[]) {
  return { id, tag_date, commit_hashes };
}

describe('computeChangeFailureRate', () => {
  it('0 releases → value=0, sampleSize=0', () => {
    const result = computeChangeFailureRate({ releases: [], commits: [] }, range, prevRange, 'week');
    expect(result.value).toBe(0);
    expect(result.sampleSize).toBe(0);
    expect(result.unit).toBe('percent');
  });

  it('no fix commits → 0% failure rate', () => {
    const releases = [makeRelease('r1', '2026-04-10T00:00:00.000Z', ['abc123'])];
    const commits = [{ hash: 'abc123', subject: 'feat: add new feature' }];
    const result = computeChangeFailureRate({ releases, commits }, range, prevRange, 'day');
    expect(result.value).toBe(0);
    expect(result.sampleSize).toBe(1);
    expect(result.level).toBe('elite');
  });

  it('release with fix commit → counted as failure', () => {
    const releases = [makeRelease('r1', '2026-04-10T00:00:00.000Z', ['abc123'])];
    const commits = [{ hash: 'abc123', subject: 'fix: resolve bug' }];
    const result = computeChangeFailureRate({ releases, commits }, range, prevRange, 'day');
    expect(result.value).toBeCloseTo(100, 1);
    expect(result.sampleSize).toBe(1);
  });

  it('release with revert commit → counted as failure', () => {
    const releases = [makeRelease('r1', '2026-04-10T00:00:00.000Z', ['abc123'])];
    const commits = [{ hash: 'abc123', subject: 'revert: undo previous change' }];
    const result = computeChangeFailureRate({ releases, commits }, range, prevRange, 'day');
    expect(result.value).toBeCloseTo(100, 1);
  });

  it('release with hotfix commit → counted as failure', () => {
    const releases = [makeRelease('r1', '2026-04-10T00:00:00.000Z', ['abc123'])];
    const commits = [{ hash: 'abc123', subject: 'hotfix: emergency fix' }];
    const result = computeChangeFailureRate({ releases, commits }, range, prevRange, 'day');
    expect(result.value).toBeCloseTo(100, 1);
  });

  it('1 release with multiple fix commits → counted as 1 failure', () => {
    const releases = [makeRelease('r1', '2026-04-10T00:00:00.000Z', ['abc1', 'abc2', 'abc3'])];
    const commits = [
      { hash: 'abc1', subject: 'fix: bug 1' },
      { hash: 'abc2', subject: 'fix: bug 2' },
      { hash: 'abc3', subject: 'feat: something else' },
    ];
    const result = computeChangeFailureRate({ releases, commits }, range, prevRange, 'day');
    expect(result.value).toBeCloseTo(100, 1); // 1/1 = 100%
    expect(result.sampleSize).toBe(1);
  });

  it('2 releases, 1 with fix → 50%', () => {
    const releases = [
      makeRelease('r1', '2026-04-10T00:00:00.000Z', ['abc1']),
      makeRelease('r2', '2026-04-20T00:00:00.000Z', ['abc2']),
    ];
    const commits = [
      { hash: 'abc1', subject: 'fix: bug' },
      { hash: 'abc2', subject: 'feat: feature' },
    ];
    const result = computeChangeFailureRate({ releases, commits }, range, prevRange, 'day');
    expect(result.value).toBeCloseTo(50, 1);
    expect(result.sampleSize).toBe(2);
  });

  it('excludes releases outside range', () => {
    const releases = [
      makeRelease('r1', '2026-03-01T00:00:00.000Z', ['abc1']), // outside
      makeRelease('r2', '2026-04-10T00:00:00.000Z', ['abc2']), // inside
    ];
    const commits = [
      { hash: 'abc1', subject: 'fix: outside' },
      { hash: 'abc2', subject: 'feat: inside' },
    ];
    const result = computeChangeFailureRate({ releases, commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1);
    expect(result.value).toBe(0);
  });

  it('deltaPct calculated from previous period', () => {
    const currentReleases = [makeRelease('r1', '2026-04-10T00:00:00.000Z', ['abc1'])];
    const currentCommits = [{ hash: 'abc1', subject: 'feat: ok' }]; // 0%
    const prevReleases = [
      makeRelease('pr1', '2026-03-10T00:00:00.000Z', ['pabc1']),
      makeRelease('pr2', '2026-03-20T00:00:00.000Z', ['pabc2']),
    ];
    const prevCommits = [
      { hash: 'pabc1', subject: 'fix: bug' },
      { hash: 'pabc2', subject: 'feat: ok' },
    ]; // 50%

    const result = computeChangeFailureRate(
      { releases: currentReleases, commits: currentCommits },
      range,
      prevRange,
      'day',
      { releases: prevReleases, commits: prevCommits },
    );
    expect(result.comparison).toBeDefined();
    expect(result.comparison!.previousValue).toBeCloseTo(50, 1);
    expect(result.comparison!.deltaPct).toBeCloseTo(-100, 1);
  });

  it('deltaPct=null when previous has 0 releases', () => {
    const currentReleases = [makeRelease('r1', '2026-04-10T00:00:00.000Z', ['abc1'])];
    const currentCommits = [{ hash: 'abc1', subject: 'feat: ok' }];
    const result = computeChangeFailureRate(
      { releases: currentReleases, commits: currentCommits },
      range,
      prevRange,
      'day',
      { releases: [], commits: [] },
    );
    expect(result.comparison!.deltaPct).toBeNull();
  });
});
