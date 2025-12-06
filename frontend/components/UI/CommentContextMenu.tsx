import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ContextMenu from './ContextMenu';

interface CommentContextMenuProps {
  commentId: string;
  x: number;
  y: number;
  onClose: () => void;
  onReport?: (commentId: string) => void;
}

const CommentContextMenu: React.FC<CommentContextMenuProps> = ({
  commentId,
  x,
  y,
  onClose,
  onReport,
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
  ];

  return <ContextMenu items={items} onClose={onClose} x={x} y={y} />;
};

export default CommentContextMenu;




