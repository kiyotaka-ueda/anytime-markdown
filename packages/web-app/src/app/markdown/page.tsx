'use client';

import { Box, CircularProgress } from '@mui/material';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { FallbackFileSystemProvider } from '../../lib/FallbackFileSystemProvider';
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

export default function Page() {
  const { themeMode, setThemeMode } = useThemeMode();
  const { setLocale } = useLocaleSwitch();

  const fileSystemProvider = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const web = new WebFileSystemProvider();
    return web.supportsDirectAccess ? web : new FallbackFileSystemProvider();
  }, []);

  return (
    <MarkdownEditorPage
      themeMode={themeMode}
      onThemeModeChange={setThemeMode}
      onLocaleChange={setLocale}
      fileSystemProvider={fileSystemProvider}
      featuresUrl="/features"
      showReadonlyMode={process.env.NEXT_PUBLIC_SHOW_READONLY_MODE === "1"}
    />
  );
}
