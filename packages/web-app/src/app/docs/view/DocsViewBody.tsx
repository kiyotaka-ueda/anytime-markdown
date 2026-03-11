'use client';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Alert, Box, Button, CircularProgress, Container, Link as MuiLink } from '@mui/material';
import dynamic from 'next/dynamic';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import LandingHeader from '../../components/LandingHeader';
import SiteFooter from '../../components/SiteFooter';
import { useLocaleSwitch } from '../../LocaleProvider';
import { useThemeMode } from '../../providers';

const MarkdownEditorPage = dynamic(
  () => import('@anytime-markdown/editor-core/src/MarkdownEditorPage'),
  {
    ssr: false,
    loading: () => (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress aria-label="Loading viewer" />
      </Box>
    ),
  }
);

export default function DocsViewBody() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key');
  const t = useTranslations('Landing');
  const { themeMode, setThemeMode } = useThemeMode();
  const { setLocale } = useLocaleSwitch();

  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(() => {
    if (!key) {
      setError(t('docsViewNoUrl'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/docs/content?key=${encodeURIComponent(key)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        setContent(text);
      })
      .catch(() => {
        setError(t('docsViewLoadError'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [key, t]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <LandingHeader />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }} role="status">
          <CircularProgress aria-label="Loading" />
        </Box>
        <SiteFooter />
      </Box>
    );
  }

  if (error || content === null) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <LandingHeader />
        <Container maxWidth="md" sx={{ flex: 1, py: 6 }}>
          <MuiLink
            component={NextLink}
            href="/docs"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 3,
              textDecoration: 'none',
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
            {t('docsPage')}
          </MuiLink>
          <Alert
            severity="error"
            action={
              key ? (
                <Button color="inherit" size="small" onClick={fetchContent}>
                  {t('retry')}
                </Button>
              ) : undefined
            }
          >
            {error ?? t('docsViewLoadError')}
          </Alert>
        </Container>
        <SiteFooter />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <LandingHeader />
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <MarkdownEditorPage
          externalContent={content}
          readOnly
          hideToolbar
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
          onLocaleChange={setLocale}
        />
      </Box>
    </Box>
  );
}
