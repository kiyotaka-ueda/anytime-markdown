import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export function formatDoraValue(m: { value: number; unit: string }): { primary: string; unit?: string } {
  if (m.unit === 'perDay') {
    const text = m.value >= 1 ? `${m.value.toFixed(1)}/day` : m.value > 0 ? `${(m.value * 7).toFixed(1)}/week` : '0/day';
    return { primary: text };
  }
  if (m.unit === 'minPerLoc') {
    const num = m.value < 60 ? m.value.toFixed(2) : (m.value / 60).toFixed(1);
    return { primary: num, unit: m.value < 60 ? 'min/LOC' : 'h/LOC' };
  }
  if (m.unit === 'tokensPerLoc') {
    const num = m.value >= 1000 ? `${(m.value / 1000).toFixed(1)}k` : m.value.toFixed(0);
    return { primary: num, unit: 'tok/LOC' };
  }
  return { primary: `${m.value.toFixed(1)}%` };
}

export function DoraValueDisplay({ metric }: Readonly<{ metric: { value: number; unit: string } }>) {
  const { primary, unit } = formatDoraValue(metric);
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography variant="h3">{primary}</Typography>
      {unit && (
        <Typography variant="caption" color="text.secondary">
          {unit}
        </Typography>
      )}
    </Box>
  );
}
