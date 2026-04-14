import type { ImportanceMatrix } from '../../importance/types';
import type { C4Element } from '../../domain/engine/c4Mapper';
import { TypeScriptAdapter } from '../../importance/adapters/TypeScriptAdapter';
import { ImportanceAnalyzer } from '../../importance/ImportanceAnalyzer';
import { mapFilesToC4Elements } from '../../domain/engine/c4Mapper';

/**
 * tsconfig.json のパスと C4 要素リストを受け取り、
 * 要素IDごとの重要度スコア（0〜100）を返す。
 * 集約戦略: 同一要素内の関数スコアは max を採用。
 */
export function computeImportanceMatrix(
  tsconfigPath: string,
  c4Elements: readonly C4Element[],
): ImportanceMatrix {
  if (c4Elements.length === 0) return {};

  const adapter = TypeScriptAdapter.fromTsConfig(tsconfigPath);

  // 全ソースファイルを取得（宣言ファイル・node_modules を除外）
  const allSourceFiles = adapter
    .getProgram()
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile && !sf.fileName.includes('node_modules'))
    .map((sf) => sf.fileName);

  const analyzer = new ImportanceAnalyzer(adapter);
  const scored = analyzer.analyze(allSourceFiles);

  // 関数ファイルパス → C4 要素IDへのマッピング（max 集約）
  const elementScores = new Map<string, number>();
  for (const fn of scored) {
    const mappings = mapFilesToC4Elements([fn.filePath], c4Elements);
    for (const mapping of mappings) {
      const current = elementScores.get(mapping.elementId) ?? 0;
      if (fn.importanceScore > current) {
        elementScores.set(mapping.elementId, fn.importanceScore);
      }
    }
  }

  const matrix: ImportanceMatrix = {};
  for (const [elementId, score] of elementScores) {
    matrix[elementId] = score;
  }
  return matrix;
}
