'use client';

import type { DocLink } from '@anytime-markdown/trail-core/c4';
import { TrailViewerApp } from '@anytime-markdown/trail-viewer';
import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

import { useLocaleSwitch } from '../../LocaleProvider';
import { useThemeMode } from '../../providers';
import { TrailErrorBoundary } from './TrailErrorBoundary';

/**
 * web アプリの Trail Viewer ラッパー。
 *
 * 共通の TrailViewerApp に同居 Next.js API ルート（serverUrl=''）を渡すだけのシェル。
 * editable は true（グループ機能などの編集操作を有効化）。doc link は新規タブで開く。
 */
export function TrailViewer({
  containerHeight = 'calc(100vh - 64px)',
  initialTab: initialTabProp,
}: Readonly<{ containerHeight?: string; initialTab?: number }> = {}) {
  const { themeMode } = useThemeMode();
  const isDark = themeMode === 'dark';
  const { locale } = useLocaleSwitch();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const initialTab = initialTabProp ?? (tabParam !== null ? Number(tabParam) : undefined);

  const c4LevelParam = searchParams.get('c4level');
  const initialC4Level = c4LevelParam !== null ? Number(c4LevelParam) : undefined;

  const handleDocLinkClick = useCallback((doc: DocLink) => {
    globalThis.open(`/docs/view?ghPath=${encodeURIComponent(doc.path)}`, '_blank');
  }, []);

  return (
    <TrailErrorBoundary>
      <TrailViewerApp
        serverUrl=""
        editable
        isDark={isDark}
        locale={locale}
        containerHeight={containerHeight}
        onDocLinkClick={handleDocLinkClick}
        initialTab={initialTab}
        initialC4Level={initialC4Level}
      />
    </TrailErrorBoundary>
  );
}
