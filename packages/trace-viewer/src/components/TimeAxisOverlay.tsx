import type { TraceFile } from '@anytime-markdown/trace-core/types';

export interface TimeAxisOverlayProps {
    readonly file: TraceFile;
    readonly height: number;
    readonly headerHeight?: number;
    readonly stepHeight?: number;
    readonly isDark: boolean;
}

const AXIS_WIDTH = 36;

export function TimeAxisOverlay({
    file,
    height,
    headerHeight = 50,
    stepHeight = 36,
    isDark,
}: Readonly<TimeAxisOverlayProps>) {
    const events = file.events.filter(e => e.type === 'call');
    const color = isDark ? '#718096' : '#718096';
    const borderColor = isDark ? '#2d3748' : '#e2e8f0';

    return (
        <div
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: AXIS_WIDTH,
                height,
                pointerEvents: 'none',
                overflow: 'hidden',
                borderRight: `1px solid ${borderColor}`,
                fontSize: 9,
                color,
                fontFamily: 'monospace',
            }}
        >
            {events.map((ev, i) => {
                const y = headerHeight + i * stepHeight;
                const tsMs = ev.ts.toFixed(3);
                return (
                    <div
                        key={ev.id}
                        style={{
                            position: 'absolute',
                            top: y - 6,
                            right: 2,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {tsMs}
                    </div>
                );
            })}
        </div>
    );
}
