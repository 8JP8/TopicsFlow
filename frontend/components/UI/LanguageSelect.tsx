import React, { useEffect, useMemo, useRef, useState } from 'react';
import CountryFlag from '@/components/UI/CountryFlag';

type LanguageCode = 'en' | 'pt';

const LANG_OPTIONS: Array<{ code: LanguageCode; label: string; flagCountry: string }> = [
  { code: 'en', label: 'English', flagCountry: 'US' },
  { code: 'pt', label: 'Português', flagCountry: 'PT' },
];

interface LanguageSelectProps {
  value: LanguageCode;
  onChange: (lang: LanguageCode) => void;
  className?: string;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({ value, onChange, className = '' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => LANG_OPTIONS.find(o => o.code === value) ?? LANG_OPTIONS[0], [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary flex items-center justify-between gap-3"
      >
        <span className="flex items-center gap-2 min-w-0">
          <CountryFlag countryCode={selected.flagCountry} size="sm" />
          <span className="truncate">{selected.label}</span>
        </span>
        <svg className="w-5 h-5 theme-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 theme-bg-secondary theme-border rounded-lg shadow-lg overflow-hidden">
          {LANG_OPTIONS.map(opt => (
            <button
              key={opt.code}
              type="button"
              onClick={() => {
                onChange(opt.code);
                setOpen(false);
              }}
              className={`w-full px-4 py-2 text-left hover:theme-bg-hover flex items-center gap-2 transition-colors ${opt.code === value ? 'theme-bg-tertiary' : ''}`}
            >
              <CountryFlag countryCode={opt.flagCountry} size="sm" />
              <span className="theme-text-primary">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelect;


