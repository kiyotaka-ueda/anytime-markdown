import type { C4Model, C4TreeNode } from '../types';
import type { CommunitySummary } from '../../codeGraph';
import type { CommunityOverlayEntry } from '../computeCommunityOverlay';

export interface CommunityTreeInput {
  readonly c4Model: C4Model;
  readonly communityOverlay: ReadonlyMap<string, CommunityOverlayEntry>;
  readonly communities: Record<number, string>;
  readonly communitySummaries?: Record<number, CommunitySummary>;
}

export function buildCommunityTree(input: CommunityTreeInput): C4TreeNode[] {
  const { c4Model, communityOverlay, communities, communitySummaries } = input;
  const elements = c4Model.elements;

  const elementById = new Map(elements.map(el => [el.id, el]));

  const componentsByCommunity = new Map<number, string[]>();
  for (const [elementId, entry] of communityOverlay) {
    const cid = entry.dominantCommunity;
    const list = componentsByCommunity.get(cid);
    if (list) {
      list.push(elementId);
    } else {
      componentsByCommunity.set(cid, [elementId]);
    }
  }

  if (componentsByCommunity.size === 0) return [];

  const sortedCommunityIds = [...componentsByCommunity.keys()].sort((a, b) => a - b);

  const result: C4TreeNode[] = [];

  for (const cid of sortedCommunityIds) {
    const componentIds = componentsByCommunity.get(cid)!;
    const summary = communitySummaries?.[cid];
    const label = communities[cid];
    const communityName = summary?.name ?? label ?? `#${cid}`;

    const componentsByContainer = new Map<string | undefined, string[]>();
    for (const compId of componentIds) {
      const el = elementById.get(compId);
      const parentId = el?.boundaryId;
      const list = componentsByContainer.get(parentId);
      if (list) {
        list.push(compId);
      } else {
        componentsByContainer.set(parentId, [compId]);
      }
    }

    const containerNodes: C4TreeNode[] = [];
    for (const [containerId, compIds] of componentsByContainer) {
      const containerEl = containerId ? elementById.get(containerId) : undefined;

      const componentNodes: C4TreeNode[] = compIds
        .flatMap(compId => {
          const compEl = elementById.get(compId);
          if (!compEl) return [];
          const codeChildren: C4TreeNode[] = elements
            .filter(el => el.boundaryId === compId && el.type === 'code')
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(el => ({
              id: el.id,
              name: el.name,
              type: el.type as C4TreeNode['type'],
              children: [] as C4TreeNode[],
            }));
          const node: C4TreeNode = {
            id: compEl.id,
            name: compEl.name,
            type: compEl.type,
            ...(compEl.description ? { description: compEl.description } : {}),
            children: codeChildren,
          };
          return [node];
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      if (containerEl) {
        containerNodes.push({
          id: containerEl.id,
          name: containerEl.name,
          type: containerEl.type,
          ...(containerEl.technology ? { technology: containerEl.technology } : {}),
          ...(containerEl.serviceType ? { serviceType: containerEl.serviceType } : {}),
          children: componentNodes,
        });
      } else {
        containerNodes.push(...componentNodes);
      }
    }

    containerNodes.sort((a, b) => a.name.localeCompare(b.name));

    result.push({
      id: `community:${cid}`,
      name: communityName,
      type: 'community',
      communityId: cid,
      nodeCount: componentIds.length,
      ...(summary?.summary ? { description: summary.summary } : {}),
      children: containerNodes,
    });
  }

  return result;
}
