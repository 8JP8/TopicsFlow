import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ContextMenu from './ContextMenu';

interface TopicContextMenuProps {
  topicId: string;
  topicTitle: string;
  x: number;
  y: number;
  onClose: () => void;
  onSilence?: (topicId: string) => void;
  onHide?: (topicId: string) => void;
  onDelete?: (topicId: string) => void;
  isSilenced?: boolean;
  isHidden?: boolean;
  isOwner?: boolean;
}

const TopicContextMenu: React.FC<TopicContextMenuProps> = ({
  topicId,
  topicTitle,
  x,
  y,
  onClose,
  onSilence,
  onHide,
  onDelete,
  isSilenced = false,
  isHidden = false,
  isOwner = false,
}) => {
  const { t } = useLanguage();
  const items = [
    {
      label: isSilenced ? (t('contextMenu.unsilenceTopic') || 'Unsilence Topic') : (t('contextMenu.silenceTopic') || 'Silence Topic'),
      action: () => {
        if (onSilence) {
          onSilence(topicId);
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      ),
      disabled: !onSilence,
    },
    {
      label: isHidden ? (t('contextMenu.unhideTopic') || 'Unhide Topic') : (t('contextMenu.hideTopic') || 'Hide Topic'),
      action: () => {
        if (onHide) {
          onHide(topicId);
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ),
      disabled: !onHide,
    },
  ];

  // Add delete option for owners
  if (isOwner && onDelete) {
    items.push({
      label: t('contextMenu.deleteTopic') || 'Delete Topic',
      action: () => {
        if (onDelete) {
          onDelete(topicId);
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      disabled: !onDelete,
    });
  }

  return <ContextMenu items={items} onClose={onClose} x={x} y={y} />;
};

export default TopicContextMenu;

