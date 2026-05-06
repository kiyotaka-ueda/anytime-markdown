import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useDrawingArea, useXScale } from '@mui/x-charts/hooks';
import type { ErrorMarkerData } from '../../types';

export function ErrorMarkers({ markers }: Readonly<{ markers: readonly ErrorMarkerData[] }>) {
  const { top } = useDrawingArea();
  const xScale = useXScale();
  if (markers.length === 0) return null;
  const SIZE = 4;
  const HEIGHT = 6;
  return (
    <>
      {markers.map(({ turn, agentLabel, toolName }) => {
        const cx = xScale(turn as never) as number | undefined;
        if (cx == null) return null;
        const points = `${cx - SIZE},${top - HEIGHT} ${cx + SIZE},${top - HEIGHT} ${cx},${top}`;
        return (
          <Tooltip
            key={turn}
            placement="top"
            title={
              <Box sx={{ p: 0.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>{agentLabel}</Typography>
                {toolName && <Typography variant="caption" sx={{ display: 'block' }}>Tool: {toolName}</Typography>}
              </Box>
            }
          >
            <g style={{ cursor: 'pointer' }}>
              <polygon points={points} fill="#F44336" opacity={0.9} />
            </g>
          </Tooltip>
        );
      })}
    </>
  );
}
