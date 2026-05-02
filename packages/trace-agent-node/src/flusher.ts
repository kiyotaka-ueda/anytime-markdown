import * as fs from 'fs';
import * as path from 'path';
import type { Recorder } from './recorder';
import type { TraceFile } from '@anytime-markdown/trace-core';
import { safeSerialize } from './serializer';
import type { JsonValue } from '@anytime-markdown/trace-core';

interface FlusherOptions {
    outputDir: string;
    runName: string;
    recorder: Recorder;
    lifelineMap: Map<string, string>;
    startedAt: string;
}

export class Flusher {
    private readonly opts: FlusherOptions;

    constructor(opts: FlusherOptions) {
        this.opts = opts;
    }

    flush(): void {
        const { outputDir, runName, recorder, lifelineMap, startedAt } = this.opts;
        fs.mkdirSync(outputDir, { recursive: true });

        const endedAt = new Date().toISOString();
        const safeName = runName.replaceAll(/[^a-z0-9-_]/gi, '-');
        const timestamp = endedAt.replaceAll(/[:.]/g, '-');
        const filename = path.join(outputDir, `${timestamp}-${safeName}.json`);

        const lifelines = Array.from(lifelineMap.entries()).map(([filePath, id]) => ({
            id, kind: 'file' as const, path: filePath,
        }));

        const events: TraceFile['events'] = recorder.entries().map(entry => {
            if (entry.type === 'call') {
                return {
                    id: entry.id, type: 'call', ts: entry.ts,
                    from: entry.fromLifelineId ?? null,
                    to: entry.lifelineId!,
                    fn: entry.fn!, args: (entry.args ?? []).map(a => safeSerialize(a)) as JsonValue[],
                    depth: entry.depth ?? 0,
                };
            }
            if (entry.type === 'return') {
                return {
                    id: entry.id, type: 'return', ts: entry.ts,
                    of: entry.ofId!, ok: true as const,
                    result: safeSerialize(entry.result) as JsonValue,
                };
            }
            if (entry.type === 'throw') {
                return {
                    id: entry.id, type: 'throw', ts: entry.ts,
                    of: entry.ofId!, ok: false as const,
                    error: entry.error!,
                };
            }
            return {
                id: entry.id, type: 'io', ts: entry.ts,
                from: entry.fromLifelineId ?? '__process__',
                to: entry.lifelineId ?? 'L_io',
                method: entry.method ?? 'unknown',
                meta: safeSerialize(entry.meta) as JsonValue,
            };
        });

        const traceFile: TraceFile = {
            version: 1,
            metadata: {
                startedAt,
                endedAt,
                command: process.argv.join(' '),
                cwd: process.cwd(),
                nodeVersion: process.version,
                depthLimit: 8,
            },
            lifelines,
            events,
        };

        fs.writeFileSync(filename, JSON.stringify(traceFile, null, 2), 'utf-8');
    }
}
