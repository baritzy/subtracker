import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const html = document.documentElement;

    // Remove any leftover inline styles from previous approaches
    html.style.removeProperty('filter');
    document.body.style.removeProperty('filter');
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.style.removeProperty('filter');

    if (theme === 'light') {
      html.classList.add('theme-light');
      document.body.classList.add('theme-light');
      // Set CSS variables on both html and body for Android TWA compatibility
      const lightVars: [string, string][] = [
        ['--bg-page', '#f1f5f9'],
        ['--bg-gradient', 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.07), transparent)'],
        ['--bg-header', 'rgba(241,245,249,0.92)'],
        ['--bg-card', 'rgba(0,0,0,0.04)'],
        ['--bg-card-hover', 'rgba(0,0,0,0.07)'],
        ['--border', 'rgba(0,0,0,0.09)'],
        ['--border-faint', 'rgba(0,0,0,0.05)'],
        ['--text-1', '#0f172a'],
        ['--text-2', '#1e293b'],
        ['--text-3', '#475569'],
        ['--text-4', '#64748b'],
      ];
      for (const [k, v] of lightVars) {
        html.style.setProperty(k, v);
        document.body.style.setProperty(k, v);
      }
      // Force background directly — bypasses any cascade issue in Android WebView
      html.style.backgroundColor = '#f1f5f9';
      document.body.style.backgroundColor = '#f1f5f9';
      // Tell Chrome not to apply its own Force Dark Mode filter
      html.style.colorScheme = 'light';
    } else {
      html.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
      const darkVars: [string, string][] = [
        ['--bg-page', '#060b14'],
        ['--bg-gradient', 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.14), transparent)'],
        ['--bg-header', 'rgba(6,11,20,0.88)'],
        ['--bg-card', 'rgba(255,255,255,0.03)'],
        ['--bg-card-hover', 'rgba(255,255,255,0.05)'],
        ['--border', 'rgba(255,255,255,0.08)'],
        ['--border-faint', 'rgba(255,255,255,0.05)'],
        ['--text-1', '#f1f5f9'],
        ['--text-2', '#e2e8f0'],
        ['--text-3', '#94a3b8'],
        ['--text-4', '#64748b'],
      ];
      for (const [k, v] of darkVars) {
        html.style.setProperty(k, v);
        document.body.style.setProperty(k, v);
      }
      // Force background directly
      html.style.backgroundColor = '#060b14';
      document.body.style.backgroundColor = '#060b14';
      // Tell Chrome we're handling dark mode ourselves
      html.style.colorScheme = 'dark';
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
