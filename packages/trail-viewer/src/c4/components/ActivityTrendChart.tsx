import type { TrendGranularity, TrendPeriod } from '@anytime-markdown/trail-core/c4';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import { useMemo, useState } from 'react';

import { useTrailI18n } from '../../i18n/context';
import { useActivityTrend } from '../hooks/useActivityTrend';

const PERIOD_OPTIONS: ReadonlyArray<TrendPeriod> = ['7d', '30d', '90d', 'all'];
const GRANULARITY_OPTIONS: ReadonlyArray<TrendGranularity> = ['commit', 'session', 'subagent'];

const SUBAGENT_PALETTE_DARK: ReadonlyArray<string> = [
  '#E8A012', '#7AB8FF', '#76C893', '#E8501C', '#C3AED6',
];
const SUBAGENT_PALETTE_LIGHT: ReadonlyArray<string> = [
  '#3D4A52', '#6B2A20', '#1565C0', '#2E7D32', '#5C5470',
];

export interface ActivityTrendChartProps {
  readonly elementId: string | null;
  readonly serverUrl: string | undefined;
  readonly isDark?: boolean;
}

export function ActivityTrendChart({
  elementId,
  serverUrl,
  isDark = false,
}: Readonly<ActivityTrendChartProps>) {
  const { t } = useTrailI18n();
  const [period, setPeriod] = useState<TrendPeriod>('30d');
  const [granularity, setGranularity] = useState<TrendGranularity>('commit');

  const enabled = !!elementId;
  const { data, loading, error } = useActivityTrend({
    enabled,
    serverUrl,
    elementId: elementId ?? '',
    period,
    granularity,
  });

  const palette = isDark ? SUBAGENT_PALETTE_DARK : SUBAGENT_PALETTE_LIGHT;

  const chartProps = useMemo(() => {
    if (!data) return null;
    if (data.type === 'single-series') {
      const xs = data.buckets.map((b) => b.date);
      const ys = data.buckets.map((b) => b.count);
      return {
        xs,
        series: [{ data: ys, label: granularity, color: palette[0] }],
      };
    }
    if (data.series.length === 0) return null;
    const baseXs = data.series[0].buckets.map((b) => b.date);
    const series = data.series.map((s, i) => ({
      data: s.buckets.map((b) => b.count),
      label: s.key,
      color: palette[i % palette.length],
    }));
    return { xs: baseXs, series };
  }, [data, granularity, palette]);

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
        <FormControl
          component="fieldset"
          size="small"
          sx={{ display: 'flex', alignItems: 'center', flexDirection: 'row', gap: 1 }}
        >
          <FormLabel
            component="legend"
            sx={{ typography: 'caption', position: 'static', transform: 'none', m: 0 }}
          >
            {t('c4.hotspot.controls.granularity')}
          </FormLabel>
          <RadioGroup
            row
            value={granularity}
            onChange={(e) => setGranularity(String(e.target.value) as TrendGranularity)}
            aria-label={t('c4.hotspot.controls.granularity')}
          >
            {GRANULARITY_OPTIONS.map((g) => (
              <FormControlLabel
                key={g}
                value={g}
                control={<Radio size="small" />}
                label={
                  <Typography variant="caption">
                    {g === 'commit'
                      ? t('c4.hotspot.controls.granularityCommit')
                      : g === 'session'
                        ? t('c4.hotspot.controls.granularitySession')
                        : t('c4.hotspot.controls.granularitySubagent')}
                  </Typography>
                }
              />
            ))}
          </RadioGroup>
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
