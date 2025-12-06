import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ContextMenu from './ContextMenu';
import MuteMenu from './MuteMenu';

interface ChatRoomContextMenuProps {
  chatId: string;
  chatName: string;
  x: number;
  y: number;
  onClose: () => void;
  onReport?: (chatId: string, reportType: 'chatroom' | 'chatroom_background' | 'chatroom_picture') => void;
  onSilence?: (chatId: string) => void;
  onHide?: (chatId: string) => void;
  onDelete?: (chatId: string) => void;
  isSilenced?: boolean;
  isHidden?: boolean;
  hasBackground?: boolean;
  hasPicture?: boolean;
  isOwner?: boolean;
}

const ChatRoomContextMenu: React.FC<ChatRoomContextMenuProps> = ({
  chatId,
  chatName,
  x,
  y,
  onClose,
  onReport,
  onSilence,
  onHide,
  onDelete,
  isSilenced = false,
  isHidden = false,
  hasBackground = false,
  hasPicture = false,
  isOwner = false,
}) => {
  const { t } = useLanguage();
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  
  const items = [
    {
      label: t('reports.reportChatroom') || 'Report Chatroom',
      action: () => {
        if (onReport) {
          onReport(chatId, 'chatroom');
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
      label: isSilenced ? (t('contextMenu.unsilenceChat') || 'Unsilence Chat') : (t('contextMenu.silenceChat') || 'Silence Chat'),
      action: () => {
        setShowMuteMenu(true);
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
      label: isHidden ? (t('contextMenu.unhideChat') || 'Unhide Chat') : (t('contextMenu.hideChat') || 'Hide Chat'),
      action: () => {
        if (onHide) {
          onHide(chatId);
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
      label: t('chat.deleteChatroom') || 'Delete Chatroom',
      action: () => {
        if (onDelete) {
          onDelete(chatId);
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

  return (
    <>
      <ContextMenu items={items} onClose={onClose} x={x} y={y} />
      {showMuteMenu && (
        <MuteMenu
          type="chat"
          id={chatId}
          name={chatName}
          onClose={() => setShowMuteMenu(false)}
          isMuted={isSilenced}
        />
      )}
    </>
  );
};

export default ChatRoomContextMenu;

