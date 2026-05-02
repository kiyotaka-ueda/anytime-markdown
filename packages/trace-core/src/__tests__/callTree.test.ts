import { buildCallTree, type CallNode } from '../parse/callTree';
import * as path from 'path';
import * as fs from 'fs';
import type { TraceFile } from '../types';

function loadFixture(name: string): TraceFile {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8'));
}

describe('buildCallTree', () => {
    it('builds parent-child relations from flat events', () => {
        const file = loadFixture('simple.json');
        const tree = buildCallTree(file);
        expect(tree.children).toHaveLength(1);
        expect(tree.children[0].fn).toBe('foo');
        expect(tree.children[0].children).toHaveLength(1);
        expect(tree.children[0].children[0].fn).toBe('bar');
    });

    it('marks errored calls as ok=false', () => {
        const file = loadFixture('with-error.json');
        const tree = buildCallTree(file);
        const fooNode = tree.children[0];
        expect(fooNode.ok).toBe(false);
        expect(fooNode.error?.message).toBe('boom');
    });

    it('records duration from call to return ts', () => {
        const file = loadFixture('simple.json');
        const tree = buildCallTree(file);
        const fooNode = tree.children[0];
        expect(fooNode.durationMs).toBeCloseTo(0.010, 5);
    });
});
