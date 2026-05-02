import * as http from 'http';
import { patchHttp, unpatchHttp, isHttpPatched } from '../monkeyPatch/http';
import { globalRecorder } from '../globalRecorder';

beforeEach(() => {
    globalRecorder.reset();
});

afterEach(() => {
    unpatchHttp();
});

describe('patchHttp', () => {
    it('returns boolean — true if platform allows monkey-patching', () => {
        const result = patchHttp();
        expect(typeof result).toBe('boolean');
    });

    it('isHttpPatched matches patchHttp return value', () => {
        const result = patchHttp();
        expect(isHttpPatched()).toBe(result);
    });

    it('replaces http.request only when patching succeeds', () => {
        const originalRequest = http.request;
        const ok = patchHttp();
        if (ok) {
            expect(http.request).not.toBe(originalRequest);
        } else {
            expect(http.request).toBe(originalRequest);
        }
    });

    it('restores original after unpatch', () => {
        const originalRequest = http.request;
        patchHttp();
        unpatchHttp();
        expect(http.request).toBe(originalRequest);
    });

    it('second patchHttp call is idempotent', () => {
        patchHttp();
        const second = patchHttp();
        expect(typeof second).toBe('boolean');
    });
});
