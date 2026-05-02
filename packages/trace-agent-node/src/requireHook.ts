import { addHook } from 'pirates';
import { instrumentCode } from './astTransform';
import * as path from 'path';

let revert: (() => void) | null = null;

export interface HookOptions {
    include: string[];
    exclude: string[];
}

export function installRequireHook(opts: HookOptions): void {
    if (revert) return;
    revert = addHook(
        (code, filename) => {
            try {
                if (shouldSkip(filename, opts)) return code;
                return instrumentCode(code, filename);
            } catch {
                return code;
            }
        },
        { exts: ['.js', '.ts', '.cjs', '.mjs'], ignoreNodeModules: false }
    );
}

export function uninstallRequireHook(): void {
    revert?.();
    revert = null;
}

function shouldSkip(filename: string, opts: HookOptions): boolean {
    const normalizedPath = path.resolve(filename);
    if (normalizedPath.includes(`${path.sep}node_modules${path.sep}`)) return true;
    if (normalizedPath.includes('trace-agent-node')) return true;
    if (opts.include.length > 0) {
        return !opts.include.some(inc => normalizedPath.startsWith(path.resolve(inc)));
    }
    return opts.exclude.some(exc => normalizedPath.startsWith(path.resolve(exc)));
}
