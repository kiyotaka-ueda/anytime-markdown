import type { CallNode } from '../parse/callTree';

export interface FilterOptions {
    maxDepth?: number;
    hiddenLifelines?: Set<string>;
}

export function applyFilters(root: CallNode, opts: FilterOptions): CallNode {
    return cloneFiltered(root, opts);
}

function cloneFiltered(node: CallNode, opts: FilterOptions): CallNode {
    const children: CallNode[] = [];
    for (const c of node.children) {
        if (opts.maxDepth !== undefined && c.depth > opts.maxDepth) continue;
        if (opts.hiddenLifelines?.has(c.lifelineId)) continue;
        children.push(cloneFiltered(c, opts));
    }
    return { ...node, children };
}
