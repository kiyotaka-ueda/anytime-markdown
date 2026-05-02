import { applyFilters } from '../analyze/filters';
import { buildCallTree } from '../parse/callTree';
import type { TraceFile } from '../types';
import * as fs from 'fs';
import * as path from 'path';

function loadFixture(name: string): TraceFile {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8'));
}

describe('applyFilters', () => {
    it('removes nodes deeper than maxDepth', () => {
        const file = loadFixture('deep-stack.json');
        const tree = buildCallTree(file);
        const filtered = applyFilters(tree, { maxDepth: 3 });
        const depths = collectDepths(filtered);
        expect(Math.max(...depths)).toBeLessThanOrEqual(3);
    });

    it('removes nodes whose lifeline is hidden', () => {
        const file = loadFixture('simple.json');
        const tree = buildCallTree(file);
        const filtered = applyFilters(tree, { hiddenLifelines: new Set(['L1']) });
        expect(JSON.stringify(filtered)).not.toContain('"bar"');
    });
});

type DepthNode = { depth: number; children: DepthNode[] };

function collectDepths(node: DepthNode): number[] {
    const out: number[] = [];
    function walk(n: DepthNode): void {
        if (n.depth >= 0) out.push(n.depth);
        for (const c of n.children) walk(c);
    }
    walk(node);
    return out;
}
