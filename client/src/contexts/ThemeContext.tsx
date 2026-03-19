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
    const darkBg = '#060b14';
    const root = document.getElementById('root');
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.body.classList.add('theme-light');
      // Apply filter to #root div (NOT html/body) — on Android Chrome TWA the html/body
      // "canvas" background is rendered natively outside the filter compositing layer,
      // so the inversion never reaches it. A regular div's background IS part of its
      // own painted box and IS inverted by the filter.
      if (root) {
        root.style.filter = 'invert(1) hue-rotate(180deg)';
        root.style.background = darkBg;
      }
      document.documentElement.style.background = darkBg;
      document.body.style.background = darkBg;
    } else {
      document.documentElement.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
      if (root) {
        root.style.filter = '';
        root.style.background = '';
      }
      document.documentElement.style.background = darkBg;
      document.body.style.background = darkBg;
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
