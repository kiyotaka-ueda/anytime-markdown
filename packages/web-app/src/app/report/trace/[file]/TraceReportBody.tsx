'use client';

import dynamic from 'next/dynamic';
import { useCallback } from 'react';

import { useThemeMode } from '../../../providers';

const TraceViewer = dynamic(
  () => import('@anytime-markdown/trace-viewer').then(m => ({ default: m.TraceViewer })),
  { ssr: false },
);

interface Props {
  readonly fileName: string;
}

export default function TraceReportBody({ fileName }: Readonly<Props>) {
  const { themeMode } = useThemeMode();
  const isDark = themeMode === 'dark';

  const traceFiles = [
    {
      name: fileName,
      load: useCallback(async () => {
        const res = await fetch(`/api/trace/file?name=${encodeURIComponent(fileName)}`);
        if (!res.ok) { throw new Error(`Failed to load trace: ${res.status}`); }
        return res.text();
      }, [fileName]),
    },
  ];

  return (
    <TraceViewer
      traceFiles={traceFiles}
      initialFile={fileName}
      isDark={isDark}
    />
  );
}
