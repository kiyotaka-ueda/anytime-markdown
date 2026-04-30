import type {
  ActivityTrend,
  TrendGranularity,
  TrendPeriod,
} from '@anytime-markdown/trail-core/c4';

export interface ActivityTrendFetchParams {
  readonly elementId: string;
  readonly period: TrendPeriod;
  readonly granularity: TrendGranularity;
}

export type ActivityTrendResponse = {
  readonly elementId: string;
  readonly period: TrendPeriod;
  readonly granularity: TrendGranularity;
  readonly from: string;
  readonly to: string;
} & ActivityTrend;

export function buildActivityTrendUrl(
  serverUrl: string,
  params: ActivityTrendFetchParams,
): string {
  const qs = new URLSearchParams();
  qs.set('elementId', params.elementId);
  qs.set('period', params.period);
  qs.set('granularity', params.granularity);
  return `${serverUrl}/api/activity-trend?${qs.toString()}`;
}

export async function fetchActivityTrendApi(
  serverUrl: string,
  params: ActivityTrendFetchParams,
  signal?: AbortSignal,
): Promise<ActivityTrendResponse> {
  const url = buildActivityTrendUrl(serverUrl, params);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`activity-trend request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as ActivityTrendResponse;
}
