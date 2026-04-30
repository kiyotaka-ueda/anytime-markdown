import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';

import type {
  TrendGranularity,
  TrendPeriod,
} from '@anytime-markdown/trail-core/c4';

import { useTrailI18n } from '../../i18n/context';

export interface HotspotControlsValue {
  readonly period: TrendPeriod;
  readonly granularity: TrendGranularity;
}

export interface HotspotControlsProps {
  readonly value: HotspotControlsValue;
  readonly onChange: (next: HotspotControlsValue) => void;
  readonly loading?: boolean;
  readonly disabled?: boolean;
}

const PERIOD_OPTIONS: ReadonlyArray<TrendPeriod> = ['7d', '30d', '90d', 'all'];
const GRANULARITY_OPTIONS: ReadonlyArray<TrendGranularity> = ['commit', 'session', 'subagent'];

export function HotspotControls({
  value,
  onChange,
  loading,
  disabled = false,
}: Readonly<HotspotControlsProps>) {
  const { t } = useTrailI18n();
  const handlePeriod = (period: TrendPeriod): void => onChange({ ...value, period });
  const handleGranularity = (granularity: TrendGranularity): void =>
    onChange({ ...value, granularity });
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        alignItems: 'center',
        flexWrap: 'wrap',
        px: 1,
        py: 0.5,
        borderTop: 1,
        borderColor: 'divider',
      }}
      role="group"
      aria-label="Hotspot overlay controls"
    >
      <FormControl size="small" sx={{ minWidth: 96 }} disabled={disabled}>
        <InputLabel id="hs-period-label">{t('c4.hotspot.controls.period')}</InputLabel>
        <Select
          labelId="hs-period-label"
          label={t('c4.hotspot.controls.period')}
          value={value.period}
          onChange={(e) => handlePeriod(String(e.target.value) as TrendPeriod)}
          inputProps={{ 'aria-label': t('c4.hotspot.controls.period') }}
        >
          {PERIOD_OPTIONS.map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl
        component="fieldset"
        size="small"
        disabled={disabled}
        sx={{ display: 'flex', alignItems: 'center', flexDirection: 'row', gap: 1 }}
      >
        <FormLabel
          component="legend"
          sx={{ typography: 'caption', position: 'static', transform: 'none', m: 0 }}
        >
          {t('c4.hotspot.controls.granularity')}
        </FormLabel>
        <RadioGroup
          row
          value={value.granularity}
          onChange={(e) => handleGranularity(String(e.target.value) as TrendGranularity)}
          aria-label={t('c4.hotspot.controls.granularity')}
        >
          {GRANULARITY_OPTIONS.map((g) => (
            <FormControlLabel
              key={g}
              value={g}
              control={<Radio size="small" />}
              label={
                <Typography variant="caption">
                  {g === 'commit'
                    ? t('c4.hotspot.controls.granularityCommit')
                    : g === 'session'
                      ? t('c4.hotspot.controls.granularitySession')
                      : t('c4.hotspot.controls.granularitySubagent')}
                </Typography>
              }
            />
          ))}
        </RadioGroup>
      </FormControl>

      {loading && (
        <Typography variant="caption" color="text.secondary" aria-live="polite">
          ...
        </Typography>
      )}
    </Box>
  );
}
