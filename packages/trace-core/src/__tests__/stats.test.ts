import { computeStats } from '../analyze/stats';
import { buildCallTree } from '../parse/callTree';
import type { TraceFile } from '../types';
import * as fs from 'fs';
import * as path from 'path';

function loadFixture(name: string): TraceFile {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8'));
}

describe('computeStats', () => {
    it('counts calls per function', () => {
        const file = loadFixture('deep-stack.json');
        const tree = buildCallTree(file);
        const stats = computeStats(tree);
        expect(stats.callsByFn.get('f')).toBe(10);
    });

    it('counts errors', () => {
        const file = loadFixture('with-error.json');
        const tree = buildCallTree(file);
        const stats = computeStats(tree);
        expect(stats.errorCount).toBe(1);
    });
});
