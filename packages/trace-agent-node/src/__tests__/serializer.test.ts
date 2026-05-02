import { safeSerialize } from '../serializer';

describe('safeSerialize', () => {
    it('passes through primitives unchanged', () => {
        expect(safeSerialize(42)).toBe(42);
        expect(safeSerialize('hello')).toBe('hello');
        expect(safeSerialize(null)).toBeNull();
        expect(safeSerialize(true)).toBe(true);
    });

    it('serializes plain objects', () => {
        expect(safeSerialize({ a: 1 })).toEqual({ a: 1 });
    });

    it('replaces circular references', () => {
        const obj: Record<string, unknown> = { x: 1 };
        obj['self'] = obj;
        const result = safeSerialize(obj) as Record<string, unknown>;
        expect(result['self']).toEqual({ $circular: true });
    });

    it('truncates strings longer than 1000 chars', () => {
        const long = 'a'.repeat(2000);
        const result = safeSerialize(long) as string;
        expect(result.length).toBeLessThan(2000);
        expect(result).toContain('$truncated');
    });

    it('truncates arrays longer than 20 elements', () => {
        const arr = Array.from({ length: 30 }, (_, i) => i);
        const result = safeSerialize(arr) as unknown[];
        expect(result.length).toBeLessThanOrEqual(21);
    });
});
