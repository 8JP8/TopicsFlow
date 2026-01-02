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
  onHide?: (messageId: string) => void;
  canDelete?: boolean;
  content?: string;
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
  onHide,
  canDelete = false,
  content,
}) => {
  const { t } = useLanguage();
  const items: ContextMenuItem[] = [
    {
      label: t('contextMenu.copyText') || 'Copy Text',
      action: async () => {
        const selection = window.getSelection()?.toString();
        const textToCopy = selection || content;
        if (textToCopy) {
          try {
            await navigator.clipboard.writeText(textToCopy);
          } catch (err) {
            console.error('Failed to copy', err);
          }
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
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
    {
      label: t('settings.hideForMe') || 'Hide for me',
      action: () => {
        if (onHide) {
          onHide(messageId);
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
        </svg>
      ),
      disabled: !onHide,
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

