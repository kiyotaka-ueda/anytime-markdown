import type { Metadata } from 'next';
import LandingPage from './components/LandingPage';

export const metadata: Metadata = {
  title: 'Anytime Markdown - Write Markdown, Beautifully',
  description:
    'Free browser-based WYSIWYG Markdown editor. Mermaid diagrams, PlantUML preview, KaTeX math, diff comparison, merge, table editor, and code blocks. VSCode extension available. No sign-up, no install required. | 無料のブラウザ対応 WYSIWYG マークダウン エディタ。Mermaid/PlantUML図解作成、KaTeX数式、マークダウン差分(diff)、マージ(merge)、表編集、コードブロック、VSCode拡張対応。設計書・仕様書作成に最適なエンジニア ツール。登録不要・インストール不要。',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Anytime Markdown - Write Markdown, Beautifully',
    description:
      'Free WYSIWYG Markdown editor with Mermaid, PlantUML, KaTeX, diff, merge, table editor. No sign-up required.',
    type: 'website',
    siteName: 'Anytime Markdown',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anytime Markdown - Write Markdown, Beautifully',
    description:
      'Free WYSIWYG Markdown editor with Mermaid, PlantUML, KaTeX, diff, merge, table editor. No sign-up required.',
  },
};

export default function Page() {
  return <LandingPage />;
}
