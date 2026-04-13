'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { TrailViewerCore, useTrailDataSource } from '@anytime-markdown/trail-viewer';
import type { TrailFilter } from '@anytime-markdown/trail-viewer';

import { useThemeMode } from '../../providers';
import { useLocaleSwitch } from '../../LocaleProvider';
import type { C4Model, BoundaryInfo, C4ReleaseEntry, FeatureMatrix } from '@anytime-markdown/trail-core/c4';

const CURRENT_RELEASE_TAG = 'current';

import { TrailErrorBoundary } from './TrailErrorBoundary';

interface C4Payload {
  model: C4Model;
  boundaries: readonly BoundaryInfo[];
  featureMatrix?: FeatureMatrix;
}

const EMPTY_FILTER: TrailFilter = {};

/**
 * web アプリの Trail ビュワー。
 *
 * 拡張機能と同様に useTrailDataSource('') を使用し、同居する Next.js API route
 * (/api/trail/...) から HTTP 経由でデータを取得する。Supabase 直接接続は廃止し、
 * 全ルートがサーバ側 SupabaseTrailReader を経由する単一経路に統一した。
 */
export function TrailViewer() {
  const { themeMode } = useThemeMode();
  const isDark = themeMode === 'dark';
  const { locale } = useLocaleSwitch();

  const dataSource = useTrailDataSource('');

  const [filter, setFilter] = useState<TrailFilter>(EMPTY_FILTER);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();

  const handleSelectSession = useCallback(
    (id: string) => {
      setSelectedSessionId(id);
      dataSource.loadSession(id);
    },
    [dataSource],
  );

  const handleFilterChange = useCallback(
    (newFilter: TrailFilter) => {
      setFilter(newFilter);
      dataSource.searchSessions(newFilter);
    },
    [dataSource],
  );

  const [c4Payload, setC4Payload] = useState<C4Payload | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<string>(CURRENT_RELEASE_TAG);

  const c4ReleaseEntries: readonly C4ReleaseEntry[] = useMemo(() => {
    return [
      { tag: CURRENT_RELEASE_TAG, repoName: null },
      ...dataSource.releases.map((r) => ({ tag: r.tag, repoName: r.repoName })),
    ];
  }, [dataSource.releases]);

  useEffect(() => {
    let cancelled = false;
    async function fetchC4(): Promise<void> {
      try {
        const res = await fetch(`/api/c4/model?release=${encodeURIComponent(selectedRelease)}`);
        if (!res.ok) return;
        const data = (await res.json()) as C4Payload;
        if (!cancelled && data?.model?.elements) {
          setC4Payload(data);
        }
      } catch { /* C4 unavailable — tab hidden */ }
    }
    void fetchC4();
    return () => { cancelled = true; };
  }, [selectedRelease]);

  if (dataSource.loading && dataSource.sessions.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 64px)',
          bgcolor: isDark ? '#0D1117' : '#FAFAFA',
        }}
      >
        <CircularProgress sx={{ color: isDark ? '#90CAF9' : '#1976D2' }} />
      </Box>
    );
  }

  return (
    <TrailErrorBoundary>
      <TrailViewerCore
        locale={locale}
        isDark={isDark}
        sessions={dataSource.sessions}
        allSessions={dataSource.allSessions}
        selectedSessionId={selectedSessionId}
        messages={dataSource.messages}
        filter={filter}
        onSelectSession={handleSelectSession}
        onFilterChange={handleFilterChange}
        analytics={dataSource.analytics}
        costOptimization={dataSource.costOptimization}
        releases={dataSource.releases}
        fetchSessionMessages={dataSource.fetchSessionMessages}
        fetchSessionCommits={dataSource.fetchSessionCommits}
        fetchSessionToolMetrics={dataSource.fetchSessionToolMetrics}
        c4={c4Payload ? {
          c4Model: c4Payload.model,
          boundaries: c4Payload.boundaries,
          featureMatrix: c4Payload.featureMatrix ?? null,
          coverageMatrix: null,
          coverageDiff: null,
          releases: c4ReleaseEntries,
          selectedRelease,
          onReleaseSelect: setSelectedRelease,
        } : undefined}
      />
    </TrailErrorBoundary>
  );
}
