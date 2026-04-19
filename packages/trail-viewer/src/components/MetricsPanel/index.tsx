import { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import type { QualityMetrics, DateRange } from '@anytime-markdown/trail-core/domain/metrics';
import { useTrailI18n } from '../../i18n';
import { PeriodSelector } from './PeriodSelector';
import { MetricCard } from './MetricCard';
import { UnmeasuredSection } from './UnmeasuredSection';
import { ThresholdsDialog } from './ThresholdsDialog';

export interface MetricsPanelProps {
  readonly fetchQualityMetrics?: (range: DateRange) => Promise<QualityMetrics | null>;
  readonly isVsCode?: boolean;
}

type PeriodDays = 7 | 30 | 90;

function getRangeForPeriod(days: PeriodDays): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function MetricsPanel({ fetchQualityMetrics, isVsCode = false }: Readonly<MetricsPanelProps>) {
  const { t } = useTrailI18n();
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);

  const load = useCallback(async (days: PeriodDays) => {
    if (!fetchQualityMetrics) return;
    setLoading(true);
    setError(false);
    try {
      const range = getRangeForPeriod(days);
      const result = await fetchQualityMetrics(range);
      if (result) {
        setMetrics(result);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchQualityMetrics]);

  const handlePeriodChange = useCallback((days: PeriodDays) => {
    setPeriod(days);
    void load(days);
  }, [load]);

  // Initial load
  const [initialized, setInitialized] = useState(false);
  if (!initialized && fetchQualityMetrics) {
    setInitialized(true);
    void load(period);
  }

  return (
    <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <PeriodSelector value={period} onChange={handlePeriodChange} />
        <ThresholdsDialog
          open={thresholdsOpen}
          onOpen={() => setThresholdsOpen(true)}
          onClose={() => setThresholdsOpen(false)}
          thresholds={metrics ?? null}
          isVsCode={isVsCode}
        />
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {!loading && error && (
        <Typography color="error" variant="body2">{t('metrics.error')}</Typography>
      )}

      {!loading && !error && metrics && (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            {Object.values(metrics.metrics).map((m) => (
              <Box key={m.id} sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 240 }}>
                <MetricCard metric={m} />
              </Box>
            ))}
          </Box>
          <UnmeasuredSection unmeasured={metrics.unmeasured} />
        </>
      )}

      {!loading && !error && !metrics && !fetchQualityMetrics && (
        <Typography color="text.secondary" variant="body2">{t('metrics.empty')}</Typography>
      )}
    </Box>
  );
}
