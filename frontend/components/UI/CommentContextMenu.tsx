import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ContextMenu from './ContextMenu';

interface CommentContextMenuProps {
  commentId: string;
  x: number;
  y: number;
  onClose: () => void;
  onReport?: (commentId: string) => void;
  onHide?: (commentId: string) => void;
  onReportUser?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
  authorId?: string;
  authorUsername?: string;
}

const CommentContextMenu: React.FC<CommentContextMenuProps> = ({
  commentId,
  x,
  y,
  onClose,
  onReport,
  onHide,
  onReportUser,
  onBlockUser,
  authorId,
  authorUsername,
}) => {
  const { t } = useLanguage();
  const items = [
    {
      label: t('comments.reportComment') || 'Report Comment',
      action: () => {
        if (onReport) {
          onReport(commentId);
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      disabled: !onReport,
    },
    {
      label: t('settings.hideForMe') || 'Hide for me',
      action: () => {
        if (onHide) {
          onHide(commentId);
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

  // User Actions (Report User, Block User)
  if (authorId && (onReportUser || onBlockUser)) {
    if (onReportUser) {
      items.push({
        label: t('contextMenu.reportUser') || 'Report User',
        action: () => {
          onReportUser(authorId);
          onClose();
        },
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flag w-4 h-4"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></svg>
        ),
        disabled: false
      });
    }
    if (onBlockUser) {
      items.push({
        label: t('userBanner.block') || 'Block User',
        action: () => {
          onBlockUser(authorId);
          onClose();
        },
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ban w-4 h-4"><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg>,
        disabled: false,
      });
    }
  }

  return <ContextMenu items={items} onClose={onClose} x={x} y={y} />;
};

export default CommentContextMenu;





