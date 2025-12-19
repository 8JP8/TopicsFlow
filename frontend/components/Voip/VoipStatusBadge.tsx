import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface VoipStatusBadgeProps {
    participantCount: number;
    isActive: boolean;
    className?: string;
}

const VoipStatusBadge: React.FC<VoipStatusBadgeProps> = ({
    participantCount,
    isActive,
    className = ''
}) => {
    const { t } = useLanguage();

    if (!isActive) return null;

    return (
        <div
            className={`
        inline-flex items-center gap-1 px-2 py-0.5 
        bg-green-500/20 text-green-400 
        rounded-full text-xs font-medium
        ${className}
      `}
            title={t('voip.participantsInCall', { count: participantCount }) || `${participantCount} in call`}
        >
            <svg className="w-3 h-3 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
            <span>{participantCount}</span>
        </div>
    );
};

export default VoipStatusBadge;
