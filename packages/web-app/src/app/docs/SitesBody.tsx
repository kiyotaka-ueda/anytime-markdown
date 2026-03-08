'use client';

import {
  Alert,
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DescriptionIcon from '@mui/icons-material/Description';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import LandingHeader from '../components/LandingHeader';
import SiteFooter from '../components/SiteFooter';
import type { LayoutCategory } from '../../types/layout';

interface SitesBodyProps {
  initialData: {
    categories: LayoutCategory[];
    siteDescription?: string;
    error?: boolean;
  };
}

export default function SitesBody({ initialData }: SitesBodyProps) {
  const t = useTranslations('Landing');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const categories = initialData.categories;
  const siteDescription = initialData.siteDescription ?? '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <LandingHeader />
      <Container maxWidth="lg" sx={{ flex: 1, py: 4, px: { xs: 2, md: 4 } }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 700,
            mb: siteDescription ? 1 : 4,
            color: 'text.primary',
            fontSize: { xs: '1.8rem', md: '2.4rem' },
          }}
        >
          {t('sitesPage')}
        </Typography>

        {siteDescription && (
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.7 }}
          >
            {siteDescription}
          </Typography>
        )}

        {initialData.error && <Alert severity="error" sx={{ mb: 2 }}>{t('sitesLoadError')}</Alert>}

        {!initialData.error && categories.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <DescriptionIcon aria-hidden="true" sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {t('sitesEmpty')}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {t('docsEmptyHint')}
            </Typography>
          </Box>
        )}

        {!initialData.error && categories.length > 0 && (
          <Grid container spacing={3}>
            {categories.map((category) => (
              <Grid key={category.id} size={{ xs: 12, sm: 6, md: 4 }}>
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
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Typography
                      variant="h6"
                      component="h2"
                      sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}
                    >
                      {category.title}
                    </Typography>
                    {category.description && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2 }}>
                        {category.description}
                      </Typography>
                    )}
                    {category.items.length > 0 && (
                      <List dense disablePadding>
                        {category.items.map((item) => (
                          <ListItem key={item.docKey} disablePadding>
                            <ListItemButton
                              component={item.url?.startsWith('http') ? 'a' : NextLink}
                              href={item.url ?? `/docs/view?key=${encodeURIComponent(item.docKey)}`}
                              {...(item.url?.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                              sx={{
                                borderRadius: 1,
                                py: 0.5,
                                px: 1,
                                '&:hover': {
                                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                },
                              }}
                            >
                              <ListItemText
                                primary={item.displayName}
                                primaryTypographyProps={{
                                  variant: 'body2',
                                  color: 'primary.main',
                                  sx: { fontWeight: 500 },
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </CardContent>
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
