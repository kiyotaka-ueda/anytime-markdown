import Typography from '@mui/material/Typography';
import {
  ChartsTooltipCell,
  ChartsTooltipPaper,
  ChartsTooltipRow,
  ChartsTooltipTable,
  useAxesTooltip,
} from '@mui/x-charts/ChartsTooltip';
import { ChartsLabelMark } from '@mui/x-charts/ChartsLabel';

export function LeadTimeAxisTooltipContent({ unmappedByBucket, bucketKeys }: Readonly<{
  unmappedByBucket: Map<string, number>;
  bucketKeys: ReadonlyArray<string>;
}>) {
  const tooltipData = useAxesTooltip();
  if (tooltipData === null) return null;
  return (
    <ChartsTooltipPaper>
      {tooltipData.map(({ axisId, mainAxis, axisValue, axisFormattedValue, seriesItems, dataIndex }) => {
        const bucketKey = bucketKeys[dataIndex] ?? '';
        const unmapped = unmappedByBucket.get(bucketKey) ?? 0;
        return (
          <ChartsTooltipTable key={axisId}>
            {axisValue != null && !mainAxis.hideTooltip && (
              <Typography component="caption">{axisFormattedValue}</Typography>
            )}
            <tbody>
              {seriesItems.map((item) => (
                item.formattedValue == null || typeof item.formattedValue !== 'string' ? null : (
                  <ChartsTooltipRow key={item.seriesId}>
                    <ChartsTooltipCell component="th">
                      <ChartsLabelMark
                        type={item.markType}
                        markShape={item.markShape}
                        color={item.color}
                      />
                      {item.formattedLabel}
                    </ChartsTooltipCell>
                    <ChartsTooltipCell component="td">{item.formattedValue}</ChartsTooltipCell>
                  </ChartsTooltipRow>
                )
              ))}
              <ChartsTooltipRow>
                <ChartsTooltipCell component="th" sx={{ opacity: 0.7 }}>未マップ</ChartsTooltipCell>
                <ChartsTooltipCell component="td" sx={{ opacity: 0.7 }}>{unmapped} 件</ChartsTooltipCell>
              </ChartsTooltipRow>
            </tbody>
          </ChartsTooltipTable>
        );
      })}
    </ChartsTooltipPaper>
  );
}
