import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

export interface TemporalCouplingControlsValue {
  enabled: boolean;
  windowDays: number;
  threshold: number;
  topK: number;
  directional: boolean;
  confidenceThreshold: number;
  directionalDiff: number;
}

export interface TemporalCouplingControlsProps {
  readonly value: TemporalCouplingControlsValue;
  readonly onChange: (next: TemporalCouplingControlsValue) => void;
  readonly resultCount: number;
  readonly loading: boolean;
}

const WINDOW_OPTIONS: ReadonlyArray<{ label: string; days: number }> = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 365 },
];

const TOP_K_OPTIONS: ReadonlyArray<number> = [10, 50, 100];

export function TemporalCouplingControls({
  value,
  onChange,
  resultCount,
  loading,
}: Readonly<TemporalCouplingControlsProps>) {
  const handleEnabled = (next: boolean): void => onChange({ ...value, enabled: next });
  const handleWindow = (days: number): void => onChange({ ...value, windowDays: days });
  const handleThreshold = (threshold: number): void => onChange({ ...value, threshold });
  const handleTopK = (topK: number): void => onChange({ ...value, topK });
  const handleDirectional = (directional: boolean): void =>
    onChange({ ...value, directional });
  const handleConfidenceThreshold = (confidenceThreshold: number): void =>
    onChange({ ...value, confidenceThreshold });
  const handleDirectionalDiff = (directionalDiff: number): void =>
    onChange({ ...value, directionalDiff });

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
      aria-label="時間的結合エッジの表示制御"
    >
      <FormControlLabel
        control={
          <Switch
            checked={value.enabled}
            onChange={(e) => handleEnabled(e.target.checked)}
            inputProps={{ 'aria-label': '時間的結合エッジを表示' }}
            size="small"
          />
        }
        label={<Typography variant="caption">Ghost Edges</Typography>}
      />

      <FormControlLabel
        control={
          <Switch
            checked={value.directional}
            onChange={(e) => handleDirectional(e.target.checked)}
            inputProps={{ 'aria-label': '方向性付きエッジを表示' }}
            disabled={!value.enabled}
            size="small"
          />
        }
        label={<Typography variant="caption">方向性</Typography>}
      />

      <FormControl size="small" sx={{ minWidth: 88 }} disabled={!value.enabled}>
        <InputLabel id="tc-window-label">期間</InputLabel>
        <Select
          labelId="tc-window-label"
          label="期間"
          value={String(value.windowDays)}
          onChange={(e) => handleWindow(Number.parseInt(String(e.target.value), 10))}
          inputProps={{ 'aria-label': '集計期間' }}
        >
          {WINDOW_OPTIONS.map((opt) => (
            <MenuItem key={opt.days} value={String(opt.days)}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!value.directional && (
        <Box sx={{ minWidth: 140, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
            閾値 {value.threshold.toFixed(2)}
          </Typography>
          <Slider
            value={value.threshold}
            min={0}
            max={1}
            step={0.05}
            size="small"
            disabled={!value.enabled}
            onChange={(_, v) => handleThreshold(Array.isArray(v) ? v[0] : v)}
            aria-label="Jaccard 閾値"
            aria-valuetext={`Jaccard ${value.threshold.toFixed(2)}`}
            sx={{ flex: 1 }}
          />
        </Box>
      )}

      {value.directional && (
        <>
          <Box sx={{ minWidth: 140, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
              Conf {value.confidenceThreshold.toFixed(2)}
            </Typography>
            <Slider
              value={value.confidenceThreshold}
              min={0}
              max={1}
              step={0.05}
              size="small"
              disabled={!value.enabled}
              onChange={(_, v) =>
                handleConfidenceThreshold(Array.isArray(v) ? v[0] : v)
              }
              aria-label="Confidence 閾値"
              aria-valuetext={`Confidence ${value.confidenceThreshold.toFixed(2)}`}
              sx={{ flex: 1 }}
            />
          </Box>
          <Box sx={{ minWidth: 140, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
              Diff {value.directionalDiff.toFixed(2)}
            </Typography>
            <Slider
              value={value.directionalDiff}
              min={0}
              max={1}
              step={0.05}
              size="small"
              disabled={!value.enabled}
              onChange={(_, v) =>
                handleDirectionalDiff(Array.isArray(v) ? v[0] : v)
              }
              aria-label="方向差分閾値"
              aria-valuetext={`方向差分 ${value.directionalDiff.toFixed(2)}`}
              sx={{ flex: 1 }}
            />
          </Box>
        </>
      )}

      <FormControl size="small" sx={{ minWidth: 80 }} disabled={!value.enabled}>
        <InputLabel id="tc-topk-label">Top-K</InputLabel>
        <Select
          labelId="tc-topk-label"
          label="Top-K"
          value={String(value.topK)}
          onChange={(e) => handleTopK(Number.parseInt(String(e.target.value), 10))}
          inputProps={{ 'aria-label': 'Top-K 件数' }}
        >
          {TOP_K_OPTIONS.map((k) => (
            <MenuItem key={k} value={String(k)}>
              {k}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Typography variant="caption" color="text.secondary" aria-live="polite">
        {value.enabled
          ? loading
            ? '計算中...'
            : `${resultCount} edges shown`
          : 'OFF'}
      </Typography>
    </Box>
  );
}
