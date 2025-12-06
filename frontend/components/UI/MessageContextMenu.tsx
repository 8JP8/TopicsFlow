import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ContextMenu from './ContextMenu';

interface ContextMenuItem {
  label: string;
  action: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

interface MessageContextMenuProps {
  messageId: string;
  userId?: string;
  username?: string;
  x: number;
  y: number;
  onClose: () => void;
  onReportMessage?: (messageId: string, userId?: string, username?: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onReportUser?: (messageId: string, userId: string, username: string) => void;
  canDelete?: boolean;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  messageId,
  userId,
  username,
  x,
  y,
  onClose,
  onReportMessage,
  onDeleteMessage,
  onReportUser,
  canDelete = false,
}) => {
  const { t } = useLanguage();
  const items: ContextMenuItem[] = [
    {
      label: t('contextMenu.reportMessage') || 'Report Message',
      action: () => {
        if (onReportMessage) {
          onReportMessage(messageId, userId, username);
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      disabled: !onReportMessage,
    },
  ];

  // Add report user option if userId is available
  if (userId && username && onReportUser) {
    items.push({
      label: t('contextMenu.reportUser') || 'Report User',
      action: () => {
        onReportUser(messageId, userId, username);
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      disabled: false,
    });
  }

  // Add delete option if user can delete
  if (canDelete && onDeleteMessage) {
    items.push({
      label: t('contextMenu.deleteMessage') || 'Delete Message',
      action: () => {
        onDeleteMessage(messageId);
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      danger: true,
    });
  }

  return <ContextMenu items={items} onClose={onClose} x={x} y={y} />;
};

export default MessageContextMenu;

