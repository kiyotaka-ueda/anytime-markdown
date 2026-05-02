import type { TraceFile, Lifeline } from '../types';

export function extractLifelines(file: TraceFile): Lifeline[] {
    const used = new Set<string>();
    for (const ev of file.events) {
        if (ev.type === 'call' || ev.type === 'io') {
            if (ev.from) used.add(ev.from);
            used.add(ev.to);
        }
    }
    return file.lifelines.filter(l => used.has(l.id));
}
