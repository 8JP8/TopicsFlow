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
        toggleTheme: () => {},
        setTheme: () => {},
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

  // Initialize theme from user preferences or system preference (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setMounted(true);
    
    // Apply theme to document immediately to prevent flash
    if (user?.preferences.theme) {
      setThemeState(user.preferences.theme);
      document.documentElement.setAttribute('data-theme', user.preferences.theme);
    } else {
      // Check system preference
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setThemeState(systemPreference);
      document.documentElement.setAttribute('data-theme', systemPreference);
    }
  }, [user]);

  // Apply theme to document whenever it changes (after mount)
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, mounted]);

  // Listen for system theme changes (only after mount)
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only apply system theme if user hasn't set a preference
      if (!user?.preferences.theme) {
        setThemeState(e.matches ? 'dark' : 'light');
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

    // Update user preferences if authenticated
    if (user) {
      updatePreferences({ theme: newTheme });
    }
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};