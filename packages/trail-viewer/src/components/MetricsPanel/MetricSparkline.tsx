import { useMemo } from 'react';
import Box from '@mui/material/Box';
import { LineChart } from '@mui/x-charts/LineChart';
import { useTheme } from '@mui/material/styles';

export interface MetricSparklineProps {
  readonly timeSeries: Array<{ bucketStart: string; value: number }>;
  readonly bucket: 'day' | 'week';
}

function formatBucketLabel(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${month}/${day}`;
}

export function MetricSparkline({ timeSeries, bucket }: Readonly<MetricSparklineProps>) {
  const theme = useTheme();
  const data = useMemo(() => timeSeries.map((p) => p.value), [timeSeries]);
  const labels = useMemo(
    () => timeSeries.map((p) => formatBucketLabel(p.bucketStart)),
    [timeSeries],
  );
  const tickLabelInterval = useMemo(() => {
    const step = labels.length > 10 ? Math.ceil(labels.length / 8) : 1;
    return (_: unknown, index: number) => index % step === 0;
  }, [labels.length]);

  if (data.length < 2) return null;

  return (
    <Box sx={{ width: '100%', height: 120 }}>
      <LineChart
        series={[{ data, showMark: false, color: theme.palette.primary.main }]}
        xAxis={[{
          data: labels,
          scaleType: 'point',
          tickLabelInterval,
        }]}
        height={120}
        margin={{ top: 8, bottom: 32, left: 40, right: 12 }}
        sx={{
          '& .MuiChartsAxis-tickLabel': {
            fontSize: 10,
            fill: theme.palette.text.secondary,
          },
          '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': {
            stroke: theme.palette.divider,
          },
          '& .MuiChartsLegend-root': { display: 'none' },
        }}
      />
    </Box>
  );
}
