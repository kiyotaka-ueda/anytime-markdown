import type { TraceFileSource } from '../hooks/useTraceFile';

export interface TraceFilePickerProps {
    readonly traceFiles: readonly TraceFileSource[];
    readonly selectedName: string | null;
    readonly onSelect: (name: string) => void;
    readonly isDark: boolean;
}

export function TraceFilePicker({
    traceFiles,
    selectedName,
    onSelect,
    isDark,
}: Readonly<TraceFilePickerProps>) {
    const bg = isDark ? '#1a202c' : '#f7fafc';
    const border = isDark ? '#2d3748' : '#e2e8f0';
    const text = isDark ? '#e2e8f0' : '#1a202c';
    const selectedBg = isDark ? '#2d3748' : '#ebf8ff';
    const hoverBg = isDark ? '#2d3748' : '#edf2f7';

    if (traceFiles.length === 0) {
        return (
            <div
                style={{
                    padding: '16px',
                    color: isDark ? '#718096' : '#a0aec0',
                    fontSize: 13,
                    textAlign: 'center',
                }}
            >
                No trace files found in .vscode/trace/
            </div>
        );
    }

    return (
        <ul
            style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 4,
                overflow: 'hidden',
            }}
        >
            {traceFiles.map((f) => (
                <li
                    key={f.name}
                    role="option"
                    aria-selected={f.name === selectedName}
                    onClick={() => onSelect(f.name)}
                    style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: text,
                        background: f.name === selectedName ? selectedBg : bg,
                        cursor: 'pointer',
                        borderBottom: `1px solid ${border}`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                        if (f.name !== selectedName) {
                            (e.currentTarget as HTMLElement).style.background = hoverBg;
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (f.name !== selectedName) {
                            (e.currentTarget as HTMLElement).style.background = bg;
                        }
                    }}
                >
                    {f.name}
                </li>
            ))}
        </ul>
    );
}
