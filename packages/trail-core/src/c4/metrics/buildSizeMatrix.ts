import type { CoverageMatrix, C4Element } from '../types';
import { collectDescendantIds } from '../view/collectDescendants';

export interface SizeMetricsEntry {
  readonly loc: number;
  readonly files: number;
  readonly functions: number;
}

export type SizeMatrix = Record<string, SizeMetricsEntry>;

/**
 * coverageMatrix を起点に、C4 要素単位のサイズメトリクス
 * (LOC / files / functions) を集計する。
 *
 * - code 要素: 自分自身の coverage エントリ値
 * - container / component 要素: 子孫 code 要素の合計
 * - coverage が 1 件も該当しない要素は結果に含めない (色なし扱い)
 */
export function buildSizeMatrix(
  coverageMatrix: CoverageMatrix,
  elements: readonly C4Element[],
): SizeMatrix {
  const entryById = new Map<string, CoverageMatrix['entries'][number]>();
  for (const e of coverageMatrix.entries) {
    entryById.set(e.elementId, e);
  }

  const out: Record<string, SizeMetricsEntry> = {};
  for (const el of elements) {
    if (el.type === 'code') {
      const entry = entryById.get(el.id);
      if (!entry) continue;
      out[el.id] = {
        loc: entry.lines.total,
        files: 1,
        functions: entry.functions.total,
      };
      continue;
    }
    // boundary 要素 (container / component / system 等): 子孫 code の合計
    const descendants = collectDescendantIds(elements, el.id);
    let loc = 0;
    let files = 0;
    let functions = 0;
    let hasData = false;
    for (const id of descendants) {
      const desc = elements.find((e) => e.id === id);
      if (desc?.type !== 'code') continue;
      const entry = entryById.get(id);
      if (!entry) continue;
      loc += entry.lines.total;
      files += 1;
      functions += entry.functions.total;
      hasData = true;
    }
    if (hasData) out[el.id] = { loc, files, functions };
  }
  return out;
}
