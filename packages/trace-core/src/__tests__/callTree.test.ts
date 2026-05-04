import { buildCallTree, type CallNode } from '../parse/callTree';
import * as path from 'path';
import * as fs from 'fs';
import type { TraceFile } from '../types';

const BASE_META = {
    startedAt: '', endedAt: '', command: '', cwd: '', nodeVersion: '', depthLimit: 0,
};

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

    it('skips orphan return event whose call id is not in the map', () => {
        const file: TraceFile = {
            version: 1,
            metadata: BASE_META,
            lifelines: [{ id: 'A', kind: 'file' }],
            events: [
                { id: 1, type: 'call', ts: 0, from: null, to: 'A', fn: 'fn', args: [], depth: 0 },
                { id: 2, type: 'return', ts: 1, of: 999, ok: true, result: null },
                { id: 3, type: 'return', ts: 2, of: 1, ok: true, result: null },
            ],
        };
        const tree = buildCallTree(file);
        expect(tree.children).toHaveLength(1);
        expect(tree.children[0].endTs).toBe(2);
    });

    it('does not pop root when stack is already at root after return', () => {
        const file: TraceFile = {
            version: 1,
            metadata: BASE_META,
            lifelines: [{ id: 'A', kind: 'file' }],
            events: [
                { id: 1, type: 'call', ts: 0, from: null, to: 'A', fn: 'fn', args: [], depth: 0 },
                { id: 2, type: 'return', ts: 1, of: 1, ok: true, result: null },
                { id: 3, type: 'return', ts: 2, of: 1, ok: true, result: null },
            ],
        };
        const tree = buildCallTree(file);
        expect(tree.children).toHaveLength(1);
        expect(tree.fn).toBe('__root__');
    });

    it('ignores io events without modifying the call tree', () => {
        const file: TraceFile = {
            version: 1,
            metadata: BASE_META,
            lifelines: [{ id: 'A', kind: 'file' }],
            events: [
                { id: 1, type: 'call', ts: 0, from: null, to: 'A', fn: 'fn', args: [], depth: 0 },
                { id: 2, type: 'io', ts: 1, from: 'A', to: 'B', method: 'read', meta: null },
                { id: 3, type: 'return', ts: 2, of: 1, ok: true, result: null },
            ],
        };
        const tree = buildCallTree(file);
        expect(tree.children).toHaveLength(1);
        expect(tree.children[0].fn).toBe('fn');
    });
});
