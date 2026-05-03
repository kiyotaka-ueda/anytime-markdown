export type JsonValue =
    | null
    | boolean
    | number
    | string
    | JsonValue[]
    | { [k: string]: JsonValue };

export interface SourceLocation {
    file: string;
    line: number;
    column?: number;
}

export interface TraceMetadata {
    startedAt: string;
    endedAt: string;
    command: string;
    cwd: string;
    nodeVersion: string;
    depthLimit: number;
}

export interface Lifeline {
    id: string;
    kind: 'file' | 'io';
    path?: string;
    label?: string;
}

export type TraceEvent =
    | { id: number; type: 'call'; ts: number; from: string | null; to: string; fn: string; args: JsonValue[]; depth: number; loc?: SourceLocation }
    | { id: number; type: 'return'; ts: number; of: number; ok: true; result: JsonValue }
    | { id: number; type: 'throw'; ts: number; of: number; ok: false; error: { name: string; message: string; stack?: string } }
    | { id: number; type: 'io'; ts: number; from: string; to: string; method: string; meta: JsonValue };

export interface TraceFile {
    version: 1;
    metadata: TraceMetadata;
    lifelines: Lifeline[];
    events: TraceEvent[];
}
