import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { installRequireHook, uninstallRequireHook } from '../requireHook';

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-hook-'));
});

afterEach(() => {
    uninstallRequireHook();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    Object.keys(require.cache).filter(k => k.startsWith(tmpDir)).forEach(k => { delete require.cache[k]; });
});

describe('requireHook', () => {
    it('transforms required JS files (function is callable after instrumentation)', () => {
        const file = path.join(tmpDir, 'sample.js');
        fs.writeFileSync(file, `module.exports = function add(a, b) { return a + b; };`);
        installRequireHook({ include: [tmpDir], exclude: [] });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const add = require(file) as (a: number, b: number) => number;
        expect(typeof add).toBe('function');
    });

    it('does not transform files outside include paths', () => {
        const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-outside-'));
        try {
            const file = path.join(outsideDir, 'outside.js');
            fs.writeFileSync(file, `module.exports = 99;`);
            installRequireHook({ include: [tmpDir], exclude: [] });
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const result = require(file);
            expect(result).toBe(99);
        } finally {
            fs.rmSync(outsideDir, { recursive: true, force: true });
            Object.keys(require.cache).filter(k => k.includes('trace-outside-')).forEach(k => { delete require.cache[k]; });
        }
    });
});
