import type { SequenceModel } from '@anytime-markdown/trace-core/c4Sequence';

export async function fetchC4SequenceApi(
  serverUrl: string,
  elementId: string,
  signal?: AbortSignal,
): Promise<SequenceModel> {
  const url = `${serverUrl}/api/c4/sequence?elementId=${encodeURIComponent(elementId)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`c4-sequence request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SequenceModel;
}
