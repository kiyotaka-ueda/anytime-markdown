'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import LandingHeader from '../components/LandingHeader';
import SiteFooter from '../components/SiteFooter';

interface DocEntry {
  name: string;
  url: string;
}

const DOCS_API_URL = process.env.NEXT_PUBLIC_DOCS_API_URL;

export default function DocsBody() {
  const t = useTranslations('Landing');
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!DOCS_API_URL) {
      setError(t('docsLoadError'));
      setLoading(false);
      return;
    }
    fetch(DOCS_API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DocEntry[]>;
      })
      .then(setDocs)
      .catch(() => setError(t('docsLoadError')))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <LandingHeader />
      <Container maxWidth="md" sx={{ flex: 1, py: 6 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          {t('docsPage')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {t('docsDescription')}
        </Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!loading && !error && docs.length === 0 && (
          <Typography color="text.secondary">{t('docsEmpty')}</Typography>
        )}

        {!loading && !error && docs.length > 0 && (
          <List>
            {docs.map((doc) => (
              <ListItemButton
                key={doc.url}
                component={NextLink}
                href={`/docs/view?url=${encodeURIComponent(doc.url)}`}
                sx={{ borderRadius: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <DescriptionIcon />
                </ListItemIcon>
                <ListItemText primary={doc.name} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Container>
      <SiteFooter />
    </Box>
  );
}
