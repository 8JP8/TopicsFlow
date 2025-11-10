import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Language {
  code: 'en' | 'pt';
  name: string;
  flag: string;
}

const languages: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
];

const LanguageToggle: React.FC = () => {
  const { user, updatePreferences } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = user?.preferences.language || 'en';
  const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];

  const handleLanguageChange = async (language: Language) => {
    setIsOpen(false);
    await updatePreferences({ language: language.code });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors"
        aria-label="Select language"
      >
        <span className="text-lg">{currentLang.flag}</span>
        <span className="text-sm font-medium theme-text-primary hidden sm:block">
          {currentLang.name}
        </span>
        <svg
          className={`w-4 h-4 theme-text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-48 theme-bg-secondary border theme-border rounded-lg shadow-lg z-20">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language)}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:theme-bg-tertiary transition-colors ${
                  language.code === currentLanguage ? 'theme-bg-tertiary' : ''
                } first:rounded-t-lg last:rounded-b-lg`}
              >
                <span className="text-lg">{language.flag}</span>
                <span className="theme-text-primary">{language.name}</span>
                {language.code === currentLanguage && (
                  <svg
                    className="w-4 h-4 theme-blue-primary ml-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageToggle;