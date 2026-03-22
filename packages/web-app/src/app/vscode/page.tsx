import type { Metadata } from 'next';

import LandingPage from '../components/LandingPage';

export const metadata: Metadata = {
  title: 'Web App - Anytime Markdown',
  description:
    'Free browser-based WYSIWYG Markdown editor. Mermaid diagrams, PlantUML preview, KaTeX math, diff comparison, merge, table editor, and code blocks. No sign-up, no install required. | 無料のブラウザ対応 WYSIWYG マークダウン エディタ。登録不要・インストール不要。',
  alternates: { canonical: '/vscode' },
  openGraph: {
    title: 'Web App - Anytime Markdown',
    description: 'Free WYSIWYG Markdown editor with Mermaid, PlantUML, KaTeX, diff, merge, table editor. No sign-up required.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Web App - Anytime Markdown',
    description: 'Free WYSIWYG Markdown editor with Mermaid, PlantUML, KaTeX, diff, merge, table editor. No sign-up required.',
  },
};

export default function VsCodePage() {
  return <LandingPage />;
}
