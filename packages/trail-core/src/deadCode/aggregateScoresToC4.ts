import type { C4Element } from '../domain/engine/c4Mapper';
import { mapFilesToC4Elements } from '../domain/engine/c4Mapper';

/**
 * ファイル単位スコア (Record<filePath, score>) を C4 要素単位の max スコアに集約する。
 * - system 要素は除外（境界フレームに色伝播させないため）。
 * - score <= 0 のファイルはスキップ（要素に色を付けない）。
 */
export function aggregateScoresToC4(
  fileScores: Record<string, number>,
  elements: readonly C4Element[],
): Record<string, number> {
  const out: Record<string, number> = {};
  const mappable = elements.filter((el) => el.type !== 'system');
  for (const [filePath, score] of Object.entries(fileScores)) {
    if (score <= 0) continue;
    const mappings = mapFilesToC4Elements([filePath], mappable);
    for (const m of mappings) {
      const cur = out[m.elementId] ?? 0;
      if (score > cur) out[m.elementId] = score;
    }
  }
  return out;
}
