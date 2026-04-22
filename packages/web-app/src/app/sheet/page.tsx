'use client';

import { Box } from '@mui/material';
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <LandingHeader />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SpreadsheetEditor themeMode={themeMode} />
      </Box>
    </Box>
  );
}
