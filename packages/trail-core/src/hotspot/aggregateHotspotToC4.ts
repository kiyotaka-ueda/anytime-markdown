import type { C4Element, C4Model, ComplexityClass, ComplexityMatrix } from '../c4/types';
import { buildPathToCodeIdIndex } from './pathIndex';
import type { FileHotspotRow, HotspotEntry, HotspotMap } from './types';

const COMPLEXITY_SCORE: Record<ComplexityClass, number> = {
  'low-complexity': 0,
  'search-only': 1,
  'multi-file-edit': 2,
  'high-complexity': 3,
};

function buildAncestorChain(
  elementById: ReadonlyMap<string, C4Element>,
  startId: string,
): readonly string[] {
  const chain: string[] = [];
  const visited = new Set<string>();
  let cur: string | undefined = startId;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    chain.push(cur);
    cur = elementById.get(cur)?.boundaryId;
  }
  return chain;
}

function rollupMaxToAncestors(
  baseValues: ReadonlyMap<string, number>,
  c4Model: C4Model,
): Map<string, number> {
  const elementById = new Map(c4Model.elements.map((el) => [el.id, el] as const));
  const result = new Map<string, number>();
  for (const [id, value] of baseValues) {
    if (!elementById.has(id)) continue;
    for (const ancestorId of buildAncestorChain(elementById, id)) {
      const prev = result.get(ancestorId) ?? 0;
      if (value > prev) result.set(ancestorId, value);
    }
  }
  return result;
}

function buildFileChurnMap(
  fileHotspots: readonly FileHotspotRow[],
  c4Model: C4Model,
): Map<string, number> {
  const pathIndex = buildPathToCodeIdIndex(c4Model);
  const churnByCodeId = new Map<string, number>();
  for (const { filePath, churn } of fileHotspots) {
    const ids = pathIndex.get(stripIndexKey(filePath)) ?? [];
    for (const id of ids) {
      const prev = churnByCodeId.get(id) ?? 0;
      if (churn > prev) churnByCodeId.set(id, churn);
    }
  }
  return churnByCodeId;
}

function stripIndexKey(filePath: string): string {
  return filePath.replace(/\.(tsx?|mdx?)$/, '');
}

function buildBaseComplexityMap(
  complexityMatrix: ComplexityMatrix | null,
): Map<string, number> {
  const result = new Map<string, number>();
  if (!complexityMatrix) return result;
  for (const entry of complexityMatrix.entries) {
    result.set(entry.elementId, COMPLEXITY_SCORE[entry.highest]);
  }
  return result;
}

export function aggregateHotspotToC4(
  fileHotspots: readonly FileHotspotRow[],
  c4Model: C4Model,
  complexityMatrix: ComplexityMatrix | null,
): HotspotMap {
  const codeChurn = buildFileChurnMap(fileHotspots, c4Model);
  const churnByElement = rollupMaxToAncestors(codeChurn, c4Model);

  const baseComplexity = buildBaseComplexityMap(complexityMatrix);
  const complexityByElement = rollupMaxToAncestors(baseComplexity, c4Model);

  const maxChurn = Math.max(1, ...churnByElement.values());
  const maxComplexity = Math.max(1, ...complexityByElement.values());

  const result = new Map<string, HotspotEntry>();
  const elementIds = new Set<string>([
    ...churnByElement.keys(),
    ...complexityByElement.keys(),
  ]);
  for (const id of elementIds) {
    const churn = churnByElement.get(id) ?? 0;
    const complexity = complexityByElement.get(id) ?? 0;
    const churnNorm = churn / maxChurn;
    const complexityNorm = complexity / maxComplexity;
    result.set(id, {
      elementId: id,
      churn,
      churnNorm,
      complexity,
      complexityNorm,
      risk: churnNorm * complexityNorm,
    });
  }
  return result;
}
