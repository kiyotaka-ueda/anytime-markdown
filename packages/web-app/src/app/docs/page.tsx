import type { Metadata } from 'next';
import DocsBody from './DocsBody';

export const metadata: Metadata = {
  title: 'Docs - Anytime Markdown',
  description: 'Public documentation for Anytime Markdown',
  alternates: { canonical: '/docs' },
};

export default function DocsPage() {
  return <DocsBody />;
}
