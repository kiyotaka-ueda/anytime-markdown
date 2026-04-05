import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { createRoot } from 'react-dom/client';

import { C4Viewer } from '../../../../web-app/src/app/modeling/components/C4Viewer';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <C4Viewer serverUrl={globalThis.location.origin} />
    </ThemeProvider>,
  );
}
