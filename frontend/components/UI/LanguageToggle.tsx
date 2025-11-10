import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

const LanguageToggle: React.FC = () => {
  const { user, updatePreferences } = useAuth();

  const currentLanguage = user?.preferences.language || 'en';

  const toggleLanguage = async () => {
    const newLanguage = currentLanguage === 'en' ? 'pt' : 'en';
    await updatePreferences({ language: newLanguage });
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center space-x-2 px-3 py-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors"
      aria-label="Toggle language"
      title={currentLanguage === 'en' ? 'Mudar para Português' : 'Switch to English'}
    >
      <svg className="w-4 h-4 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
      <span className="text-sm font-semibold theme-text-primary">
        {currentLanguage === 'en' ? 'EN' : 'PT'}
      </span>
    </button>
  );
};

export default LanguageToggle;