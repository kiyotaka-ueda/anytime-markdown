export interface LifelineHeaderStickyProps {
    readonly lifelineLabels: readonly { id: string; label: string; x: number }[];
    readonly headerHeight?: number;
    readonly isDark: boolean;
}

export function LifelineHeaderSticky({
    lifelineLabels,
    headerHeight = 50,
    isDark,
}: Readonly<LifelineHeaderStickyProps>) {
    const bg = isDark ? '#1a202c' : '#f7fafc';
    const text = isDark ? '#e2e8f0' : '#1a202c';
    const border = isDark ? '#2d3748' : '#e2e8f0';

    return (
        <div
            style={{
                position: 'sticky',
                top: 0,
                height: headerHeight,
                zIndex: 10,
                background: bg,
                borderBottom: `1px solid ${border}`,
                pointerEvents: 'none',
            }}
        >
            {lifelineLabels.map(({ id, label, x }) => (
                <div
                    key={id}
                    style={{
                        position: 'absolute',
                        left: x - 80,
                        width: 160,
                        height: headerHeight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: text,
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        padding: '0 4px',
                        boxSizing: 'border-box',
                    }}
                >
                    {label}
                </div>
            ))}
        </div>
    );
}
