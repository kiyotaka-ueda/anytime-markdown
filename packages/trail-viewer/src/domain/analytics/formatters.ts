export function fmtNum(n: number): string {
  return n.toLocaleString();
}

export function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function fmtUsdShort(n: number): string {
  if (n >= 1_000) return `$${parseFloat((n / 1_000).toFixed(1))}K`;
  return `$${n.toFixed(2)}`;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${parseFloat((n / 1_000_000_000).toFixed(1))}B`;
  if (n >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`;
  return String(n);
}

export function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

export function fmtDurationShort(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  const s = ms / 1_000;
  if (s < 60) return `${s.toFixed(0)}s`;
  const min = s / 60;
  if (min < 60) return `${min.toFixed(1)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

export function fmtPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`;
}
