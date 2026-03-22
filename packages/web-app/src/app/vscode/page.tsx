import type { Metadata } from 'next';

import VsCodeBody from './VsCodeBody';

export const metadata: Metadata = {
  title: 'VS Code Extension - Anytime Markdown',
  description:
    'Rich Markdown editing in VS Code. WYSIWYG, AI diff highlighting, image annotation, and Git integration. | VS Code で Markdown をリッチに編集。',
  alternates: { canonical: '/vscode' },
  openGraph: {
    title: 'VS Code Extension - Anytime Markdown',
    description: 'Rich Markdown editing in VS Code. WYSIWYG, AI diff highlighting, image annotation, and Git integration.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VS Code Extension - Anytime Markdown',
    description: 'Rich Markdown editing in VS Code. WYSIWYG, AI diff highlighting, image annotation, and Git integration.',
  },
};

export default function VsCodePage() {
  return <VsCodeBody />;
}
