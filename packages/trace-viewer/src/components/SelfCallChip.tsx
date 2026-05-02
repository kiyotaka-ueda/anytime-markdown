export interface SelfCallChipProps {
    readonly label: string;
    readonly count?: number;
    readonly isDark: boolean;
}

export function SelfCallChip({ label, count, isDark }: Readonly<SelfCallChipProps>) {
    const bg = isDark ? '#2d3748' : '#edf2f7';
    const text = isDark ? '#a0aec0' : '#718096';
    const border = isDark ? '#4a5568' : '#cbd5e0';

    return (
        <span
            style={{
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: 3,
                fontSize: 10,
                fontFamily: 'monospace',
                background: bg,
                color: text,
                border: `1px solid ${border}`,
                verticalAlign: 'middle',
                lineHeight: '16px',
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}
        >
            {count !== undefined ? `+${count} ${label}` : label}
        </span>
    );
}
