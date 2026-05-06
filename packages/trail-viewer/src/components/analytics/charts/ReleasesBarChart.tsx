import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { BarChart } from '@mui/x-charts/BarChart';
import type { ReleaseQualityBucket } from '@anytime-markdown/trail-core/domain/metrics';
import { useTrailTheme } from '../../TrailThemeContext';
import { useTrailI18n } from '../../../i18n';
import { releaseColors } from '../../../theme/designTokens';

export function ReleasesBarChart({ timeSeries }: Readonly<{
  timeSeries: ReadonlyArray<ReleaseQualityBucket>;
}>) {
  const { cardSx } = useTrailTheme();
  const { t } = useTrailI18n();

  if (timeSeries.length === 0) {
    return (
      <Paper elevation={0} sx={{ ...cardSx, p: 2, minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">{t('metrics.empty')}</Typography>
      </Paper>
    );
  }

  const fmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });
  const dataset = timeSeries.map((d) => ({
    label: fmt.format(new Date(d.bucketStart)),
    succeeded: d.succeeded,
    failed: d.failed,
  }));

  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
      <BarChart
        dataset={dataset}
        xAxis={[{ scaleType: 'band', dataKey: 'label' }]}
        series={[
          { dataKey: 'succeeded', label: t('analytics.combined.releaseSucceeded'), color: releaseColors.succeeded, stack: 'releases' },
          { dataKey: 'failed', label: t('analytics.combined.releaseFailed'), color: releaseColors.failed, stack: 'releases' },
        ]}
        height={240}
        margin={{ left: 16, right: 8, top: 8, bottom: 40 }}
      />
    </Paper>
  );
}
