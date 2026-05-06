import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

export function ChartTitle({ title, description }: Readonly<{ title: string; description?: string }>) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, gap: 0.5 }}>
      <Typography variant="subtitle2">{title}</Typography>
      {description && (
        <Tooltip title={description} arrow placement="top">
          <HelpOutlineIcon sx={{ fontSize: 12, color: 'text.disabled', cursor: 'help', flexShrink: 0 }} />
        </Tooltip>
      )}
    </Box>
  );
}
