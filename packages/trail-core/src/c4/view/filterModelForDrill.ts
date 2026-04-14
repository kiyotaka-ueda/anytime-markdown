import type { C4Model } from '../types';

/**
 * rootId 要素の直接子要素（boundaryId === rootId）のみを表示する
 * フィルタリングされた C4Model を返す。
 * root 自身は elements に含めず、直接子要素を新たなトップレベル要素とする。
 * relationships は root の全子孫間のものだけに絞る。
 */
export function filterModelForDrill(model: C4Model, rootId: string): C4Model {
  const directChildren = model.elements.filter(e => e.boundaryId === rootId);
  const visibleIds = collectAllDescendantIds(model.elements, rootId);

  const filteredRelationships = model.relationships.filter(
    (rel) => visibleIds.has(rel.from) && visibleIds.has(rel.to),
  );

  return {
    ...model,
    elements: directChildren,
    relationships: filteredRelationships,
  };
}

/**
 * elements の中から parentId の子孫 ID をすべて収集する（boundaryId チェーンを再帰的に辿る）。
 */
function collectAllDescendantIds(
  elements: C4Model['elements'],
  parentId: string,
): Set<string> {
  const ids = new Set<string>();
  function traverse(pid: string): void {
    for (const el of elements) {
      if (el.boundaryId === pid) {
        ids.add(el.id);
        traverse(el.id);
      }
    }
  }
  traverse(parentId);
  return ids;
}
