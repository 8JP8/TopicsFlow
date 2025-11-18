import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ContextMenu from './ContextMenu';

interface UserContextMenuProps {
  userId: string;
  username: string;
  x: number;
  y: number;
  onClose: () => void;
  onSendMessage?: (userId: string, username: string) => void;
  onBlockUser?: (userId: string, username: string) => void;
  isBlocked?: boolean;
}

const UserContextMenu: React.FC<UserContextMenuProps> = ({
  userId,
  username,
  x,
  y,
  onClose,
  onSendMessage,
  onBlockUser,
  isBlocked = false,
}) => {
  const { t } = useLanguage();
  const items = [
    {
      label: t('userContextMenu.sendMessage'),
      action: () => {
        if (onSendMessage) {
          onSendMessage(userId, username);
        }
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      disabled: !onSendMessage,
    },
    {
      label: isBlocked ? t('userContextMenu.unblockUser') : t('userContextMenu.blockUser'),
      action: () => {
        if (onBlockUser) {
          onBlockUser(userId, username);
        }
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      danger: true,
      disabled: !onBlockUser,
    },
  ];

  return <ContextMenu items={items} onClose={onClose} x={x} y={y} />;
};

export default UserContextMenu;

