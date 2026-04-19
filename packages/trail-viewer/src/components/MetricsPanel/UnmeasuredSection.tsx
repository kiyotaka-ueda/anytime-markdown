import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { UnmeasuredMetric } from '@anytime-markdown/trail-core/domain/metrics';
import { useTrailI18n } from '../../i18n';

export interface UnmeasuredSectionProps {
  readonly unmeasured: readonly UnmeasuredMetric[];
}

export function UnmeasuredSection({ unmeasured }: Readonly<UnmeasuredSectionProps>) {
  const { t } = useTrailI18n();

  if (unmeasured.length === 0) return null;

  return (
    <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2" color="text.secondary">
          {t('metrics.unmeasured.title')} ({unmeasured.length})
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {unmeasured.map((u) => (
            <Box
              key={u.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                px: 1,
                py: 0.5,
              }}
            >
              <Typography variant="caption" color="text.secondary">{u.id}</Typography>
              <Chip
                label={`${t('metrics.unmeasured.badge')} ${u.phase}`}
                size="small"
                sx={{ height: 18, fontSize: 10 }}
              />
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
