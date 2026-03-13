'use client';

import { Box, CircularProgress } from '@mui/material';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';

import { FallbackFileSystemProvider } from '../../lib/FallbackFileSystemProvider';
import { GitHubTimelineProvider } from '../../lib/GitHubTimelineProvider';
import { WebFileSystemProvider } from '../../lib/WebFileSystemProvider';
import { useLocaleSwitch } from '../LocaleProvider';
import { useThemeMode } from '../providers';

function EditorLoading() {
  const t = useTranslations('Common');
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress aria-label={t('loadingEditor')} />
    </Box>
  );
}

const MarkdownEditorPage = dynamic(
  () => import('@anytime-markdown/editor-core/src/MarkdownEditorPage'),
  { ssr: false, loading: () => <EditorLoading /> },
);

const GitHubRepoBrowser = dynamic(
  () => import('../../components/GitHubRepoBrowser').then((m) => ({ default: m.GitHubRepoBrowser })),
  { ssr: false },
);

const ExplorerPanel = dynamic(
  () => import('../../components/ExplorerPanel').then((m) => ({ default: m.ExplorerPanel })),
  { ssr: false },
);

async function fetchFileContent(repo: string, filePath: string): Promise<string> {
  const res = await fetch(
    `/api/github/content?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(filePath)}&ref=HEAD`,
  );
  if (!res.ok) return '';
  const data = await res.json();
  return data.content ?? '';
}

export default function Page() {
  const { themeMode, setThemeMode } = useThemeMode();
  const { setLocale } = useLocaleSwitch();
  const [repoBrowserOpen, setRepoBrowserOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [timelineProvider, setTimelineProvider] = useState<GitHubTimelineProvider | null>(null);
  const [externalContent, setExternalContent] = useState<string | undefined>(undefined);
  const [editorKey, setEditorKey] = useState(0);
  const selectedFileRef = useRef<{ repo: string; filePath: string } | null>(null);

  const fileSystemProvider = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const web = new WebFileSystemProvider();
    return web.supportsDirectAccess ? web : new FallbackFileSystemProvider();
  }, []);

  const handleRequestTimeline = useCallback(() => {
    setRepoBrowserOpen(true);
  }, []);

  const handleRepoSelect = useCallback((repo: string, filePath: string) => {
    selectedFileRef.current = { repo, filePath };
    setTimelineProvider(new GitHubTimelineProvider(repo));
    setRepoBrowserOpen(false);
  }, []);

  const handleToggleExplorer = useCallback(() => {
    setExplorerOpen((prev) => !prev);
  }, []);

  const handleExplorerSelectFile = useCallback(async (repo: string, filePath: string) => {
    selectedFileRef.current = { repo, filePath };
    setTimelineProvider(new GitHubTimelineProvider(repo));
    const content = await fetchFileContent(repo, filePath);
    setExternalContent(content);
    setEditorKey((k) => k + 1);
  }, []);

  const handleExplorerSelectCommit = useCallback(async (repo: string, filePath: string, sha: string) => {
    const res = await fetch(
      `/api/github/content?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(sha)}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    const content = data.content ?? '';
    setExternalContent(content);
    setEditorKey((k) => k + 1);
  }, []);

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <ExplorerPanel
        open={explorerOpen}
        onSelectFile={handleExplorerSelectFile}
        onSelectCommit={handleExplorerSelectCommit}
      />
      <Box sx={{ flex: 1, minWidth: 0, overflow: "auto" }}>
        <MarkdownEditorPage
          key={editorKey}
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
          onLocaleChange={setLocale}
          fileSystemProvider={fileSystemProvider}
          timelineProvider={timelineProvider}
          onRequestTimeline={handleRequestTimeline}
          explorerOpen={explorerOpen}
          onToggleExplorer={handleToggleExplorer}
          externalContent={externalContent}
          featuresUrl="/features"
          showReadonlyMode={process.env.NEXT_PUBLIC_SHOW_READONLY_MODE === "1"}
        />
      </Box>
      <GitHubRepoBrowser
        open={repoBrowserOpen}
        onClose={() => setRepoBrowserOpen(false)}
        onSelect={handleRepoSelect}
      />
    </Box>
  );
}
