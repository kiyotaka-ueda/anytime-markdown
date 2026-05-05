import { aggregateImportanceToFile } from '../aggregateImportanceToFile';
import type { ScoredFunction } from '../../importance/types';

const fn = (filePath: string, fanIn: number, cog: number, score: number): ScoredFunction => ({
  id: `file::${filePath}::f`,
  name: 'f',
  filePath,
  startLine: 1,
  endLine: 10,
  language: 'ts',
  metrics: { fanIn, cognitiveComplexity: cog, dataMutationScore: 0, sideEffectScore: 0, lineCount: 10 },
  importanceScore: score,
});

describe('aggregateImportanceToFile', () => {
  it('同一ファイル内は max(score) / sum(fanIn) / max(cognitive) / count', () => {
    const result = aggregateImportanceToFile([
      fn('a.ts', 3, 5, 50),
      fn('a.ts', 2, 8, 70),
      fn('b.ts', 0, 1, 10),
    ]);
    const a = result.get('a.ts')!;
    expect(a.importanceScore).toBe(70);
    expect(a.fanInTotal).toBe(5);
    expect(a.cognitiveComplexityMax).toBe(8);
    expect(a.functionCount).toBe(2);
    expect(result.get('b.ts')!.functionCount).toBe(1);
  });

  it('空配列なら空 Map', () => {
    expect(aggregateImportanceToFile([]).size).toBe(0);
  });
});
