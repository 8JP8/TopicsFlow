import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface UserBadgesProps {
  isFromMe?: boolean;
  isAdmin?: boolean;
  isOwner?: boolean;
  isModerator?: boolean;
  isAnonymous?: boolean;
  className?: string;
}

const UserBadges: React.FC<UserBadgesProps> = ({
  isFromMe = false,
  isAdmin = false,
  isOwner = false,
  isModerator = false,
  isAnonymous = false,
  className = '',
}) => {
  const { t } = useLanguage();

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {isFromMe && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
          {t('common.you') || 'Você'}
        </span>
      )}
      {isAdmin && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
          {t('chat.admin') || 'Admin'}
        </span>
      )}
      {isOwner && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
          {t('chat.owner') || 'Criador'}
        </span>
      )}
      {isModerator && !isOwner && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
          {t('chat.moderator') || 'Moderador'}
        </span>
      )}
      {isAnonymous && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          {t('chat.anonymous') || 'Anónimo'}
        </span>
      )}
    </div>
  );
};

export default UserBadges;

