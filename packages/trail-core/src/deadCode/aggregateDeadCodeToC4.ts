import type { C4Element } from '../domain/engine/c4Mapper';
import { mapFilesToC4Elements } from '../domain/engine/c4Mapper';
import type { FileAnalysisRow } from './types';

/**
 * ファイル単位の dead code score を C4 要素 (leaf) に max 集約する。
 * - is_ignored=1 のファイルは deadCodeScore が 0 で永続化されている前提なので
 *   このロジック内で特別扱い不要。
 * - system 要素は除外（境界フレームに色伝播させないため）。
 * - 親 container/component には伝播させず leaf のみを着色する
 *   （フレーム全体が色付けされる視覚ノイズを避けるため）。
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
    // leaf のみ採用 (boundaryId チェーンを辿った親には伝播させない)
    const leaf = mappings[0];
    if (!leaf) continue;
    const cur = out.get(leaf.elementId) ?? 0;
    if (r.deadCodeScore > cur) out.set(leaf.elementId, r.deadCodeScore);
  }
  return out;
}
