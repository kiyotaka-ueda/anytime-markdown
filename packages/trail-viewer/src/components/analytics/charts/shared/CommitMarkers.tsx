import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useDrawingArea, useXScale } from '@mui/x-charts/hooks';
import type { CommitMarkerData } from '../../types';

export function CommitMarkers({ markers }: Readonly<{ markers: readonly CommitMarkerData[] }>) {
  const { top } = useDrawingArea();
  const xScale = useXScale();
  if (markers.length === 0) return null;
  const SIZE = 6;
  const HEIGHT = 9;
  return (
    <>
      {markers.map(({ turn, agentLabel, commitHash, commitPrefix }) => {
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
                {commitHash && <Typography variant="caption" sx={{ display: 'block' }}>ID: {commitHash}</Typography>}
                {commitPrefix && <Typography variant="caption" sx={{ display: 'block' }}>{commitPrefix}</Typography>}
              </Box>
            }
          >
            <g style={{ cursor: 'pointer' }}>
              <polygon points={points} fill="#4CAF50" opacity={0.9} />
            </g>
          </Tooltip>
        );
      })}
    </>
  );
}
