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

const PERIOD_OPTIONS: ReadonlyArray<Exclude<TrendPeriod, 'all'>> = ['7d', '30d', '90d'];

function formatTrendDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' }).format(parsed);
}

const ACTIVITY_TREND_PALETTE_DARK = {
  commit: '#E8A012',
  read: '#7AB8FF',
  write: '#76C893',
} as const;
const ACTIVITY_TREND_PALETTE_LIGHT = {
  commit: '#3D4A52',
  read: '#1565C0',
  write: '#2E7D32',
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
  readData: ActivityTrendResponse | null,
  writeData: ActivityTrendResponse | null,
  labels: Readonly<{ commit: string; read: string; write: string }>,
  palette: Readonly<{ commit: string; read: string; write: string }>,
): ActivityTrendSeries | null {
  if (!commitData || !readData || !writeData) return null;
  if (
    commitData.type !== 'single-series'
    || readData.type !== 'single-series'
    || writeData.type !== 'single-series'
  ) return null;

  const xs = commitData.buckets.map((b) => b.date);
  const readByDate = new Map(readData.buckets.map((b) => [b.date, b.count] as const));
  const writeByDate = new Map(writeData.buckets.map((b) => [b.date, b.count] as const));

  return {
    xs,
    series: [
      {
        data: commitData.buckets.map((b) => b.count),
        label: labels.commit,
        color: palette.commit,
      },
      {
        data: xs.map((date) => readByDate.get(date) ?? 0),
        label: labels.read,
        color: palette.read,
      },
      {
        data: xs.map((date) => writeByDate.get(date) ?? 0),
        label: labels.write,
        color: palette.write,
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
  const readTrend = useActivityTrend({
    enabled,
    serverUrl,
    elementId: elementId ?? '',
    period,
    granularity: 'session',
    sessionMode: 'read',
    repoName,
  });
  const writeTrend = useActivityTrend({
    enabled,
    serverUrl,
    elementId: elementId ?? '',
    period,
    granularity: 'session',
    sessionMode: 'write',
    repoName,
  });

  const palette = isDark ? ACTIVITY_TREND_PALETTE_DARK : ACTIVITY_TREND_PALETTE_LIGHT;

  const chartProps = useMemo(() => {
    return buildActivityTrendSeries(
      commitTrend.data,
      readTrend.data,
      writeTrend.data,
      {
        commit: t('c4.trend.seriesCommit'),
        read: t('c4.trend.seriesRead'),
        write: t('c4.trend.seriesWrite'),
      },
      palette,
    );
  }, [commitTrend.data, readTrend.data, writeTrend.data, palette, t]);

  const error = commitTrend.error ?? readTrend.error ?? writeTrend.error;
  const loading = commitTrend.loading || readTrend.loading || writeTrend.loading;
  const legendItems = chartProps?.series ?? [];

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
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'max-content minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
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
          {chartProps && (
            <Box component="ul" sx={{ m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {legendItems.map((item) => (
                <Box
                  component="li"
                  key={item.label}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, listStyle: 'none' }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '2px',
                      bgcolor: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="caption" sx={{ lineHeight: 1.2 }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
        <Box sx={{ minWidth: 0 }}>
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
                xAxis={[{ data: chartProps.xs, scaleType: 'point', valueFormatter: formatTrendDate }]}
                yAxis={[{ min: 0 }]}
                series={chartProps.series}
                hideLegend
                height={200}
                margin={{ left: 36, right: 12, top: 16, bottom: 28 }}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
