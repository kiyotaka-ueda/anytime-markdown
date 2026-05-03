import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { patchFs, unpatchFs } from '../monkeyPatch/fs';
import { globalRecorder } from '../globalRecorder';

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-fs-'));
    globalRecorder.reset();
});

afterEach(() => {
    unpatchFs();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('patchFs', () => {
    it('wraps fs.readFileSync and records io', () => {
        const file = path.join(tmpDir, 'test.txt');
        fs.writeFileSync(file, 'hello');
        patchFs();
        fs.readFileSync(file, 'utf-8');
        const ioEntries = globalRecorder.entries().filter(e => e.type === 'io');
        expect(ioEntries.length).toBeGreaterThan(0);
        expect(ioEntries[0].method).toBe('fs.readFileSync');
    });

    it('restores original after unpatch', () => {
        const original = fs.readFileSync;
        patchFs();
        unpatchFs();
        expect(fs.readFileSync).toBe(original);
    });
});
