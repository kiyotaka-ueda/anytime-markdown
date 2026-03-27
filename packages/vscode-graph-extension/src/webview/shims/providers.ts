type ThemeMode = 'light' | 'dark';

export function useThemeMode(): { themeMode: ThemeMode; setThemeMode: (mode: ThemeMode) => void } {
  const isDark = document.body.getAttribute('data-vscode-theme-kind')?.includes('dark') ?? true;
  return { themeMode: isDark ? 'dark' : 'light', setThemeMode: () => {} };
}
