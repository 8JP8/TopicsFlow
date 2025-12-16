import React from 'react';
import { getCountryFlagUrl, getCountryName } from '@/utils/countries';
import { useLanguage } from '@/contexts/LanguageContext';

interface CountryFlagProps {
    countryCode: string;
    size?: 'sm' | 'md' | 'lg';
    showName?: boolean;
    className?: string;
}

/**
 * Country flag component using flagcdn.com images
 * Works on all platforms including Windows where emoji flags don't display
 */
const CountryFlag: React.FC<CountryFlagProps> = ({
    countryCode,
    size = 'md',
    showName = false,
    className = '',
}) => {
    const { language } = useLanguage();

    if (!countryCode || countryCode.length !== 2) {
        return null;
    }

    const sizeConfig = {
        sm: { width: 16, height: 12, flagSize: 'w20' as const },
        md: { width: 20, height: 15, flagSize: 'w40' as const },
        lg: { width: 28, height: 21, flagSize: 'w40' as const },
    };

    const { width, height, flagSize } = sizeConfig[size];
    const flagUrl = getCountryFlagUrl(countryCode, flagSize);
    const countryName = getCountryName(countryCode, language as 'en' | 'pt');

    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            <img
                src={flagUrl}
                alt={countryName}
                width={width}
                height={height}
                className="inline-block rounded-sm shadow-sm"
                style={{ minWidth: width }}
                loading="lazy"
            />
            {showName && (
                <span className="text-sm theme-text-secondary">{countryName}</span>
            )}
        </span>
    );
};

export default CountryFlag;
