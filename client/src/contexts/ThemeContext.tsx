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

    // Clean up any leftover inline styles set by previous filter-based approaches
    html.style.removeProperty('filter');
    html.style.removeProperty('background');
    html.style.removeProperty('background-color');
    document.body.style.removeProperty('filter');
    document.body.style.removeProperty('background');
    document.body.style.removeProperty('background-color');
    const root = document.getElementById('root');
    if (root) {
      root.style.removeProperty('filter');
      root.style.removeProperty('background');
    }

    if (theme === 'light') {
      html.classList.add('theme-light');
      document.body.classList.add('theme-light');
    } else {
      html.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
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
