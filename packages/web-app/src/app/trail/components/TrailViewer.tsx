'use client';

import { useCallback, useState } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { TrailViewerCore, useTrailDataSource } from '@anytime-markdown/trail-viewer';
import type { TrailFilter, SupabaseConfig } from '@anytime-markdown/trail-viewer';

import { useThemeMode } from '../../providers';
import { useLocaleSwitch } from '../../LocaleProvider';
import { TrailErrorBoundary } from './TrailErrorBoundary';

const EMPTY_FILTER: TrailFilter = {};

export function TrailViewer() {
  const { themeMode } = useThemeMode();
  const isDark = themeMode === 'dark';
  const { locale } = useLocaleSwitch();

  const supabaseConfig: SupabaseConfig | undefined =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        }
      : undefined;

  const dataSource = useTrailDataSource(undefined, supabaseConfig);

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
      />
    </TrailErrorBoundary>
  );
}
