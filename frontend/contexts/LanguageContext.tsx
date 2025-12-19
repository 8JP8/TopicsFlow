import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import enTranslations from '@/locales/en.json';
import ptTranslations from '@/locales/pt.json';

type Language = 'en' | 'pt';

type Translations = typeof enTranslations;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  translations: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Translations> = {
  en: enTranslations,
  pt: ptTranslations,
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('pt');
  const [mounted, setMounted] = useState(false);

  // Load language from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMounted(true);

      const savedLanguage = localStorage.getItem('preferredLanguage') as Language | null;
      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'pt')) {
        setLanguageState(savedLanguage);
      } else {
        // Detect browser language - prioritize PT, fallback to EN only if explicitly EN
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('en')) {
          setLanguageState('en');
        } else {
          setLanguageState('pt');
        }
      }
    }
  }, []);

  // Save language to localStorage whenever it changes
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLanguage', lang);
    }
  };

  // Translation function with dot notation support (e.g., "auth.login")
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    // Navigate through nested keys
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = translations.en;
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            console.warn(`Translation key not found: ${key}`);
            return key; // Return the key itself if not found
          }
        }
        break;
      }
    }

    // If value is a string and params provided, replace placeholders
    if (typeof value === 'string' && params) {
      return Object.keys(params).reduce((str, param) => {
        return str.replace(new RegExp(`\\{${param}\\}`, 'g'), String(params[param]));
      }, value);
    }

    return typeof value === 'string' ? value : key;
  };

  // Always provide context value, even when not mounted (use default 'en')
  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    translations: translations[language],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
