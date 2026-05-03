import { instrumentCode } from '../astTransform';

describe('instrumentCode', () => {
    it('wraps a simple function declaration', () => {
        const src = `function foo(a) { return a + 1; }`;
        const out = instrumentCode(src, 'src/foo.js');
        expect(out).toContain('__traceEnter');
        expect(out).toContain('__traceExit');
        expect(out).toContain('__traceThrow');
    });

    it('wraps an arrow function expression in variable declaration', () => {
        const src = `const bar = (x) => x * 2;`;
        const out = instrumentCode(src, 'src/bar.js');
        expect(out).toContain('__traceEnter');
    });

    it('handles TypeScript syntax without throwing', () => {
        const src = `function greet(name: string): string { return 'hi ' + name; }`;
        const out = instrumentCode(src, 'src/greet.ts');
        // TypeScript stripping is done by ts-node/SWC upstream; instrumentCode preserves TS syntax
        expect(out).toContain('__traceEnter');
        expect(out).toContain('greet');
    });

    it('injects preamble require at the top', () => {
        const src = `function noop() {}`;
        const out = instrumentCode(src, 'src/noop.js');
        expect(out).toMatch(/require.*trace-agent-node.*runtime/);
    });

    it('does not throw on empty source', () => {
        expect(() => instrumentCode('', 'src/empty.js')).not.toThrow();
    });
});
