import { useState, useRef, useEffect, useCallback } from 'react';
import type { SourceLocation } from '@anytime-markdown/trace-core/types';
import type { TraceFileSource } from '../hooks/useTraceFile';
import { useTraceFile } from '../hooks/useTraceFile';
import { useLayoutResult } from '../hooks/useLayoutResult';
import { SequenceCanvas } from './SequenceCanvas';
import { TraceFilePicker } from './TraceFilePicker';

export interface TraceViewerProps {
    readonly traceFiles: readonly TraceFileSource[];
    readonly initialFile?: string;
    readonly isDark?: boolean;
    onJumpToSource?: (loc: SourceLocation) => void;
}

const PICKER_WIDTH = 220;
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 600;

export function TraceViewer({
    traceFiles,
    initialFile,
    isDark = true,
    onJumpToSource,
}: Readonly<TraceViewerProps>) {
    const [selectedName, setSelectedName] = useState<string | null>(
        initialFile ?? traceFiles[0]?.name ?? null,
    );

    const selectedSource = traceFiles.find(f => f.name === selectedName) ?? null;
    const fileState = useTraceFile(selectedSource);
    const file = fileState.status === 'loaded' ? fileState.file : null;
    const layout = useLayoutResult(file, { isDark });

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT });

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setCanvasSize({ width: Math.max(width - PICKER_WIDTH, 200), height: Math.max(height, 200) });
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const bg = isDark ? '#171923' : '#ffffff';
    const border = isDark ? '#2d3748' : '#e2e8f0';
    const text = isDark ? '#e2e8f0' : '#1a202c';

    return (
        <div
            ref={containerRef}
            style={{
                display: 'flex',
                flexDirection: 'row',
                width: '100%',
                height: '100%',
                background: bg,
                overflow: 'hidden',
                fontFamily: 'sans-serif',
            }}
        >
            {/* Sidebar: file picker */}
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

            {/* Main: canvas area */}
            <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                {fileState.status === 'idle' && (
                    <EmptyState isDark={isDark} message="Select a trace file to view" />
                )}
                {fileState.status === 'loading' && (
                    <EmptyState isDark={isDark} message="Loading..." />
                )}
                {fileState.status === 'error' && (
                    <EmptyState isDark={isDark} message={`Error: ${fileState.message}`} isError />
                )}
                {fileState.status === 'loaded' && layout && (
                    <SequenceCanvas
                        layout={layout}
                        isDark={isDark}
                        width={Math.max(layout.width, canvasSize.width)}
                        height={Math.max(layout.height, canvasSize.height)}
                        onJumpToSource={onJumpToSource}
                    />
                )}
            </div>
        </div>
    );
}

function EmptyState({
    isDark,
    message,
    isError,
}: Readonly<{ isDark: boolean; message: string; isError?: boolean }>) {
    const color = isError ? (isDark ? '#fc8181' : '#e53e3e') : (isDark ? '#718096' : '#a0aec0');
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
