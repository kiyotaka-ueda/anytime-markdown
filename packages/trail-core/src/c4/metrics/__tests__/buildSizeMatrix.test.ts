import { buildSizeMatrix } from '../buildSizeMatrix';
import type { CoverageMatrix, C4Element } from '../../types';

const cov = (
  elementId: string,
  linesTotal: number,
  functionsTotal: number,
): CoverageMatrix['entries'][number] => ({
  elementId,
  lines: { covered: 0, total: linesTotal, pct: 0 },
  branches: { covered: 0, total: 0, pct: 0 },
  functions: { covered: 0, total: functionsTotal, pct: 0 },
});

const elements: readonly C4Element[] = [
  { id: 'pkg_a', name: 'a', type: 'container' },
  { id: 'comp_x', name: 'x', type: 'component', boundaryId: 'pkg_a' },
  { id: 'file::packages/a/foo.ts', name: 'foo.ts', type: 'code', boundaryId: 'comp_x' },
  { id: 'file::packages/a/bar.ts', name: 'bar.ts', type: 'code', boundaryId: 'comp_x' },
];

const matrix: CoverageMatrix = {
  entries: [
    cov('file::packages/a/foo.ts', 100, 5),
    cov('file::packages/a/bar.ts', 200, 10),
  ],
  generatedAt: 0,
};

describe('buildSizeMatrix', () => {
  it('code 要素は自分自身の値', () => {
    const r = buildSizeMatrix(matrix, elements);
    expect(r['file::packages/a/foo.ts']).toEqual({ loc: 100, files: 1, functions: 5 });
    expect(r['file::packages/a/bar.ts']).toEqual({ loc: 200, files: 1, functions: 10 });
  });

  it('component 要素は子 code の合計', () => {
    const r = buildSizeMatrix(matrix, elements);
    expect(r['comp_x']).toEqual({ loc: 300, files: 2, functions: 15 });
  });

  it('container 要素は子孫 code の合計', () => {
    const r = buildSizeMatrix(matrix, elements);
    expect(r['pkg_a']).toEqual({ loc: 300, files: 2, functions: 15 });
  });

  it('coverage に該当エントリが無い code 要素は出力に含めない', () => {
    const r = buildSizeMatrix(matrix, [
      { id: 'file::packages/x/orphan.ts', name: 'o', type: 'code' },
    ]);
    expect(r).toEqual({});
  });

  it('coverageMatrix が空なら空オブジェクト', () => {
    const r = buildSizeMatrix({ entries: [], generatedAt: 0 }, elements);
    expect(r).toEqual({});
  });
});
