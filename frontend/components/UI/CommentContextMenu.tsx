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
}

const CommentContextMenu: React.FC<CommentContextMenuProps> = ({
  commentId,
  x,
  y,
  onClose,
  onReport,
  onHide,
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

  return <ContextMenu items={items} onClose={onClose} x={x} y={y} />;
};

export default CommentContextMenu;





