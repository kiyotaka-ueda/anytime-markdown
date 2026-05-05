import type { CodeGraphNode, StoredCodeGraph } from '../codeGraph';
import type { C4Model, C4Element, C4Relationship } from './types';

/**
 * `current_code_graphs.graph_json` の {@link StoredCodeGraph} 形式から
 * C4 派生モデルを計算する。
 *
 * - `repositories[i]` → System (`sys_<repo.id>`)
 * - `nodes[].package` → Container (`pkg_<package>`)
 *   `boundaryId` は当該 package の最初に現れた node の `repo`
 * - `nodes[].community` → Component (`community_<n>`)
 *   `boundaryId` は同コミュニティ内で最頻の package
 * - `nodes[]` → Code element (id は `node.id` をそのまま使用)
 *   `boundaryId` は当該ノードの `community_<n>`
 * - `edges` を file / component / container の 3 階層に重複排除して集約
 *
 * 旧 {@link import('../transform/toC4').trailToC4} との違い:
 *
 * - 入力が `TrailGraph` (`metadata.projectRoot` ベース) ではなく
 *   `StoredCodeGraph` (`repositories` + `node.package` / `node.community` ベース)
 * - Component 単位はディレクトリ名ではなくコミュニティ ID
 * - `pkg_<package>` 命名規則は維持（`c4_manual_*` の参照との互換性確保）
 */
export function codeGraphToC4(graph: StoredCodeGraph): C4Model {
  const elements: C4Element[] = [];
  const relationships: C4Relationship[] = [];

  // 異常入力（リポジトリ 0 件）でも例外を投げず空モデルを返す
  if (graph.repositories.length === 0 && graph.nodes.length === 0) {
    return { title: 'Project Analysis', level: 'code', elements, relationships };
  }

  // --- Phase 1: System 要素 ---
  for (const repo of graph.repositories) {
    elements.push({
      id: `sys_${repo.id}`,
      type: 'system',
      name: repo.label,
    });
  }

  // --- Phase 2: package → repo マップ + Container 要素 ---
  const packageToRepo = new Map<string, string>();
  const packageOrder: string[] = [];
  for (const node of graph.nodes) {
    if (!node.package) continue;
    if (!packageToRepo.has(node.package)) {
      packageToRepo.set(node.package, node.repo);
      packageOrder.push(node.package);
    }
  }
  for (const pkg of packageOrder) {
    const repo = packageToRepo.get(pkg) ?? '';
    elements.push({
      id: `pkg_${pkg}`,
      type: 'container',
      name: pkg,
      ...(repo ? { boundaryId: `sys_${repo}` } : {}),
    });
  }

  // --- Phase 3: community → 最頻 package + Component 要素 ---
  type CommunityState = {
    label: string;
    pkgCount: Map<string, number>;
  };
  const communityState = new Map<number, CommunityState>();
  const communityOrder: number[] = [];
  for (const node of graph.nodes) {
    let st = communityState.get(node.community);
    if (!st) {
      st = { label: node.communityLabel ?? '', pkgCount: new Map() };
      communityState.set(node.community, st);
      communityOrder.push(node.community);
    }
    if (node.package) {
      st.pkgCount.set(node.package, (st.pkgCount.get(node.package) ?? 0) + 1);
    }
    // 既存 communityLabel が空なら新しいもので埋める
    if (!st.label && node.communityLabel) st.label = node.communityLabel;
  }

  const communityToPkg = new Map<number, string>();
  for (const community of communityOrder) {
    const st = communityState.get(community);
    if (!st) continue;
    let mostFreq = '';
    let maxCount = 0;
    for (const [pkg, count] of st.pkgCount) {
      if (count > maxCount) {
        maxCount = count;
        mostFreq = pkg;
      }
    }
    communityToPkg.set(community, mostFreq);
    elements.push({
      id: `community_${community}`,
      type: 'component',
      name: st.label || `community-${community}`,
      ...(mostFreq ? { boundaryId: `pkg_${mostFreq}` } : {}),
    });
  }

  // --- Phase 4: Code 要素 ---
  for (const node of graph.nodes) {
    elements.push({
      id: node.id,
      type: 'code',
      name: node.label,
      boundaryId: `community_${node.community}`,
    });
  }

  // --- Phase 5: Relationships を 3 階層に集約 ---
  const nodeById = new Map<string, CodeGraphNode>();
  for (const node of graph.nodes) nodeById.set(node.id, node);

  const fileSeen = new Set<string>();
  const componentSeen = new Set<string>();
  const containerSeen = new Set<string>();

  for (const edge of graph.edges) {
    const src = nodeById.get(edge.source);
    const dst = nodeById.get(edge.target);
    if (!src || !dst) continue;

    // file 層
    const fileKey = `${edge.source}→${edge.target}`;
    if (!fileSeen.has(fileKey)) {
      fileSeen.add(fileKey);
      relationships.push({ from: edge.source, to: edge.target, label: 'imports' });
    }

    // component 層 (異 community のみ)
    if (src.community !== dst.community) {
      const cKey = `${src.community}→${dst.community}`;
      if (!componentSeen.has(cKey)) {
        componentSeen.add(cKey);
        relationships.push({
          from: `community_${src.community}`,
          to: `community_${dst.community}`,
          label: 'imports',
        });
      }
    }

    // container 層 (異 package のみ)
    if (src.package && dst.package && src.package !== dst.package) {
      const pKey = `${src.package}→${dst.package}`;
      if (!containerSeen.has(pKey)) {
        containerSeen.add(pKey);
        relationships.push({
          from: `pkg_${src.package}`,
          to: `pkg_${dst.package}`,
          label: 'imports',
        });
      }
    }
  }

  return {
    title: 'Project Analysis',
    level: 'code',
    elements,
    relationships,
  };
}
