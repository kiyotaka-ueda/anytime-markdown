import * as path from 'path';
import type { HookOptions } from './requireHook';

// import-in-the-middle は CJS 環境では動的 require で読み込む
// ESM hook は Node.js の --loader フラグが必要なためスタブとして実装する
let hook: { unhook: () => void } | null = null;

export function installEsmHook(opts: HookOptions): void {
    if (hook) return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const IitM = require('import-in-the-middle') as { new(cb: (exports: unknown, name: string) => void): { unhook: () => void } };
        hook = new IitM((_exports, name) => {
            if (name.includes('node_modules') || name.includes('trace-agent-node')) return;
            if (opts.include.length > 0 && !opts.include.some(inc => name.startsWith(path.resolve(inc)))) return;
        });
    } catch {
        // import-in-the-middle が利用できない環境ではスキップ
    }
}

export function uninstallEsmHook(): void {
    hook?.unhook();
    hook = null;
}
