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
      // Set CSS variables directly — most reliable on Android TWA
      html.style.setProperty('--bg-page', '#f1f5f9');
      html.style.setProperty('--bg-gradient', 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.07), transparent)');
      html.style.setProperty('--bg-header', 'rgba(241,245,249,0.92)');
      html.style.setProperty('--bg-card', 'rgba(0,0,0,0.04)');
      html.style.setProperty('--bg-card-hover', 'rgba(0,0,0,0.07)');
      html.style.setProperty('--border', 'rgba(0,0,0,0.09)');
      html.style.setProperty('--border-faint', 'rgba(0,0,0,0.05)');
      html.style.setProperty('--text-1', '#0f172a');
      html.style.setProperty('--text-2', '#1e293b');
      html.style.setProperty('--text-3', '#475569');
      html.style.setProperty('--text-4', '#64748b');
    } else {
      html.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
      // Restore dark defaults
      html.style.setProperty('--bg-page', '#060b14');
      html.style.setProperty('--bg-gradient', 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.14), transparent)');
      html.style.setProperty('--bg-header', 'rgba(6,11,20,0.88)');
      html.style.setProperty('--bg-card', 'rgba(255,255,255,0.03)');
      html.style.setProperty('--bg-card-hover', 'rgba(255,255,255,0.05)');
      html.style.setProperty('--border', 'rgba(255,255,255,0.08)');
      html.style.setProperty('--border-faint', 'rgba(255,255,255,0.05)');
      html.style.setProperty('--text-1', '#f1f5f9');
      html.style.setProperty('--text-2', '#e2e8f0');
      html.style.setProperty('--text-3', '#94a3b8');
      html.style.setProperty('--text-4', '#64748b');
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
