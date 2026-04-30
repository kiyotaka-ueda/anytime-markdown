import type { HeatmapAxis, HeatmapCell, TrendPeriod } from '@anytime-markdown/trail-core/c4';

export type HeatmapMode = 'session-file' | 'subagent-file';

export interface ActivityHeatmapFetchParams {
  readonly period: TrendPeriod;
  readonly mode: HeatmapMode;
  readonly topK?: number;
}

export interface ActivityHeatmapResponse {
  readonly period: TrendPeriod;
  readonly mode: HeatmapMode;
  readonly from: string;
  readonly to: string;
  readonly rows: readonly HeatmapAxis[];
  readonly columns: readonly HeatmapAxis[];
  readonly cells: readonly HeatmapCell[];
  readonly maxValue: number;
}

export function buildActivityHeatmapUrl(
  serverUrl: string,
  params: ActivityHeatmapFetchParams,
): string {
  const qs = new URLSearchParams();
  qs.set('period', params.period);
  qs.set('mode', params.mode);
  if (params.topK !== undefined) qs.set('topK', String(params.topK));
  return `${serverUrl}/api/activity-heatmap?${qs.toString()}`;
}

export async function fetchActivityHeatmapApi(
  serverUrl: string,
  params: ActivityHeatmapFetchParams,
  signal?: AbortSignal,
): Promise<ActivityHeatmapResponse> {
  const url = buildActivityHeatmapUrl(serverUrl, params);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`activity-heatmap request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as ActivityHeatmapResponse;
}
