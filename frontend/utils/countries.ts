// Country utilities with flag images and localized names
// Uses flagcdn.com for SVG flags that work on all platforms including Windows

export interface Country {
    code: string;  // ISO 3166-1 alpha-2
    name: {
        en: string;
        pt: string;
    };
}

// Comprehensive list of countries with localized names
export const COUNTRIES: Country[] = [
    { code: 'AF', name: { en: 'Afghanistan', pt: 'Afeganistão' } },
    { code: 'AL', name: { en: 'Albania', pt: 'Albânia' } },
    { code: 'DZ', name: { en: 'Algeria', pt: 'Argélia' } },
    { code: 'AD', name: { en: 'Andorra', pt: 'Andorra' } },
    { code: 'AO', name: { en: 'Angola', pt: 'Angola' } },
    { code: 'AR', name: { en: 'Argentina', pt: 'Argentina' } },
    { code: 'AM', name: { en: 'Armenia', pt: 'Arménia' } },
    { code: 'AU', name: { en: 'Australia', pt: 'Austrália' } },
    { code: 'AT', name: { en: 'Austria', pt: 'Áustria' } },
    { code: 'AZ', name: { en: 'Azerbaijan', pt: 'Azerbaijão' } },
    { code: 'BS', name: { en: 'Bahamas', pt: 'Bahamas' } },
    { code: 'BH', name: { en: 'Bahrain', pt: 'Bahrein' } },
    { code: 'BD', name: { en: 'Bangladesh', pt: 'Bangladesh' } },
    { code: 'BY', name: { en: 'Belarus', pt: 'Bielorrússia' } },
    { code: 'BE', name: { en: 'Belgium', pt: 'Bélgica' } },
    { code: 'BR', name: { en: 'Brazil', pt: 'Brasil' } },
    { code: 'BG', name: { en: 'Bulgaria', pt: 'Bulgária' } },
    { code: 'CA', name: { en: 'Canada', pt: 'Canadá' } },
    { code: 'CL', name: { en: 'Chile', pt: 'Chile' } },
    { code: 'CN', name: { en: 'China', pt: 'China' } },
    { code: 'CO', name: { en: 'Colombia', pt: 'Colômbia' } },
    { code: 'HR', name: { en: 'Croatia', pt: 'Croácia' } },
    { code: 'CU', name: { en: 'Cuba', pt: 'Cuba' } },
    { code: 'CY', name: { en: 'Cyprus', pt: 'Chipre' } },
    { code: 'CZ', name: { en: 'Czech Republic', pt: 'República Checa' } },
    { code: 'DK', name: { en: 'Denmark', pt: 'Dinamarca' } },
    { code: 'EG', name: { en: 'Egypt', pt: 'Egito' } },
    { code: 'EE', name: { en: 'Estonia', pt: 'Estónia' } },
    { code: 'FI', name: { en: 'Finland', pt: 'Finlândia' } },
    { code: 'FR', name: { en: 'France', pt: 'França' } },
    { code: 'DE', name: { en: 'Germany', pt: 'Alemanha' } },
    { code: 'GR', name: { en: 'Greece', pt: 'Grécia' } },
    { code: 'HK', name: { en: 'Hong Kong', pt: 'Hong Kong' } },
    { code: 'HU', name: { en: 'Hungary', pt: 'Hungria' } },
    { code: 'IS', name: { en: 'Iceland', pt: 'Islândia' } },
    { code: 'IN', name: { en: 'India', pt: 'Índia' } },
    { code: 'ID', name: { en: 'Indonesia', pt: 'Indonésia' } },
    { code: 'IR', name: { en: 'Iran', pt: 'Irão' } },
    { code: 'IQ', name: { en: 'Iraq', pt: 'Iraque' } },
    { code: 'IE', name: { en: 'Ireland', pt: 'Irlanda' } },
    { code: 'IL', name: { en: 'Israel', pt: 'Israel' } },
    { code: 'IT', name: { en: 'Italy', pt: 'Itália' } },
    { code: 'JP', name: { en: 'Japan', pt: 'Japão' } },
    { code: 'KZ', name: { en: 'Kazakhstan', pt: 'Cazaquistão' } },
    { code: 'KE', name: { en: 'Kenya', pt: 'Quénia' } },
    { code: 'KR', name: { en: 'South Korea', pt: 'Coreia do Sul' } },
    { code: 'KW', name: { en: 'Kuwait', pt: 'Kuwait' } },
    { code: 'LV', name: { en: 'Latvia', pt: 'Letónia' } },
    { code: 'LB', name: { en: 'Lebanon', pt: 'Líbano' } },
    { code: 'LT', name: { en: 'Lithuania', pt: 'Lituânia' } },
    { code: 'LU', name: { en: 'Luxembourg', pt: 'Luxemburgo' } },
    { code: 'MY', name: { en: 'Malaysia', pt: 'Malásia' } },
    { code: 'MX', name: { en: 'Mexico', pt: 'México' } },
    { code: 'MA', name: { en: 'Morocco', pt: 'Marrocos' } },
    { code: 'NL', name: { en: 'Netherlands', pt: 'Países Baixos' } },
    { code: 'NZ', name: { en: 'New Zealand', pt: 'Nova Zelândia' } },
    { code: 'NG', name: { en: 'Nigeria', pt: 'Nigéria' } },
    { code: 'NO', name: { en: 'Norway', pt: 'Noruega' } },
    { code: 'PK', name: { en: 'Pakistan', pt: 'Paquistão' } },
    { code: 'PH', name: { en: 'Philippines', pt: 'Filipinas' } },
    { code: 'PL', name: { en: 'Poland', pt: 'Polónia' } },
    { code: 'PT', name: { en: 'Portugal', pt: 'Portugal' } },
    { code: 'QA', name: { en: 'Qatar', pt: 'Catar' } },
    { code: 'RO', name: { en: 'Romania', pt: 'Roménia' } },
    { code: 'RU', name: { en: 'Russia', pt: 'Rússia' } },
    { code: 'SA', name: { en: 'Saudi Arabia', pt: 'Arábia Saudita' } },
    { code: 'RS', name: { en: 'Serbia', pt: 'Sérvia' } },
    { code: 'SG', name: { en: 'Singapore', pt: 'Singapura' } },
    { code: 'SK', name: { en: 'Slovakia', pt: 'Eslováquia' } },
    { code: 'SI', name: { en: 'Slovenia', pt: 'Eslovénia' } },
    { code: 'ZA', name: { en: 'South Africa', pt: 'África do Sul' } },
    { code: 'ES', name: { en: 'Spain', pt: 'Espanha' } },
    { code: 'SE', name: { en: 'Sweden', pt: 'Suécia' } },
    { code: 'CH', name: { en: 'Switzerland', pt: 'Suíça' } },
    { code: 'TW', name: { en: 'Taiwan', pt: 'Taiwan' } },
    { code: 'TH', name: { en: 'Thailand', pt: 'Tailândia' } },
    { code: 'TR', name: { en: 'Turkey', pt: 'Turquia' } },
    { code: 'UA', name: { en: 'Ukraine', pt: 'Ucrânia' } },
    { code: 'AE', name: { en: 'United Arab Emirates', pt: 'Emirados Árabes Unidos' } },
    { code: 'GB', name: { en: 'United Kingdom', pt: 'Reino Unido' } },
    { code: 'US', name: { en: 'United States', pt: 'Estados Unidos' } },
    { code: 'VN', name: { en: 'Vietnam', pt: 'Vietname' } },
];

/**
 * Get country flag image URL from flagcdn.com
 * These are SVG images that work on all platforms including Windows
 */
export const getCountryFlagUrl = (countryCode: string, size: 'w20' | 'w40' | 'w80' | 'w160' = 'w40'): string => {
    if (!countryCode || countryCode.length !== 2) return '';
    return `https://flagcdn.com/${size}/${countryCode.toLowerCase()}.png`;
};

/**
 * Get country flag as SVG URL (better quality)
 */
export const getCountryFlagSvgUrl = (countryCode: string): string => {
    if (!countryCode || countryCode.length !== 2) return '';
    return `https://flagcdn.com/${countryCode.toLowerCase()}.svg`;
};

/**
 * Get country name by code and language
 */
export const getCountryName = (countryCode: string, language: 'en' | 'pt' = 'en'): string => {
    if (!countryCode) return '';
    const country = COUNTRIES.find(c => c.code.toUpperCase() === countryCode.toUpperCase());
    return country ? country.name[language] : countryCode;
};

/**
 * Get country by code
 */
export const getCountryByCode = (countryCode: string): Country | undefined => {
    if (!countryCode) return undefined;
    return COUNTRIES.find(c => c.code.toUpperCase() === countryCode.toUpperCase());
};

/**
 * Search countries by name (supports both languages)
 */
export const searchCountries = (query: string, language: 'en' | 'pt' = 'en'): Country[] => {
    if (!query) return COUNTRIES;
    const lowerQuery = query.toLowerCase();
    return COUNTRIES.filter(
        c => c.name.en.toLowerCase().includes(lowerQuery) ||
            c.name.pt.toLowerCase().includes(lowerQuery) ||
            c.code.toLowerCase().includes(lowerQuery)
    );
};
