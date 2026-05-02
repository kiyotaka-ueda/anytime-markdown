import { globalRecorder } from './globalRecorder';
import { safeSerialize } from './serializer';
import type { JsonValue } from '@anytime-markdown/trace-core/types';

const lifelineMap = new Map<string, string>();
let lifelineCounter = 0;

export function __traceEnter(
    file: string, fn: string, args: unknown[], _depth: number, _line: number
): number {
    return globalRecorder.enter(
        fileToLifelineId(file),
        null,
        fn,
        args.map(a => safeSerialize(a) as unknown),
        _depth
    );
}

export function __traceExit(id: number, result: unknown): void {
    globalRecorder.exit(id, safeSerialize(result) as JsonValue);
}

export function __traceThrow(id: number, err: unknown): void {
    globalRecorder.throw(id, err);
}

export function fileToLifelineId(file: string): string {
    if (!lifelineMap.has(file)) {
        lifelineMap.set(file, `L${lifelineCounter++}`);
    }
    return lifelineMap.get(file)!;
}

export function getLifelineMap(): Map<string, string> {
    return lifelineMap;
}

export function resetLifelineMap(): void {
    lifelineMap.clear();
    lifelineCounter = 0;
}
