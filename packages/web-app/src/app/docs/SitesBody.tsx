'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  CircularProgress,
  Container,
  Grid,
  Link as MuiLink,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import LandingHeader from '../components/LandingHeader';
import SiteFooter from '../components/SiteFooter';

interface LayoutCard {
  id: string;
  docKey: string;
  title: string;
  description: string;
  thumbnail: string;
  order: number;
}

export default function SitesBody() {
  const t = useTranslations('Landing');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [cards, setCards] = useState<LayoutCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sites/layout')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ cards: LayoutCard[] }>;
      })
      .then((data) => {
        setCards(data.cards.sort((a, b) => a.order - b.order));
      })
      .catch(() => setError(t('sitesLoadError')))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <LandingHeader />
      <Container maxWidth="lg" sx={{ flex: 1, py: 4, px: { xs: 2, md: 4 } }}>
        <MuiLink
          component={NextLink}
          href="/"
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
          {t('backToHome')}
        </MuiLink>

        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 700,
            mb: 4,
            color: 'text.primary',
            fontSize: { xs: '1.8rem', md: '2.4rem' },
          }}
        >
          {t('sitesPage')}
        </Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!loading && !error && cards.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {t('sitesEmpty')}
          </Typography>
        )}

        {!loading && !error && cards.length > 0 && (
          <Grid container spacing={3}>
            {cards.map((card) => (
              <Grid key={card.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    borderRadius: 3,
                    transition: 'border-color 0.2s',
                    '&:hover': {
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <CardActionArea
                    component={NextLink}
                    href={`/docs/view?key=${encodeURIComponent(card.docKey)}`}
                    sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                  >
                    {card.thumbnail && (
                      <CardMedia
                        component="img"
                        height={160}
                        image={card.thumbnail}
                        alt={card.title}
                        sx={{ objectFit: 'cover' }}
                      />
                    )}
                    <CardContent sx={{ flex: 1, p: 3.5 }}>
                      <Typography
                        variant="subtitle1"
                        component="h2"
                        sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}
                      >
                        {card.title}
                      </Typography>
                      {card.description && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                          {card.description}
                        </Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
      <SiteFooter />
    </Box>
  );
}
