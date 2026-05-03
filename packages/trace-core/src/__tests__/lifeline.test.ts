import { extractLifelines } from '../analyze/lifeline';
import type { TraceFile } from '../types';
import * as fs from 'fs';
import * as path from 'path';

function loadFixture(name: string): TraceFile {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8'));
}

describe('extractLifelines', () => {
    it('returns lifelines used in events', () => {
        const file = loadFixture('simple.json');
        const lifelines = extractLifelines(file);
        expect(lifelines.map(l => l.id).sort()).toEqual(['L0', 'L1']);
    });

    it('omits lifelines that are declared but unused', () => {
        const file: TraceFile = {
            ...loadFixture('simple.json'),
            lifelines: [
                { id: 'L0', kind: 'file', path: 'src/foo.ts' },
                { id: 'L1', kind: 'file', path: 'src/bar.ts' },
                { id: 'L9', kind: 'file', path: 'src/unused.ts' },
            ],
        };
        const lifelines = extractLifelines(file);
        expect(lifelines.map(l => l.id)).not.toContain('L9');
    });
});
