import * as http from 'http';
import * as https from 'https';
import { globalRecorder } from '../globalRecorder';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

let originalHttpRequest: AnyFn | null = null;
let originalHttpsRequest: AnyFn | null = null;
let patched = false;

function tryDefine(mod: typeof http | typeof https, fn: AnyFn): boolean {
    const desc = Object.getOwnPropertyDescriptor(mod, 'request');
    if (desc && !desc.configurable && !desc.writable) return false;
    try {
        Object.defineProperty(mod, 'request', { value: fn, configurable: true, writable: true });
        return true;
    } catch {
        return false;
    }
}

export function patchHttp(): boolean {
    if (patched) return true;
    originalHttpRequest = http.request as AnyFn;
    originalHttpsRequest = https.request as AnyFn;

    const httpOk = tryDefine(http, function patchedHttpRequest(...args: unknown[]) {
        const url = typeof args[0] === 'string' ? args[0] : String(args[0]);
        globalRecorder.io('__process__', 'L_http', 'http.request', { url });
        return (originalHttpRequest as AnyFn)(...args);
    });

    const httpsOk = tryDefine(https, function patchedHttpsRequest(...args: unknown[]) {
        const url = typeof args[0] === 'string' ? args[0] : String(args[0]);
        globalRecorder.io('__process__', 'L_https', 'https.request', { url });
        return (originalHttpsRequest as AnyFn)(...args);
    });

    patched = httpOk || httpsOk;
    return patched;
}

export function unpatchHttp(): void {
    if (!originalHttpRequest) return;
    tryDefine(http, originalHttpRequest);
    tryDefine(https, originalHttpsRequest!);
    originalHttpRequest = null;
    originalHttpsRequest = null;
    patched = false;
}

export function isHttpPatched(): boolean {
    return patched;
}
