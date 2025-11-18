// Standalone translation utility for use in non-React contexts (e.g., api.ts)
import enTranslations from '@/locales/en.json';
import ptTranslations from '@/locales/pt.json';

type Language = 'en' | 'pt';
type Translations = typeof enTranslations;

const translations: Record<Language, Translations> = {
  en: enTranslations,
  pt: ptTranslations,
};

// Get current language from localStorage (defaults to 'en')
const getCurrentLanguage = (): Language => {
  if (typeof window === 'undefined') {
    return 'en';
  }
  const savedLanguage = localStorage.getItem('preferredLanguage') as Language | null;
  if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'pt')) {
    return savedLanguage;
  }
  // Detect browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('pt')) {
    return 'pt';
  }
  return 'en';
};

// Translation function with dot notation support (e.g., "toast.serverError")
export const translate = (key: string, params?: Record<string, string | number>): string => {
  const language = getCurrentLanguage();
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

