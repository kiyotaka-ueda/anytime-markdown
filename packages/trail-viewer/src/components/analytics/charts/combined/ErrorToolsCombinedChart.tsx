import { useMemo } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { BarChart } from '@mui/x-charts/BarChart';
import { useTrailTheme } from '../../../TrailThemeContext';
import { fmtTokens } from '../../../../domain/analytics/formatters';
import type { CombinedAxisInfo } from './axisInfo';
import { hideZero, makeAxisClick } from './axisInfo';

export function ErrorToolsCombinedChart({
  axisInfo,
  canDrill,
  onDateClick,
}: Readonly<{
  axisInfo: CombinedAxisInfo;
  canDrill: boolean;
  onDateClick?: (date: string) => void;
}>) {
  const { cardSx, toolPalette } = useTrailTheme();
  const { errorRows, allPeriods, labels, errTools, errMap } = axisInfo;

  const dataset = useMemo(() => {
    const valMap = new Map<string, number>();
    for (const r of errorRows) {
      for (const [tool, v] of Object.entries(r.byTool)) {
        const displayKey = errMap.get(tool) ?? tool;
        const key = `${r.period}::${displayKey}`;
        valMap.set(key, (valMap.get(key) ?? 0) + v);
      }
    }
    return allPeriods.map((p, pi) => {
      const entry: Record<string, string | number> = { period: labels[pi] };
      for (let i = 0; i < errTools.length; i++) {
        entry[`e${i}`] = valMap.get(`${p}::${errTools[i]}`) ?? 0;
      }
      return entry;
    });
  }, [errorRows, allPeriods, labels, errTools, errMap]);

  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
      {errTools.length === 0 ? (
        <Typography variant="body2" color="text.secondary">0</Typography>
      ) : (
        <BarChart
          dataset={dataset}
          xAxis={[{ scaleType: 'band', dataKey: 'period' }]}
          yAxis={[{ valueFormatter: fmtTokens }]}
          series={errTools.map((tool, i) => ({
            dataKey: `e${i}`,
            label: tool,
            stack: 'total',
            color: toolPalette[i % toolPalette.length],
            valueFormatter: hideZero,
          }))}
          height={240}
          margin={{ left: 16, right: 8, top: 8, bottom: 40 }}
          slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' } } }}
          onAxisClick={makeAxisClick(allPeriods, canDrill, onDateClick)}
        />
      )}
    </Paper>
  );
}
