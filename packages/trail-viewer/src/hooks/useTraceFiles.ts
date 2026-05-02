import { useState, useEffect } from 'react';
import type { TraceFileSource } from '@anytime-markdown/trace-viewer';

export interface TraceFileListing {
    name: string;
    url: string;
}

/**
 * Fetches a list of trace files and converts them into TraceFileSource objects.
 * Pass a function that returns an array of {name, url} objects for each .vscode/trace/*.json file.
 */
export function useTraceFiles(
    fetchList: (() => Promise<readonly TraceFileListing[]>) | null,
): readonly TraceFileSource[] {
    const [sources, setSources] = useState<readonly TraceFileSource[]>([]);

    useEffect(() => {
        if (!fetchList) {
            setSources([]);
            return;
        }
        let cancelled = false;
        fetchList().then((listings) => {
            if (cancelled) return;
            setSources(
                listings.map((listing): TraceFileSource => ({
                    name: listing.name,
                    load: async () => {
                        const res = await fetch(listing.url);
                        if (!res.ok) throw new Error(`Failed to fetch ${listing.url}: ${res.status}`);
                        return res.text();
                    },
                })),
            );
        }).catch((err: unknown) => {
            if (cancelled) return;
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[useTraceFiles] Failed to fetch trace file list: ${msg}`, err);
        });
        return () => { cancelled = true; };
    }, [fetchList]);

    return sources;
}
