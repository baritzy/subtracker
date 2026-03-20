import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme_v2');
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const html = document.documentElement;

    // Remove leftover inline styles from previous approaches
    html.style.removeProperty('filter');
    document.body.style.removeProperty('filter');
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.style.removeProperty('filter');

    if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
      // Also set inline vars as a belt-and-suspenders for Android WebView
      const vars: [string, string][] = [
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
        ['--text-logo', '#f1f5f9'],
        ['--border-header', 'rgba(255,255,255,0.06)'],
        ['--btn-icon-bg', 'rgba(255,255,255,0.05)'],
        ['--btn-icon-border', 'rgba(255,255,255,0.1)'],
      ];
      for (const [k, v] of vars) {
        html.style.setProperty(k, v);
        document.body.style.setProperty(k, v);
      }
      html.style.backgroundColor = '#060b14';
      document.body.style.backgroundColor = '#060b14';
    } else {
      html.removeAttribute('data-theme');
      const vars: [string, string][] = [
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
        ['--text-logo', '#0f172a'],
        ['--border-header', 'rgba(0,0,0,0.08)'],
        ['--btn-icon-bg', 'rgba(0,0,0,0.06)'],
        ['--btn-icon-border', 'rgba(0,0,0,0.1)'],
      ];
      for (const [k, v] of vars) {
        html.style.setProperty(k, v);
        document.body.style.setProperty(k, v);
      }
      html.style.backgroundColor = '#f1f5f9';
      document.body.style.backgroundColor = '#f1f5f9';
    }

    localStorage.setItem('theme_v2', theme);
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
