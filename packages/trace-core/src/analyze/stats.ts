import type { CallNode } from '../parse/callTree';

export interface TraceStats {
    totalCalls: number;
    errorCount: number;
    callsByFn: Map<string, number>;
    maxDepth: number;
}

export function computeStats(root: CallNode): TraceStats {
    const stats: TraceStats = {
        totalCalls: 0,
        errorCount: 0,
        callsByFn: new Map(),
        maxDepth: 0,
    };
    walk(root, stats);
    return stats;
}

function walk(node: CallNode, stats: TraceStats): void {
    if (node.eventId !== -1) {
        stats.totalCalls += 1;
        if (!node.ok) stats.errorCount += 1;
        stats.callsByFn.set(node.fn, (stats.callsByFn.get(node.fn) ?? 0) + 1);
        if (node.depth > stats.maxDepth) stats.maxDepth = node.depth;
    }
    for (const c of node.children) walk(c, stats);
}
