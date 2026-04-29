import { computeConfidenceCoupling } from '../../temporalCoupling/computeConfidenceCoupling';
import type {
  CommitFileRow,
  ComputeConfidenceCouplingOptions,
} from '../../temporalCoupling/types';

const baseOptions: ComputeConfidenceCouplingOptions = {
  minChangeCount: 1,
  confidenceThreshold: 0,
  directionalDiffThreshold: 0.3,
  topK: 100,
  maxFilesPerCommit: 50,
};

describe('computeConfidenceCoupling', () => {
  it('returns empty array for empty input', () => {
    expect(computeConfidenceCoupling([], baseOptions)).toEqual([]);
  });

  it('marks pair as undirected when both confidences are equal', () => {
    // a, b are both in c1 and c2 only → C(a→b)=C(b→a)=1.0
    const rows: CommitFileRow[] = [
      { commitHash: 'c1', filePath: 'a.ts' },
      { commitHash: 'c1', filePath: 'b.ts' },
      { commitHash: 'c2', filePath: 'a.ts' },
      { commitHash: 'c2', filePath: 'b.ts' },
    ];
    const result = computeConfidenceCoupling(rows, baseOptions);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source: 'a.ts',
      target: 'b.ts',
      direction: 'undirected',
      confidenceForward: 1.0,
      confidenceBackward: 1.0,
      coChangeCount: 2,
      sourceChangeCount: 2,
      targetChangeCount: 2,
      jaccard: 1.0,
    });
  });

  it('points arrow from driver to dependent on strong asymmetry', () => {
    // auth.ts in c1..c4 (4 commits), login.ts in c1 only (1 commit)
    // co=1
    // C(auth→login) = 1/4 = 0.25
    // C(login→auth) = 1/1 = 1.0
    // diff = 0.75 >= 0.3 → directed, primary = login→auth
    const rows: CommitFileRow[] = [
      { commitHash: 'c1', filePath: 'auth.ts' },
      { commitHash: 'c1', filePath: 'login.ts' },
      { commitHash: 'c2', filePath: 'auth.ts' },
      { commitHash: 'c3', filePath: 'auth.ts' },
      { commitHash: 'c4', filePath: 'auth.ts' },
    ];
    const result = computeConfidenceCoupling(rows, baseOptions);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('A→B');
    expect(result[0].source).toBe('login.ts');
    expect(result[0].target).toBe('auth.ts');
    expect(result[0].confidenceForward).toBeCloseTo(1.0, 5);
    expect(result[0].confidenceBackward).toBeCloseTo(0.25, 5);
    expect(result[0].sourceChangeCount).toBe(1);
    expect(result[0].targetChangeCount).toBe(4);
    expect(result[0].coChangeCount).toBe(1);
  });

  it('keeps pair undirected when diff is below directionalDiffThreshold', () => {
    // a in c1..c5 (5 commits), b in c1..c4 (4 commits), co=4
    // C(a→b) = 4/5 = 0.8
    // C(b→a) = 4/4 = 1.0
    // diff = 0.2 < 0.3 → undirected
    const rows: CommitFileRow[] = [
      { commitHash: 'c1', filePath: 'a.ts' },
      { commitHash: 'c1', filePath: 'b.ts' },
      { commitHash: 'c2', filePath: 'a.ts' },
      { commitHash: 'c2', filePath: 'b.ts' },
      { commitHash: 'c3', filePath: 'a.ts' },
      { commitHash: 'c3', filePath: 'b.ts' },
      { commitHash: 'c4', filePath: 'a.ts' },
      { commitHash: 'c4', filePath: 'b.ts' },
      { commitHash: 'c5', filePath: 'a.ts' },
    ];
    const result = computeConfidenceCoupling(rows, baseOptions);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('undirected');
    // For undirected, source<target lexicographically
    expect(result[0].source).toBe('a.ts');
    expect(result[0].target).toBe('b.ts');
  });

  it('drops pairs whose primary confidence is below confidenceThreshold', () => {
    // a in c1..c4 (4), b in c1..c3, c5..c10 (9), co=3
    // C(a→b) = 3/4 = 0.75
    // C(b→a) = 3/9 ≈ 0.333
    // primary = a→b with confidence 0.75
    const rows: CommitFileRow[] = [
      { commitHash: 'c1', filePath: 'a.ts' },
      { commitHash: 'c1', filePath: 'b.ts' },
      { commitHash: 'c2', filePath: 'a.ts' },
      { commitHash: 'c2', filePath: 'b.ts' },
      { commitHash: 'c3', filePath: 'a.ts' },
      { commitHash: 'c3', filePath: 'b.ts' },
      { commitHash: 'c4', filePath: 'a.ts' },
      { commitHash: 'c5', filePath: 'b.ts' },
      { commitHash: 'c6', filePath: 'b.ts' },
      { commitHash: 'c7', filePath: 'b.ts' },
      { commitHash: 'c8', filePath: 'b.ts' },
      { commitHash: 'c9', filePath: 'b.ts' },
      { commitHash: 'c10', filePath: 'b.ts' },
    ];
    // confidenceThreshold higher than primary 0.75 → drop
    const dropped = computeConfidenceCoupling(rows, {
      ...baseOptions,
      confidenceThreshold: 0.8,
    });
    expect(dropped).toHaveLength(0);

    // confidenceThreshold below primary 0.75 → keep
    const kept = computeConfidenceCoupling(rows, {
      ...baseOptions,
      confidenceThreshold: 0.5,
    });
    expect(kept).toHaveLength(1);
    expect(kept[0].direction).toBe('A→B');
    expect(kept[0].source).toBe('a.ts');
    expect(kept[0].target).toBe('b.ts');
  });

  it('respects excludePairs (undirected match)', () => {
    const rows: CommitFileRow[] = [
      { commitHash: 'c1', filePath: 'a.ts' },
      { commitHash: 'c1', filePath: 'b.ts' },
    ];
    const result = computeConfidenceCoupling(rows, {
      ...baseOptions,
      excludePairs: [['b.ts', 'a.ts']],
    });
    expect(result).toHaveLength(0);
  });

  it('limits results to topK ranked by primary confidence', () => {
    const rows: CommitFileRow[] = [
      // a-b: C(a→b) = 1.0 (a in c1,c2; b in c1..c5; co=2)
      // Actually let's keep symmetry simple: pair1 strong, pair2 medium, pair3 weak
      // pair1: x-y both in c1, c2 → primary 1.0, undirected
      { commitHash: 'c1', filePath: 'x.ts' },
      { commitHash: 'c1', filePath: 'y.ts' },
      { commitHash: 'c2', filePath: 'x.ts' },
      { commitHash: 'c2', filePath: 'y.ts' },
      // pair2: p in c3..c5 (3), q in c3..c4 (2), co=2 → C(q→p)=1.0, C(p→q)=2/3
      { commitHash: 'c3', filePath: 'p.ts' },
      { commitHash: 'c3', filePath: 'q.ts' },
      { commitHash: 'c4', filePath: 'p.ts' },
      { commitHash: 'c4', filePath: 'q.ts' },
      { commitHash: 'c5', filePath: 'p.ts' },
      // pair3: m in c6..c8 (3), n in c6..c7 (2), co=2 → similar to pair2
      // To get a 3rd distinct pair with lower primary confidence:
      // m-n: m in c6 (1), n in c6..c10 (5), co=1 → C(m→n)=1.0, but only m=1 commit, weak
      { commitHash: 'c6', filePath: 'm.ts' },
      { commitHash: 'c6', filePath: 'n.ts' },
      { commitHash: 'c7', filePath: 'n.ts' },
      { commitHash: 'c8', filePath: 'n.ts' },
      { commitHash: 'c9', filePath: 'n.ts' },
      { commitHash: 'c10', filePath: 'n.ts' },
    ];
    const result = computeConfidenceCoupling(rows, {
      ...baseOptions,
      topK: 2,
    });
    expect(result).toHaveLength(2);
    // Sorted by primary confidence descending
    const primaryConfidences = result.map((e) => e.confidenceForward);
    expect(primaryConfidences[0]).toBeGreaterThanOrEqual(primaryConfidences[1]);
  });

  it('excludes files below minChangeCount', () => {
    const rows: CommitFileRow[] = [
      { commitHash: 'c1', filePath: 'a.ts' },
      { commitHash: 'c1', filePath: 'b.ts' },
      { commitHash: 'c2', filePath: 'a.ts' },
      { commitHash: 'c2', filePath: 'b.ts' },
      { commitHash: 'c3', filePath: 'a.ts' },
      { commitHash: 'c3', filePath: 'b.ts' },
      { commitHash: 'c1', filePath: 'rare.ts' },
    ];
    const result = computeConfidenceCoupling(rows, {
      ...baseOptions,
      minChangeCount: 2,
    });
    const filesInResult = new Set(
      result.flatMap((e) => [e.source, e.target]),
    );
    expect(filesInResult.has('rare.ts')).toBe(false);
  });

  it('skips commits exceeding maxFilesPerCommit', () => {
    const bigCommit: CommitFileRow[] = Array.from({ length: 60 }, (_, i) => ({
      commitHash: 'big',
      filePath: `big-${i}.ts`,
    }));
    const normalCommit: CommitFileRow[] = [
      { commitHash: 'n1', filePath: 'a.ts' },
      { commitHash: 'n1', filePath: 'b.ts' },
    ];
    const result = computeConfidenceCoupling(
      [...bigCommit, ...normalCommit],
      {
        ...baseOptions,
        maxFilesPerCommit: 50,
      },
    );
    expect(result).toHaveLength(1);
    const files = new Set([result[0].source, result[0].target]);
    expect(files).toEqual(new Set(['a.ts', 'b.ts']));
  });

  it('includes Jaccard alongside confidence (Phase 1 compatibility)', () => {
    // a in c1..c3, b in c2..c4, co=2 (c2, c3), union=4 → J=0.5
    const rows: CommitFileRow[] = [
      { commitHash: 'c1', filePath: 'a.ts' },
      { commitHash: 'c2', filePath: 'a.ts' },
      { commitHash: 'c2', filePath: 'b.ts' },
      { commitHash: 'c3', filePath: 'a.ts' },
      { commitHash: 'c3', filePath: 'b.ts' },
      { commitHash: 'c4', filePath: 'b.ts' },
    ];
    const result = computeConfidenceCoupling(rows, baseOptions);
    expect(result).toHaveLength(1);
    expect(result[0].jaccard).toBeCloseTo(0.5, 5);
  });
});
