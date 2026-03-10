import type { Metadata } from 'next';
import FeaturesBody from './FeaturesBody';

export const metadata: Metadata = {
  title: 'Features - Anytime Markdown',
  description: 'Explore all the features of Anytime Markdown — Mermaid diagrams, PlantUML preview, KaTeX math, diff comparison, merge, table editor, and more. | Anytime Markdownの全機能。Mermaid/PlantUML図解作成、KaTeX数式、差分比較(diff)、マージ(merge)、表編集、VSCode拡張。設計書・仕様書作成に最適。',
  alternates: {
    canonical: '/features',
  },
  openGraph: {
    title: 'Features - Anytime Markdown',
    description: 'Mermaid diagrams, PlantUML preview, KaTeX math, diff comparison, merge, table editor, and more.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Features - Anytime Markdown',
    description: 'Mermaid diagrams, PlantUML preview, KaTeX math, diff comparison, merge, table editor, and more.',
  },
};

export default function FeaturesPage() {
  return <FeaturesBody />;
}
