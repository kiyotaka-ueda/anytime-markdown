import type { C4Model } from './types';
import type { CodeGraph, CodeGraphNode, CommunitySummary } from '../codeGraph';
import { collectDescendantIds } from './view/collectDescendants';

export interface CommunityOverlayEntry {
  /** C4 要素 ID（pkg_* / file::*） */
  readonly elementId: string;
  /** 最頻コミュニティ番号 */
  readonly dominantCommunity: number;
  /** 最頻コミュニティの占有率（0..1） */
  readonly dominantRatio: number;
  /** 配下ノードのコミュニティ別出現回数（降順、同数時は community 番号昇順） */
  readonly breakdown: ReadonlyArray<{ readonly community: number; readonly count: number }>;
  /** L4 のみ true になりうる */
  readonly isGodNode: boolean;
  /** AI 生成のコミュニティ要約（あれば） */
  readonly communitySummary?: CommunitySummary;
}

const FILE_PREFIX = 'file::';
const STRIPPABLE_EXT_RE = /\.(tsx?|mdx?)$/;

function stripExt(filePath: string): string {
  return filePath.replace(STRIPPABLE_EXT_RE, '');
}

function findNodeByPath(
  cleanedPath: string,
  selectedRepo: string | null,
  repoIds: readonly string[],
  nodesById: ReadonlyMap<string, CodeGraphNode>,
): CodeGraphNode | undefined {
  if (selectedRepo) {
    return nodesById.get(`${selectedRepo}:${cleanedPath}`);
  }
  for (const repo of repoIds) {
    const found = nodesById.get(`${repo}:${cleanedPath}`);
    if (found) return found;
  }
  return undefined;
}

/**
 * C4 要素 ID と CodeGraph コミュニティを対応付けるオーバーレイマップを生成する。
 *
 * - L4: `type === 'code'` の要素を CodeGraph ノードと 1:1 対応付ける
 * - L3: `type === 'component'` の要素について配下の `code` を集約し、最頻コミュニティを決定する
 *
 * 同数最頻時は community 番号昇順を優先（決定性確保）。
 */
export function computeCommunityOverlay(
  c4Model: C4Model,
  codeGraph: CodeGraph,
  level: 3 | 4,
  selectedRepo: string | null,
): ReadonlyMap<string, CommunityOverlayEntry> {
  const result = new Map<string, CommunityOverlayEntry>();
  if (level !== 3 && level !== 4) return result;
  if (codeGraph.nodes.length === 0) return result;

  const nodesById = new Map<string, CodeGraphNode>();
  for (const node of codeGraph.nodes) {
    if (selectedRepo && node.repo !== selectedRepo) continue;
    nodesById.set(node.id, node);
  }
  if (nodesById.size === 0) return result;

  const repoIds = codeGraph.repositories.map((r) => r.id);
  const godNodeSet = new Set(codeGraph.godNodes);
  const summaries = codeGraph.communitySummaries;

  if (level === 4) {
    for (const el of c4Model.elements) {
      if (el.type !== 'code') continue;
      if (!el.id.startsWith(FILE_PREFIX)) continue;
      const filePath = el.id.slice(FILE_PREFIX.length);
      const cleaned = stripExt(filePath);
      const node = findNodeByPath(cleaned, selectedRepo, repoIds, nodesById);
      if (!node) continue;

      result.set(el.id, {
        elementId: el.id,
        dominantCommunity: node.community,
        dominantRatio: 1,
        breakdown: [{ community: node.community, count: 1 }],
        isGodNode: godNodeSet.has(node.id),
        communitySummary: summaries?.[node.community],
      });
    }
    return result;
  }

  // level === 3
  for (const el of c4Model.elements) {
    if (el.type !== 'component') continue;
    const descendantIds = collectDescendantIds(c4Model.elements, el.id);
    const counts = new Map<number, number>();
    for (const id of descendantIds) {
      if (!id.startsWith(FILE_PREFIX)) continue;
      const filePath = id.slice(FILE_PREFIX.length);
      const cleaned = stripExt(filePath);
      const node = findNodeByPath(cleaned, selectedRepo, repoIds, nodesById);
      if (!node) continue;
      counts.set(node.community, (counts.get(node.community) ?? 0) + 1);
    }
    if (counts.size === 0) continue;

    // 降順 count、同数時は community 番号昇順
    const breakdown = Array.from(counts, ([community, count]) => ({ community, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.community - b.community));
    const total = breakdown.reduce((sum, e) => sum + e.count, 0);
    const dominant = breakdown[0];

    result.set(el.id, {
      elementId: el.id,
      dominantCommunity: dominant.community,
      dominantRatio: dominant.count / total,
      breakdown,
      isGodNode: false,
      communitySummary: summaries?.[dominant.community],
    });
  }
  return result;
}
