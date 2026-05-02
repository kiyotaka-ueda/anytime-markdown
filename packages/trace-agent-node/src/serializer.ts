import type { JsonValue } from '@anytime-markdown/trace-core/types';

const MAX_STRING = 1000;
const MAX_ARRAY = 20;
const MAX_DEPTH = 5;

export function safeSerialize(value: unknown, seen = new WeakSet<object>(), depth = 0): JsonValue {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') {
        if (value.length > MAX_STRING) return value.slice(0, MAX_STRING) + '...$truncated';
        return value;
    }
    if (typeof value === 'function') return { $fn: value.name || 'anonymous' };
    if (typeof value !== 'object') return String(value);
    if (depth >= MAX_DEPTH) return { $truncated: true, preview: String(value).slice(0, 50) };
    const obj = value as object;
    if (seen.has(obj)) return { $circular: true };
    seen.add(obj);
    if (Array.isArray(obj)) {
        const arr = obj.slice(0, MAX_ARRAY).map(el => safeSerialize(el, seen, depth + 1));
        if (obj.length > MAX_ARRAY) arr.push({ $truncated: true, total: obj.length });
        return arr;
    }
    const result: { [k: string]: JsonValue } = {};
    for (const key of Object.keys(obj).slice(0, 20)) {
        result[key] = safeSerialize((obj as Record<string, unknown>)[key], seen, depth + 1);
    }
    return result;
}
