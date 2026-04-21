'use client';

import dynamic from 'next/dynamic';

import { useLocaleSwitch } from '../LocaleProvider';
import { useThemeMode } from '../providers';

const GraphEditor = dynamic(
  () => import('@anytime-markdown/graph-viewer').then(m => ({ default: m.GraphEditor })),
  { ssr: false },
);

export default function GraphPage() {
  const { themeMode, setThemeMode } = useThemeMode();
  const { locale, setLocale } = useLocaleSwitch();
  return (
    <GraphEditor
      themeMode={themeMode}
      onThemeModeChange={setThemeMode}
      locale={locale}
      onLocaleChange={setLocale}
    />
  );
}
