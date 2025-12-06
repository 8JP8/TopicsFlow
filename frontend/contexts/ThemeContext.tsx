import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // During SSR, return a safe default instead of throwing
    if (typeof window === 'undefined') {
      return {
        theme: 'dark' as Theme,
        toggleTheme: () => { },
        setTheme: () => { },
      } as ThemeContextType;
    }
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { user, updatePreferences } = useAuth();
  // Always start with 'dark' during SSR to prevent hydration mismatch
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage, then user preferences, then system
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setMounted(true);

    // Check localStorage first
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
      setThemeState(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
      // Ensure the class is toggled correctly for Tailwind dark mode
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      return;
    }

    // Then check user preferences from backend
    if (user?.preferences.theme) {
      setThemeState(user.preferences.theme);
      document.documentElement.setAttribute('data-theme', user.preferences.theme);
      document.documentElement.classList.toggle('dark', user.preferences.theme === 'dark');
    } else {
      // Finally check system preference
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setThemeState(systemPreference);
      document.documentElement.setAttribute('data-theme', systemPreference);
      document.documentElement.classList.toggle('dark', systemPreference === 'dark');
    }
  }, [user]);

  // Apply theme to document whenever it changes (after mount)
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  }, [theme, mounted]);

  // Listen for system theme changes (only if no manual preference)
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only apply system theme if user hasn't set a preference in localStorage or backend
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme && !user?.preferences.theme) {
        const newTheme = e.matches ? 'dark' : 'light';
        setThemeState(newTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [user, mounted]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    // Note: We intentionally DO NOT update backend preferences here.
    // Quick toggle should only affect local device state via localStorage.
    // Persistent backend updates are handled in specific settings page actions.
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};