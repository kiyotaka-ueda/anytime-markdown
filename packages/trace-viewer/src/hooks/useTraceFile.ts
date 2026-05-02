import { useState, useEffect } from 'react';
import type { TraceFile } from '@anytime-markdown/trace-core/types';

export interface TraceFileSource {
    name: string;
    /** Load the raw JSON text of the trace file */
    load(): Promise<string>;
}

export type TraceFileState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'loaded'; file: TraceFile }
    | { status: 'error'; message: string };

export function useTraceFile(source: TraceFileSource | null): TraceFileState {
    const [state, setState] = useState<TraceFileState>({ status: 'idle' });

    useEffect(() => {
        if (!source) {
            setState({ status: 'idle' });
            return;
        }
        let cancelled = false;
        setState({ status: 'loading' });
        source.load().then((text) => {
            if (cancelled) return;
            try {
                const file = JSON.parse(text) as TraceFile;
                if (file.version !== 1) {
                    setState({ status: 'error', message: `Unsupported trace version: ${file.version}` });
                    return;
                }
                setState({ status: 'loaded', file });
            } catch (err) {
                setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
            }
        }).catch((err: unknown) => {
            if (cancelled) return;
            setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
        });
        return () => { cancelled = true; };
    }, [source]);

    return state;
}
