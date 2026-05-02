import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Flusher } from '../flusher';
import { Recorder } from '../recorder';

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-flusher-'));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Flusher', () => {
    it('writes a valid TraceFile JSON to disk', () => {
        const rec = new Recorder({ depthLimit: 8 });
        rec.enter('L0', null, 'foo', [1], 0);
        rec.exit(1, 42);

        const flusher = new Flusher({
            outputDir: tmpDir,
            runName: 'test-run',
            recorder: rec,
            lifelineMap: new Map([['src/foo.ts', 'L0']]),
            startedAt: '2026-05-02T09:00:00.000Z',
        });

        flusher.flush();

        const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.json'));
        expect(files).toHaveLength(1);

        const content = JSON.parse(fs.readFileSync(path.join(tmpDir, files[0]), 'utf-8'));
        expect(content.version).toBe(1);
        expect(content.events.length).toBe(2);
    });
});
