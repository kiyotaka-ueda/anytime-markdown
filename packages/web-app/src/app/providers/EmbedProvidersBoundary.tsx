'use client';

import { EmbedProvidersProvider } from '@anytime-markdown/markdown-core/src/contexts/EmbedProvidersContext';
import type {
  EmbedProviders,
  OembedData,
  OgpData,
} from '@anytime-markdown/markdown-core/src/types/embedProvider';
import { useMemo, type ReactNode } from 'react';

async function fetchOgp(url: string): Promise<OgpData> {
  const res = await fetch(`/api/ogp?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as OgpData;
}

async function fetchOembed(url: string): Promise<OembedData> {
  const res = await fetch(`/api/oembed?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as OembedData;
}

export function EmbedProvidersBoundary({ children }: { children: ReactNode }) {
  const providers = useMemo<EmbedProviders>(() => ({ fetchOgp, fetchOembed }), []);
  return <EmbedProvidersProvider value={providers}>{children}</EmbedProvidersProvider>;
}
