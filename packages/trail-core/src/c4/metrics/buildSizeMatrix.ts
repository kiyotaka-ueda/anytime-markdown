import type { C4Element } from '../types';
import { collectDescendantIds } from '../view/collectDescendants';

export interface SizeFileEntry {
  readonly elementId: string;   // 例: "file::packages/foo/src/bar.ts"
  readonly lineCount: number;
  readonly functionCount: number;
}

export interface SizeMetricsEntry {
  readonly loc: number;
  readonly files: number;
  readonly functions: number;
}

export type SizeMatrix = Record<string, SizeMetricsEntry>;

export function buildSizeMatrix(
  fileEntries: readonly SizeFileEntry[],
  elements: readonly C4Element[],
): SizeMatrix {
  const entryById = new Map<string, SizeFileEntry>();
  for (const e of fileEntries) {
    entryById.set(e.elementId, e);
  }

  const out: Record<string, SizeMetricsEntry> = {};
  for (const el of elements) {
    if (el.type === 'code') {
      const entry = entryById.get(el.id);
      if (!entry || entry.lineCount === 0) continue;
      out[el.id] = {
        loc: entry.lineCount,
        files: 1,
        functions: entry.functionCount,
      };
      continue;
    }
    // boundary 要素
    const descendants = collectDescendantIds(elements, el.id);
    let loc = 0, files = 0, functions = 0;
    let hasData = false;
    for (const id of descendants) {
      const desc = elements.find((e) => e.id === id);
      if (desc?.type !== 'code') continue;
      const entry = entryById.get(id);
      if (!entry || entry.lineCount === 0) continue;
      loc += entry.lineCount;
      files += 1;
      functions += entry.functionCount;
      hasData = true;
    }
    if (hasData) out[el.id] = { loc, files, functions };
  }
  return out;
}
