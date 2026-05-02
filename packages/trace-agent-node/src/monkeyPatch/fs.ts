import { globalRecorder } from '../globalRecorder';
import type * as fsTypes from 'fs';

type ReadFileSyncFn = typeof fsTypes.readFileSync;
type WriteFileSyncFn = typeof fsTypes.writeFileSync;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fsModule = require('fs') as typeof fsTypes;

let origReadFileSync: ReadFileSyncFn | null = null;
let origWriteFileSync: WriteFileSyncFn | null = null;

export function patchFs(): void {
    if (origReadFileSync) return;
    origReadFileSync = fsModule.readFileSync;
    origWriteFileSync = fsModule.writeFileSync;

    Object.defineProperty(fsModule, 'readFileSync', {
        value: function patchedRead(...args: Parameters<ReadFileSyncFn>) {
            globalRecorder.io('__process__', 'L_fs', 'fs.readFileSync', { path: String(args[0]).slice(0, 200) });
            return (origReadFileSync as ReadFileSyncFn)(...args);
        },
        configurable: true,
        writable: true,
    });

    Object.defineProperty(fsModule, 'writeFileSync', {
        value: function patchedWrite(...args: Parameters<WriteFileSyncFn>) {
            globalRecorder.io('__process__', 'L_fs', 'fs.writeFileSync', { path: String(args[0]).slice(0, 200) });
            return (origWriteFileSync as WriteFileSyncFn)(...args);
        },
        configurable: true,
        writable: true,
    });
}

export function unpatchFs(): void {
    if (!origReadFileSync) return;
    Object.defineProperty(fsModule, 'readFileSync', {
        value: origReadFileSync,
        configurable: true,
        writable: true,
    });
    Object.defineProperty(fsModule, 'writeFileSync', {
        value: origWriteFileSync,
        configurable: true,
        writable: true,
    });
    origReadFileSync = null;
    origWriteFileSync = null;
}
