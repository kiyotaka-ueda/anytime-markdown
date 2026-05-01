import type { TrendPeriod } from '@anytime-markdown/trail-core/c4';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import { useMemo, useState } from 'react';

import { useTrailI18n } from '../../i18n/context';
import type { ActivityTrendResponse } from '../hooks/fetchActivityTrendApi';
import { useActivityTrend } from '../hooks/useActivityTrend';

const PERIOD_OPTIONS: ReadonlyArray<TrendPeriod> = ['7d', '30d', '90d', 'all'];

const ACTIVITY_TREND_PALETTE_DARK = {
  commit: '#E8A012',
  session: '#7AB8FF',
} as const;
const ACTIVITY_TREND_PALETTE_LIGHT = {
  commit: '#3D4A52',
  session: '#6B2A20',
} as const;

type ActivityTrendSeries = {
  readonly xs: readonly string[];
  readonly series: ReadonlyArray<{
    readonly data: readonly number[];
    readonly label: string;
    readonly color: string;
  }>;
};

export function buildActivityTrendSeries(
  commitData: ActivityTrendResponse | null,
  sessionData: ActivityTrendResponse | null,
  labels: Readonly<{ commit: string; session: string }>,
  palette: Readonly<{ commit: string; session: string }>,
): ActivityTrendSeries | null {
  if (!commitData || !sessionData) return null;
  if (commitData.type !== 'single-series' || sessionData.type !== 'single-series') return null;

  const xs = commitData.buckets.map((b) => b.date);
  const sessionByDate = new Map(sessionData.buckets.map((b) => [b.date, b.count] as const));

  return {
    xs,
    series: [
      {
        data: commitData.buckets.map((b) => b.count),
        label: labels.commit,
        color: palette.commit,
      },
      {
        data: xs.map((date) => sessionByDate.get(date) ?? 0),
        label: labels.session,
        color: palette.session,
      },
    ],
  };
}

export interface ActivityTrendChartProps {
  readonly elementId: string | null;
  readonly serverUrl: string | undefined;
  readonly repoName?: string;
  readonly isDark?: boolean;
}

export function ActivityTrendChart({
  elementId,
  serverUrl,
  repoName,
  isDark = false,
}: Readonly<ActivityTrendChartProps>) {
  const { t } = useTrailI18n();
  const [period, setPeriod] = useState<TrendPeriod>('30d');

  const enabled = !!elementId;
  const commitTrend = useActivityTrend({
    enabled,
    serverUrl,
    elementId: elementId ?? '',
    period,
    granularity: 'commit',
    repoName,
  });
  const sessionTrend = useActivityTrend({
    enabled,
    serverUrl,
    elementId: elementId ?? '',
    period,
    granularity: 'session',
    repoName,
  });

  const palette = isDark ? ACTIVITY_TREND_PALETTE_DARK : ACTIVITY_TREND_PALETTE_LIGHT;

  const chartProps = useMemo(() => {
    return buildActivityTrendSeries(
      commitTrend.data,
      sessionTrend.data,
      {
        commit: t('c4.hotspot.controls.granularityCommit'),
        session: t('c4.hotspot.controls.granularitySession'),
      },
      palette,
    );
  }, [commitTrend.data, sessionTrend.data, palette, t]);

  const error = commitTrend.error ?? sessionTrend.error;
  const loading = commitTrend.loading || sessionTrend.loading;

  if (!elementId) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 1,
        borderTop: 1,
        borderColor: 'divider',
      }}
      role="region"
      aria-label="Activity trend"
    >
      <Typography variant="subtitle2" sx={{ fontSize: '0.8rem' }}>
        {t('c4.trend.title')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 88 }}>
          <InputLabel id="trend-period-label">{t('c4.hotspot.controls.period')}</InputLabel>
          <Select
            labelId="trend-period-label"
            label={t('c4.hotspot.controls.period')}
            value={period}
            onChange={(e) => setPeriod(String(e.target.value) as TrendPeriod)}
          >
            {PERIOD_OPTIONS.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      {error && (
        <Typography variant="caption" color="error" role="alert">
          {error.message}
        </Typography>
      )}
      {loading && !chartProps && (
        <Typography variant="caption" color="text.secondary" aria-live="polite">
          {t('c4.trend.loading')}
        </Typography>
      )}
      {chartProps && (
        <Box sx={{ width: '100%', minHeight: 200 }}>
          <LineChart
            xAxis={[{ data: chartProps.xs, scaleType: 'point' }]}
            series={chartProps.series}
            height={200}
            margin={{ left: 36, right: 12, top: 16, bottom: 28 }}
          />
        </Box>
      )}
    </Box>
  );
}
