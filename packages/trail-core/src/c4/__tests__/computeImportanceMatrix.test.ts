import path from 'node:path';
import { computeImportanceMatrix } from '../metrics/computeImportanceMatrix';
import type { C4Element } from '../../domain/engine/c4Mapper';

const TRAIL_CORE_TSCONFIG = path.resolve(__dirname, '../../../tsconfig.json');

// trail-core パッケージに対応するモック C4 要素
// mapFilesToC4Elements は /^packages\/([^/]+)\//.exec(filePath) でパッケージ名を抽出し
// 'pkg_' + パッケージ名 の形式で elementId を探す
const mockElements: C4Element[] = [
  {
    id: 'pkg_trail-core',
    name: 'trail-core',
    type: 'container',
  },
];

describe('computeImportanceMatrix', () => {
  it('returns a Record<string, number>', () => {
    const result = computeImportanceMatrix(TRAIL_CORE_TSCONFIG, mockElements);
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('all scores are in 0-100 range', () => {
    const result = computeImportanceMatrix(TRAIL_CORE_TSCONFIG, mockElements);
    for (const score of Object.values(result)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('returns empty object when no elements match', () => {
    const result = computeImportanceMatrix(TRAIL_CORE_TSCONFIG, []);
    expect(result).toEqual({});
  });
});
