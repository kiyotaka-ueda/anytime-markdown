import { createContext, useCallback, useContext } from 'react';

import { en } from './en';
import { ja } from './ja';
import type { TrailI18n, TrailLocale } from './types';

interface TrailLocaleContextValue {
  readonly t: (key: keyof TrailI18n) => string;
}

const TrailLocaleContext = createContext<TrailLocaleContextValue>({
  t: (key) => en[key],
});

export function TrailLocaleProvider({
  locale = 'en',
  children,
}: Readonly<{ locale?: TrailLocale; children: React.ReactNode }>) {
  const translations = locale === 'ja' ? ja : en;
  const t = useCallback((key: keyof TrailI18n) => translations[key], [translations]);
  return (
    <TrailLocaleContext.Provider value={{ t }}>
      {children}
    </TrailLocaleContext.Provider>
  );
}

export function useTrailI18n(): TrailLocaleContextValue {
  return useContext(TrailLocaleContext);
}
