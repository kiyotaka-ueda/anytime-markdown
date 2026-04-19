import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTrailI18n } from '../../i18n';

type PeriodDays = 7 | 30 | 90;

const STORAGE_KEY = 'anytime-trail-metrics-period';

function loadPeriod(): PeriodDays {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved === '7' || saved === '30' || saved === '90') return Number(saved) as PeriodDays;
  } catch { /* ignore */ }
  return 30;
}

export interface PeriodSelectorProps {
  readonly value: PeriodDays;
  readonly onChange: (period: PeriodDays) => void;
}

export function PeriodSelector({ value, onChange }: Readonly<PeriodSelectorProps>) {
  const { t } = useTrailI18n();

  const handleChange = (_: React.MouseEvent<HTMLElement>, next: string | null) => {
    if (!next) return;
    const days = Number(next) as PeriodDays;
    try { globalThis.localStorage?.setItem(STORAGE_KEY, String(days)); } catch { /* ignore */ }
    onChange(days);
  };

  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={String(value)}
      onChange={handleChange}
      aria-label="period selector"
    >
      <ToggleButton value="7">{t('metrics.period.last7d')}</ToggleButton>
      <ToggleButton value="30">{t('metrics.period.last30d')}</ToggleButton>
      <ToggleButton value="90">{t('metrics.period.last90d')}</ToggleButton>
    </ToggleButtonGroup>
  );
}

export { loadPeriod };
