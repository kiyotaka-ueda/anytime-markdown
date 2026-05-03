import { useState, useRef, useEffect, useMemo } from 'react';
import type { SourceLocation } from '@anytime-markdown/trace-core/types';
import type { SequenceModel } from '@anytime-markdown/trace-core/c4Sequence';
import type { TraceFileSource } from '../hooks/useTraceFile';
import { useTraceFile } from '../hooks/useTraceFile';
import { useLayoutResult } from '../hooks/useLayoutResult';
import { SequenceCanvas } from './SequenceCanvas';
import { TraceFilePicker } from './TraceFilePicker';
import { buildC4SequenceLayout } from '../engine/c4SequenceLayout';

export interface TraceViewerProps {
    readonly traceFiles: readonly TraceFileSource[];
    readonly initialFile?: string;
    readonly isDark?: boolean;
    onJumpToSource?: (loc: SourceLocation) => void;
    /** C4 シーケンス表示用モデル。null/undefined のとき "C4 Sequence" タブはプレースホルダ。 */
    readonly c4Sequence?: SequenceModel | null;
}

type SubTab = 'files' | 'sequence';

const PICKER_WIDTH = 220;
const SUBTAB_HEIGHT = 32;
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 600;

export function TraceViewer({
    traceFiles,
    initialFile,
    isDark = true,
    onJumpToSource,
    c4Sequence,
}: Readonly<TraceViewerProps>) {
    const [selectedName, setSelectedName] = useState<string | null>(
        initialFile ?? traceFiles[0]?.name ?? null,
    );

    const showSubTabs = c4Sequence != null || traceFiles.length > 0;
    const [subTab, setSubTab] = useState<SubTab>(c4Sequence ? 'sequence' : 'files');

    // c4Sequence が新規付与されたら自動で sequence タブへ
    const c4Available = c4Sequence != null;
    useEffect(() => {
        if (c4Available) setSubTab('sequence');
    }, [c4Available, c4Sequence?.rootElementId]);

    const selectedSource = traceFiles.find((f) => f.name === selectedName) ?? null;
    const fileState = useTraceFile(selectedSource);
    const file = fileState.status === 'loaded' ? fileState.file : null;
    const layout = useLayoutResult(file, { isDark });

    const c4Layout = useMemo(
        () => (c4Sequence ? buildC4SequenceLayout(c4Sequence, { isDark }) : null),
        [c4Sequence, isDark],
    );

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT });

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const sidebarOffset = subTab === 'files' ? PICKER_WIDTH : 0;
                setCanvasSize({
                    width: Math.max(width - sidebarOffset, 200),
                    height: Math.max(height - (showSubTabs ? SUBTAB_HEIGHT : 0), 200),
                });
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [subTab, showSubTabs]);

    const bg = isDark ? '#171923' : '#ffffff';
    const border = isDark ? '#2d3748' : '#e2e8f0';
    const text = isDark ? '#e2e8f0' : '#1a202c';
    const subTabBg = isDark ? '#1a202c' : '#f7fafc';
    const subTabActiveBg = isDark ? '#2d3748' : '#ffffff';
    const subTabBorder = isDark ? '#2d3748' : '#cbd5e0';

    return (
        <div
            ref={containerRef}
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                background: bg,
                overflow: 'hidden',
                fontFamily: 'sans-serif',
            }}
        >
            {showSubTabs && (
                <div
                    role="tablist"
                    aria-label="Trace view modes"
                    style={{
                        display: 'flex',
                        height: SUBTAB_HEIGHT,
                        borderBottom: `1px solid ${subTabBorder}`,
                        background: subTabBg,
                        flexShrink: 0,
                    }}
                >
                    <SubTabButton
                        label="Trace Files"
                        active={subTab === 'files'}
                        disabled={traceFiles.length === 0}
                        onClick={() => setSubTab('files')}
                        text={text}
                        activeBg={subTabActiveBg}
                    />
                    <SubTabButton
                        label="C4 Sequence"
                        active={subTab === 'sequence'}
                        disabled={false}
                        onClick={() => setSubTab('sequence')}
                        text={text}
                        activeBg={subTabActiveBg}
                    />
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden' }}>
                {subTab === 'files' && traceFiles.length > 0 && (
                    <div
                        style={{
                            width: PICKER_WIDTH,
                            minWidth: PICKER_WIDTH,
                            borderRight: `1px solid ${border}`,
                            overflowY: 'auto',
                            padding: 8,
                            boxSizing: 'border-box',
                            flexShrink: 0,
                        }}
                    >
                        <div style={{ fontSize: 11, fontWeight: 700, color: text, marginBottom: 6, letterSpacing: 1 }}>
                            TRACE FILES
                        </div>
                        <TraceFilePicker
                            traceFiles={traceFiles}
                            selectedName={selectedName}
                            onSelect={setSelectedName}
                            isDark={isDark}
                        />
                    </div>
                )}

                <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                    {subTab === 'files' && renderFilesPane(fileState, layout, canvasSize, isDark, onJumpToSource)}
                    {subTab === 'sequence' && renderSequencePane(c4Layout, canvasSize, isDark)}
                </div>
            </div>
        </div>
    );
}

function renderFilesPane(
    fileState: ReturnType<typeof useTraceFile>,
    layout: ReturnType<typeof useLayoutResult>,
    canvasSize: { width: number; height: number },
    isDark: boolean,
    onJumpToSource?: (loc: SourceLocation) => void,
) {
    if (fileState.status === 'idle') {
        return <EmptyState isDark={isDark} message="Select a trace file to view" />;
    }
    if (fileState.status === 'loading') {
        return <EmptyState isDark={isDark} message="Loading..." />;
    }
    if (fileState.status === 'error') {
        return <EmptyState isDark={isDark} message={`Error: ${fileState.message}`} isError />;
    }
    if (fileState.status === 'loaded' && layout) {
        return (
            <SequenceCanvas
                layout={layout}
                isDark={isDark}
                width={Math.max(layout.width, canvasSize.width)}
                height={Math.max(layout.height, canvasSize.height)}
                onJumpToSource={onJumpToSource}
            />
        );
    }
    return null;
}

function renderSequencePane(
    layout: ReturnType<typeof buildC4SequenceLayout> | null,
    canvasSize: { width: number; height: number },
    isDark: boolean,
) {
    if (!layout) {
        return (
            <EmptyState
                isDark={isDark}
                message="L3 component を右クリック → 「シーケンス表示」を選択してください"
            />
        );
    }
    if (layout.nodes.filter((n) => n.metadata?.['role'] === 'header').length === 0) {
        return <EmptyState isDark={isDark} message="関連要素が見つかりません" />;
    }
    return (
        <SequenceCanvas
            layout={layout}
            isDark={isDark}
            width={Math.max(layout.width, canvasSize.width)}
            height={Math.max(layout.height, canvasSize.height)}
        />
    );
}

function SubTabButton({
    label,
    active,
    disabled,
    onClick,
    text,
    activeBg,
}: Readonly<{
    label: string;
    active: boolean;
    disabled: boolean;
    onClick: () => void;
    text: string;
    activeBg: string;
}>) {
    return (
        <button
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={onClick}
            style={{
                padding: '0 16px',
                height: '100%',
                fontSize: 12,
                fontWeight: 600,
                background: active ? activeBg : 'transparent',
                border: 'none',
                borderBottom: active ? `2px solid ${text}` : '2px solid transparent',
                color: disabled ? '#718096' : text,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: disabled ? 0.5 : 1,
            }}
        >
            {label}
        </button>
    );
}

function EmptyState({
    isDark,
    message,
    isError,
}: Readonly<{ isDark: boolean; message: string; isError?: boolean }>) {
    const darkColor = isError ? '#fc8181' : '#718096';
    const lightColor = isError ? '#e53e3e' : '#a0aec0';
    const color = isDark ? darkColor : lightColor;
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: 200,
                fontSize: 13,
                color,
            }}
        >
            {message}
        </div>
    );
}
