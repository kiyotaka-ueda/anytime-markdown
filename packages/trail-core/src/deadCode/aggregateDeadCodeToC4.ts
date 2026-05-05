import type { C4Element } from '../domain/engine/c4Mapper';
import { mapFilesToC4Elements } from '../domain/engine/c4Mapper';
import type { FileAnalysisRow } from './types';

/**
 * ファイル単位の dead code score を C4 要素 (container/component) に max 集約する。
 * - is_ignored=1 のファイルは deadCodeScore が 0 で永続化されている前提なので
 *   このロジック内で特別扱い不要。
 * - system 要素は除外（境界フレームに色伝播させないため）。
 *
 * @returns elementId → maxScore の Map。スコア 0 の要素は含めない。
 */
export function aggregateDeadCodeToC4(
  rows: readonly FileAnalysisRow[],
  elements: readonly C4Element[],
): Map<string, number> {
  const out = new Map<string, number>();
  const mappable = elements.filter((el) => el.type !== 'system');
  for (const r of rows) {
    if (r.deadCodeScore <= 0) continue;
    const mappings = mapFilesToC4Elements([r.filePath], mappable);
    for (const m of mappings) {
      const cur = out.get(m.elementId) ?? 0;
      if (r.deadCodeScore > cur) out.set(m.elementId, r.deadCodeScore);
    }
  }
  return out;
}
