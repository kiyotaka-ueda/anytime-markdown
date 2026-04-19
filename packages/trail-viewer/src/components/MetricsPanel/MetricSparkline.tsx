import { useMemo } from 'react';
import Box from '@mui/material/Box';
import { LineChart } from '@mui/x-charts/LineChart';
import { useTheme } from '@mui/material/styles';

export interface MetricSparklineProps {
  readonly timeSeries: Array<{ bucketStart: string; value: number }>;
}

export function MetricSparkline({ timeSeries }: Readonly<MetricSparklineProps>) {
  const theme = useTheme();
  const data = useMemo(() => timeSeries.map((p) => p.value), [timeSeries]);

  if (data.length < 2) return null;

  return (
    <Box sx={{ width: '100%', height: 40 }}>
      <LineChart
        series={[{ data, showMark: false, color: theme.palette.primary.main }]}
        xAxis={[{ data: timeSeries.map((_, i) => i), scaleType: 'linear' }]}
        height={40}
        margin={{ top: 4, bottom: 4, left: 0, right: 0 }}
        sx={{
          '& .MuiChartsAxis-root': { display: 'none' },
          '& .MuiChartsLegend-root': { display: 'none' },
        }}
      />
    </Box>
  );
}
