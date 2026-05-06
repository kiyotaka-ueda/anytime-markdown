import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { BarPlot } from '@mui/x-charts/BarChart';
import { LinePlot, MarkPlot } from '@mui/x-charts/LineChart';
import { ChartsDataProvider } from '@mui/x-charts/ChartsDataProvider';
import { ChartsSurface } from '@mui/x-charts/ChartsSurface';
import { ChartsWrapper } from '@mui/x-charts/ChartsWrapper';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { ChartsTooltipContainer } from '@mui/x-charts/ChartsTooltip';
import { ChartsGrid } from '@mui/x-charts/ChartsGrid';
import { ChartsLegend } from '@mui/x-charts/ChartsLegend';
import { ChartsAxisHighlight } from '@mui/x-charts/ChartsAxisHighlight';
import { useTrailTheme } from '../../../TrailThemeContext';
import { capTopN } from '../../../../domain/analytics/calculators';
import { fmtTokens } from '../../../../domain/analytics/formatters';
import { LEAD_TIME_LOC_COLOR } from '../../../../theme/designTokens';
import { LeadTimeAxisTooltipContent } from '../shared/LeadTimeAxisTooltipContent';

export function LeadTimeOverlay({
  leadTimeOverlay,
  canDrill,
  onDateClick,
}: Readonly<{
  leadTimeOverlay: {
    leadTimePerLoc: ReadonlyArray<{ bucketStart: string; value: number }>;
    unmapped: ReadonlyArray<{ bucketStart: string; value: number }>;
    byPrefix: {
      prefixes: ReadonlyArray<string>;
      series: ReadonlyArray<{ bucketStart: string; byPrefix: Readonly<Record<string, number>> }>;
    };
  } | null;
  canDrill: boolean;
  onDateClick?: (date: string) => void;
}>) {
  const { cardSx, toolPalette } = useTrailTheme();

  const ratioRows = leadTimeOverlay?.leadTimePerLoc ?? [];
  const byPrefixSeries = leadTimeOverlay?.byPrefix.series ?? [];
  const allPrefixes = leadTimeOverlay?.byPrefix.prefixes ?? [];
  if (byPrefixSeries.length === 0 && ratioRows.length === 0) {
    return <Typography variant="body2" color="text.secondary">0</Typography>;
  }

  const ltTotals = new Map<string, number>();
  for (const row of byPrefixSeries) {
    for (const [p, v] of Object.entries(row.byPrefix)) {
      ltTotals.set(p, (ltTotals.get(p) ?? 0) + v);
    }
  }
  const ltCap = capTopN(ltTotals);
  const ltPrefixes = ltCap.displayKeys;
  const ltMap = ltCap.keyMap;

  const unmappedRows = leadTimeOverlay?.unmapped ?? [];
  const bucketKeys = [...new Set([
    ...byPrefixSeries.map((r) => r.bucketStart),
    ...ratioRows.map((r) => r.bucketStart),
  ])].sort();
  const ratioByBucket = new Map(ratioRows.map((r) => [r.bucketStart, r.value]));
  const prefixRowByBucket = new Map(byPrefixSeries.map((r) => [r.bucketStart, r.byPrefix]));
  const unmappedByBucket = new Map(unmappedRows.map((r) => [r.bucketStart, r.value]));
  const fullDates = bucketKeys.map((b) => b.slice(0, 10));
  const labels = bucketKeys.map((b) => b.slice(5, 10));

  const ltDataset = bucketKeys.map((b, i) => {
    const byPrefix = prefixRowByBucket.get(b) ?? {};
    const aggregated: Record<string, number> = {};
    for (const p of ltPrefixes) aggregated[p] = 0;
    for (const origPrefix of allPrefixes) {
      const displayKey = ltMap.get(origPrefix) ?? origPrefix;
      aggregated[displayKey] = (aggregated[displayKey] ?? 0) + (byPrefix[origPrefix] ?? 0);
    }
    const entry: Record<string, string | number | null> = { period: labels[i] };
    for (let k = 0; k < ltPrefixes.length; k++) {
      entry[`l${k}`] = aggregated[ltPrefixes[k]] ?? 0;
    }
    entry.leadTimePerLoc = ratioByBucket.get(b) ?? null;
    return entry;
  });

  const fmtMin = (v: number | null) => v == null ? '-' : `${Math.round(v).toLocaleString()} min`;
  const fmtRatio = (v: number | null) => v == null ? '-' : `${v.toFixed(2)} min/LOC`;

  const barSeries = ltPrefixes.map((prefix, i) => ({
    type: 'bar' as const,
    dataKey: `l${i}`,
    label: prefix,
    stack: 'total',
    color: toolPalette[i % toolPalette.length],
    yAxisId: 'minAxis',
    valueFormatter: (v: number | null) => v == null || v === 0 ? null : fmtMin(v),
  }));
  const lineSeries = [{
    type: 'line' as const,
    dataKey: 'leadTimePerLoc',
    label: 'Lead Time / LOC (min/LOC)',
    color: LEAD_TIME_LOC_COLOR,
    yAxisId: 'ratioAxis',
    showMark: true,
    connectNulls: true,
    valueFormatter: fmtRatio,
  }];

  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
      <ChartsDataProvider
        dataset={ltDataset}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        series={[...barSeries, ...lineSeries] as any}
        xAxis={[{ id: 'period', scaleType: 'band', dataKey: 'period' }]}
        yAxis={[
          { id: 'minAxis', valueFormatter: fmtTokens },
          { id: 'ratioAxis', position: 'right' as const, valueFormatter: (v: number) => v.toFixed(2) },
        ]}
        height={260}
        margin={{ left: 16, right: 56, top: 8, bottom: 40 }}
        onAxisClick={canDrill
          ? (_e: MouseEvent, d: { dataIndex: number } | null) => {
              const idx = d?.dataIndex;
              if (idx == null || idx < 0 || idx >= fullDates.length) return;
              onDateClick?.(fullDates[idx]);
            }
          : undefined}
      >
        <ChartsWrapper legendDirection="horizontal" legendPosition={{ vertical: 'bottom', horizontal: 'center' }}>
          <ChartsLegend />
          <ChartsSurface>
            <ChartsGrid horizontal />
            <BarPlot />
            <LinePlot />
            <MarkPlot />
            <ChartsAxisHighlight x="band" />
            <ChartsXAxis axisId="period" />
            <ChartsYAxis axisId="minAxis" />
            <ChartsYAxis axisId="ratioAxis" />
          </ChartsSurface>
          <ChartsTooltipContainer trigger="axis">
            <LeadTimeAxisTooltipContent
              unmappedByBucket={unmappedByBucket}
              bucketKeys={bucketKeys}
            />
          </ChartsTooltipContainer>
        </ChartsWrapper>
      </ChartsDataProvider>
    </Paper>
  );
}
