import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { loadTraceFile } from '../parse/loader';

const FIXTURES = path.join(__dirname, 'fixtures');

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-core-test-'));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadTraceFile', () => {
    it('loads a valid trace file from disk', async () => {
        const file = await loadTraceFile(path.join(FIXTURES, 'simple.json'));
        expect(file.version).toBe(1);
        expect(file.lifelines).toHaveLength(2);
        expect(file.events).toHaveLength(4);
    });

    it('rejects unsupported version', async () => {
        const tmp = path.join(tmpDir, 'v2.json');
        fs.writeFileSync(tmp, JSON.stringify({ version: 2, metadata: {}, lifelines: [], events: [] }));
        await expect(loadTraceFile(tmp)).rejects.toThrow(/version/i);
    });

    it('rejects malformed JSON', async () => {
        const tmp = path.join(tmpDir, 'bad.json');
        fs.writeFileSync(tmp, '{not json');
        await expect(loadTraceFile(tmp)).rejects.toThrow();
    });

    it('rejects when required metadata fields missing', async () => {
        const tmp = path.join(tmpDir, 'meta.json');
        fs.writeFileSync(tmp, JSON.stringify({ version: 1, metadata: {}, lifelines: [], events: [] }));
        await expect(loadTraceFile(tmp)).rejects.toThrow(/metadata/i);
    });
});
