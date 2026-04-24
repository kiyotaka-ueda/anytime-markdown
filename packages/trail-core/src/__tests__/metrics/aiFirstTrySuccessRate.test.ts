import { computeAiFirstTrySuccessRate } from '../../domain/metrics/aiFirstTrySuccessRate';
import type { DateRange } from '../../domain/metrics/types';

const range: DateRange = { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' };
const prevRange: DateRange = { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' };

function aiCommit(hash: string, at: string, subject: string, files: string[] = []) {
  return { hash, subject, committed_at: at, is_ai_assisted: true, files };
}

function humanCommit(hash: string, at: string, subject: string, files: string[] = []) {
  return { hash, subject, committed_at: at, is_ai_assisted: false, files };
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
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: add A', ['src/a.ts']),
      aiCommit('a2', '2026-04-02T09:00:00.000Z', 'feat: add B', ['src/b.ts']),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.value).toBe(100);
    expect(result.sampleSize).toBe(2);
    expect(result.level).toBe('elite');
  });

  it('fix touching same code file within 168h → counted as failed', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: add A', ['src/a.ts']),
      aiCommit('f1', '2026-04-05T09:00:00.000Z', 'fix: A was broken', ['src/a.ts']),
      aiCommit('a2', '2026-04-10T09:00:00.000Z', 'feat: add B', ['src/b.ts']),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(2);
    expect(result.value).toBe(50);
  });

  it('fix touching different file within 168h → NOT counted as failed', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: refactor graph', ['packages/graph-core/src/engine.ts']),
      aiCommit('f1', '2026-04-02T09:00:00.000Z', 'fix: UI header margin', ['packages/web-app/src/Header.tsx']),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1);
    expect(result.value).toBe(100);
  });

  it('fix with multi-file overlap → failed if ANY code file overlaps', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', ['src/a.ts', 'src/b.ts']),
      aiCommit('f1', '2026-04-02T09:00:00.000Z', 'fix: unrelated', ['src/c.ts', 'src/b.ts']),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1);
    expect(result.value).toBe(0);
  });

  it('fix outside 168h window does not count as failure even if files overlap', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', ['src/a.ts']),
      aiCommit('f1', '2026-04-15T09:00:00.000Z', 'fix: unrelated later', ['src/a.ts']),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1);
    expect(result.value).toBe(100);
  });

  describe('F3: non-code file exclusion', () => {
    it('docs-only AI commit (.md) is excluded from denominator', () => {
      const commits = [
        aiCommit('a1', '2026-04-01T09:00:00.000Z', 'docs: update readme', ['README.md']),
      ];
      const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
      expect(result.sampleSize).toBe(0);
      expect(result.value).toBe(0);
    });

    it('image-only AI commit is excluded from denominator', () => {
      const commits = [
        aiCommit('a1', '2026-04-01T09:00:00.000Z', 'chore: replace logo', ['assets/logo.png', 'assets/icon.svg']),
      ];
      const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
      expect(result.sampleSize).toBe(0);
    });

    it('lockfile-only AI commit is excluded from denominator', () => {
      const commits = [
        aiCommit('a1', '2026-04-01T09:00:00.000Z', 'chore: lockfile', ['package-lock.json']),
        aiCommit('a2', '2026-04-02T09:00:00.000Z', 'chore: yarn', ['yarn.lock']),
      ];
      const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
      expect(result.sampleSize).toBe(0);
    });

    it('mixed commit (code + docs) is included and counted via the code file', () => {
      const commits = [
        aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', ['src/a.ts', 'README.md']),
      ];
      const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
      expect(result.sampleSize).toBe(1);
      expect(result.value).toBe(100);
    });

    it('doc-only fix on same .md does NOT mark earlier AI code commit as failed', () => {
      const commits = [
        aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', ['src/a.ts', 'README.md']),
        aiCommit('f1', '2026-04-02T09:00:00.000Z', 'fix(docs): typo', ['README.md']), // no code overlap
      ];
      const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
      expect(result.sampleSize).toBe(1);
      expect(result.value).toBe(100);
    });

    it('code fix that also touches the same .md still fails when code file overlaps', () => {
      const commits = [
        aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', ['src/a.ts', 'README.md']),
        aiCommit('f1', '2026-04-02T09:00:00.000Z', 'fix: a', ['src/a.ts', 'README.md']),
      ];
      const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
      expect(result.sampleSize).toBe(1);
      expect(result.value).toBe(0);
    });

    it('lockfile-only fix does not mark AI commit as failed', () => {
      const commits = [
        aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', ['src/a.ts']),
        aiCommit('f1', '2026-04-02T09:00:00.000Z', 'fix(deps): bump', ['package-lock.json']),
      ];
      const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
      expect(result.sampleSize).toBe(1);
      expect(result.value).toBe(100);
    });
  });

  it('AI commit with empty files → optimistic success', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', []),
      aiCommit('f1', '2026-04-02T09:00:00.000Z', 'fix: something', ['src/a.ts']),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1);
    expect(result.value).toBe(100);
  });

  it('fix with empty files → treated as no overlap (optimistic)', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', ['src/a.ts']),
      aiCommit('f1', '2026-04-02T09:00:00.000Z', 'fix: something', []),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1);
    expect(result.value).toBe(100);
  });

  it('revert and hotfix subjects count as failure markers with file overlap', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', ['src/a.ts']),
      aiCommit('r1', '2026-04-02T09:00:00.000Z', 'revert: A', ['src/a.ts']),
      aiCommit('a2', '2026-04-10T09:00:00.000Z', 'feat: B', ['src/b.ts']),
      aiCommit('h1', '2026-04-12T09:00:00.000Z', 'hotfix(scope): urgent', ['src/b.ts']),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(2);
    expect(result.value).toBe(0);
  });

  it('human commits are excluded from denominator but still used for fix detection', () => {
    const commits = [
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', ['src/a.ts']),
      humanCommit('h1', '2026-04-02T09:00:00.000Z', 'fix: human patch', ['src/a.ts']),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1);
    expect(result.value).toBe(0);
  });

  it('commits outside range are excluded from denominator but still used for fix detection', () => {
    const commits = [
      aiCommit('a0', '2026-03-31T09:00:00.000Z', 'feat: before', ['src/a.ts']),
      aiCommit('a1', '2026-04-01T09:00:00.000Z', 'feat: A', ['src/a.ts']),
      aiCommit('f1', '2026-04-04T09:00:00.000Z', 'fix: something', ['src/a.ts']),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1);
    expect(result.value).toBe(0);
  });

  it('fix commits are not in denominator', () => {
    const commits = [
      aiCommit('f1', '2026-04-01T09:00:00.000Z', 'fix: something', ['src/a.ts']),
      aiCommit('f2', '2026-04-02T09:00:00.000Z', 'revert: change', ['src/b.ts']),
    ];
    const result = computeAiFirstTrySuccessRate({ commits }, range, prevRange, 'day');
    expect(result.sampleSize).toBe(0);
    expect(result.value).toBe(0);
  });

  it('deltaPct calculated from previous period with file overlap', () => {
    const commits = [aiCommit('a1', '2026-04-10T00:00:00.000Z', 'feat: A', ['src/a.ts'])];
    const prevCommits = [
      aiCommit('pa1', '2026-03-01T00:00:00.000Z', 'feat: A', ['src/a.ts']),
      aiCommit('pa2', '2026-03-10T00:00:00.000Z', 'feat: B', ['src/b.ts']),
      aiCommit('pf1', '2026-03-12T00:00:00.000Z', 'fix: B', ['src/b.ts']),
    ];
    const result = computeAiFirstTrySuccessRate(
      { commits },
      range,
      prevRange,
      'day',
      { commits: prevCommits },
    );
    expect(result.comparison!.previousValue).toBeCloseTo(50, 1);
    expect(result.comparison!.deltaPct).toBeCloseTo(100, 1);
  });

  it('DORA level classification', () => {
    function makeScenario(aiTotal: number, fixOverlapCount: number) {
      const commits = [];
      for (let i = 0; i < aiTotal; i++) {
        commits.push(aiCommit(`a${i}`, `2026-04-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`, `feat: ${i}`, [`src/f${i}.ts`]));
      }
      for (let i = 0; i < fixOverlapCount; i++) {
        commits.push(aiCommit(`f${i}`, `2026-04-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`, `fix: ${i}`, [`src/f${i}.ts`]));
      }
      return commits;
    }
    expect(computeAiFirstTrySuccessRate({ commits: makeScenario(20, 1) }, range, prevRange, 'day').level).toBe('elite');
    expect(computeAiFirstTrySuccessRate({ commits: makeScenario(20, 4) }, range, prevRange, 'day').level).toBe('high');
    expect(computeAiFirstTrySuccessRate({ commits: makeScenario(20, 7) }, range, prevRange, 'day').level).toBe('medium');
    expect(computeAiFirstTrySuccessRate({ commits: makeScenario(20, 12) }, range, prevRange, 'day').level).toBe('low');
  });
});
