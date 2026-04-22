'use client';

import dynamic from 'next/dynamic';

import LandingHeader from '../components/LandingHeader';
import { useThemeMode } from '../providers';

const SpreadsheetEditor = dynamic(
  () => import('@anytime-markdown/spreadsheet-viewer').then(m => ({ default: m.SpreadsheetEditor })),
  { ssr: false },
);

export default function SheetPage() {
  const { themeMode } = useThemeMode();
  return (
    <>
      <LandingHeader />
      <SpreadsheetEditor themeMode={themeMode} />
    </>
  );
}
