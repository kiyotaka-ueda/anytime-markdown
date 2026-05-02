import { buildSequenceLayout, type LayoutOptions } from '../engine/layout';
import { buildCallTree } from '@anytime-markdown/trace-core/parse';
import type { TraceFile } from '@anytime-markdown/trace-core/types';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES = path.join(__dirname, '../../../trace-core/src/__tests__/fixtures');

function loadFixture(name: string): TraceFile {
    const fixturePath = path.join(FIXTURES, name);
    return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
}

describe('buildSequenceLayout', () => {
    it('produces one header node per active lifeline', () => {
        const file = loadFixture('simple.json');
        const tree = buildCallTree(file);
        const layout = buildSequenceLayout(file, tree);
        const headers = layout.nodes.filter(n => n.metadata?.['role'] === 'header');
        expect(headers).toHaveLength(2);
        expect(headers.map(h => h.text).sort()).toEqual(['src/bar.ts', 'src/foo.ts']);
    });

    it('produces dashed vertical line edges for lifelines', () => {
        const file = loadFixture('simple.json');
        const tree = buildCallTree(file);
        const layout = buildSequenceLayout(file, tree);
        const lifelineEdges = layout.edges.filter(e => e.style.dashed);
        expect(lifelineEdges.length).toBeGreaterThanOrEqual(2);
    });

    it('produces arrow edges for cross-lifeline calls', () => {
        const file = loadFixture('simple.json');
        const tree = buildCallTree(file);
        const layout = buildSequenceLayout(file, tree);
        const callArrows = layout.edges.filter(e => e.style.endShape === 'arrow' && e.label);
        // foo() calls bar() → 1 call arrow
        expect(callArrows.length).toBeGreaterThanOrEqual(1);
        const barCall = callArrows.find(e => e.label === 'bar');
        expect(barCall).toBeDefined();
    });

    it('handles error traces without throwing', () => {
        const file = loadFixture('with-error.json');
        const tree = buildCallTree(file);
        expect(() => buildSequenceLayout(file, tree)).not.toThrow();
    });

    it('respects maxDepth option', () => {
        const file = loadFixture('deep-stack.json');
        const tree = buildCallTree(file);
        const layout = buildSequenceLayout(file, tree, { maxDepth: 2 });
        // All call arrows should be at depth <= 2
        const callArrows = layout.edges.filter(e => e.style.endShape === 'arrow');
        for (const arrow of callArrows) {
            const depth = arrow.metadata?.['depth'] as number | undefined;
            if (depth !== undefined) {
                expect(depth).toBeLessThanOrEqual(2);
            }
        }
    });

    it('returns lifelineXMap with correct lifeline IDs', () => {
        const file = loadFixture('simple.json');
        const tree = buildCallTree(file);
        const layout = buildSequenceLayout(file, tree);
        expect(layout.lifelineXMap.has('L0')).toBe(true);
        expect(layout.lifelineXMap.has('L1')).toBe(true);
    });

    it('returns positive width and height', () => {
        const file = loadFixture('simple.json');
        const tree = buildCallTree(file);
        const layout = buildSequenceLayout(file, tree);
        expect(layout.width).toBeGreaterThan(0);
        expect(layout.height).toBeGreaterThan(0);
    });
});
