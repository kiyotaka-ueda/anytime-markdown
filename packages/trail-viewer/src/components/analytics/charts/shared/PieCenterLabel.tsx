import { useDrawingArea } from '@mui/x-charts/hooks';

export function PieCenterLabel({ value, color }: Readonly<{ value: number; color: string }>) {
  const { width, height, left, top } = useDrawingArea();
  return (
    <text
      x={left + width / 2}
      y={top + height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: '1.5rem', fontWeight: 600, fill: color, pointerEvents: 'none' }}
    >
      {value}
    </text>
  );
}
