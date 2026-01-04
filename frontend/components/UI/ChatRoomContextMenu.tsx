import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertTriangle, Bell, BellOff, Eye, EyeOff, LogOut, Trash2, Volume2, Share2 } from 'lucide-react';
import ContextMenu from './ContextMenu';

interface ChatRoomContextMenuProps {
  chatId: string;
  chatName: string;
  x: number;
  y: number;
  onClose: () => void;
  onReport?: (chatId: string, reportType: 'chatroom' | 'chatroom_background' | 'chatroom_picture') => void;
  onFollow?: (chatId: string) => void;
  onUnfollow?: (chatId: string) => void;
  onHide?: (chatId: string) => void;
  onDelete?: (chatId: string) => void;
  onLeave?: (chatId: string) => void;
  isFollowing?: boolean;
  isHidden?: boolean;
  hasBackground?: boolean;
  hasPicture?: boolean;
  isOwner?: boolean;
  onMute?: (chatId: string, minutes: number) => void;
  isMuted?: boolean;
  onShare?: (chatId: string) => void;
}

const ChatRoomContextMenu: React.FC<ChatRoomContextMenuProps> = ({
  chatId,
  chatName,
  x,
  y,
  onClose,
  onReport,
  onFollow,
  onUnfollow,
  onHide,
  onDelete,
  onLeave,
  isFollowing = true, // Default to true (following) for backward compatibility
  isHidden = false,
  hasBackground = false,
  hasPicture = false,
  isOwner = false,
  onMute,
  isMuted = false,
  onShare,
}) => {
  const { t } = useLanguage();

  const items = [
    {
      label: t('reports.reportChatroom') || 'Report Chatroom',
      action: () => {
        if (onReport) {
          onReport(chatId, 'chatroom');
        }
        onClose();
      },
      icon: <AlertTriangle className="w-4 h-4" />,
      disabled: !onReport,
    },

    {
      label: isFollowing ? (t('chats.unfollow') || 'Unfollow Chatroom') : (t('contextMenu.followChatroom') || 'Follow Chatroom'),
      action: () => {
        if (isFollowing && onUnfollow) {
          onUnfollow(chatId);
        } else if (!isFollowing && onFollow) {
          onFollow(chatId);
        }
        onClose();
      },
      icon: isFollowing ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />,
      disabled: (!isFollowing && !onFollow) || (isFollowing && !onUnfollow),
    },
    ...(isFollowing ? [
      isMuted ? {
        label: t('mute.unmuteChatroom') || 'Unmute Chatroom',
        icon: <Volume2 className="w-4 h-4" />,
        action: () => {
          if (onMute) onMute(chatId, 0);
          onClose();
        },
        disabled: !onMute,
      } : {
        label: t('mute.muteChatroom') || 'Mute Chatroom',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-volume-off-icon lucide-volume-off w-4 h-4">
            <path d="M16 9a5 5 0 0 1 .95 2.293" />
            <path d="M19.364 5.636a9 9 0 0 1 1.889 9.96" />
            <path d="m2 2 20 20" />
            <path d="m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11" />
            <path d="M9.828 4.172A.686.686 0 0 1 11 4.657v.686" />
          </svg>
        ),
        disabled: !onMute,
        action: () => { }, // Required by interface even if submenu exists
        submenu: [
          { label: t('mute.15m') || '15 Minutes', action: () => { onMute?.(chatId, 15); onClose(); } },
          { label: t('mute.1h'), action: () => { onMute?.(chatId, 60); onClose(); } },
          { label: t('mute.8h'), action: () => { onMute?.(chatId, 480); onClose(); } },
          { label: t('mute.24h'), action: () => { onMute?.(chatId, 1440); onClose(); } },
          { label: t('mute.always'), action: () => { onMute?.(chatId, -1); onClose(); } },
        ],
      }
    ] : []),
    {
      label: isHidden ? (t('contextMenu.unhideChat') || 'Unhide Chat') : (t('contextMenu.hideChat') || 'Hide Chat'),
      action: () => {
        if (onHide) {
          onHide(chatId);
        }
        onClose();
      },
      icon: isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />,
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
      icon: <Trash2 className="w-4 h-4 text-red-500" />,
      disabled: !onDelete,
    });
  }

  // Add leave option for members (non-owners)
  if (!isOwner && onLeave) {
    items.push({
      label: t('contextMenu.leaveChatroom') || 'Leave Chatroom',
      action: () => {
        if (onLeave) {
          onLeave(chatId);
        }
        onClose();
      },
      icon: <LogOut className="w-4 h-4" />,
      disabled: !onLeave,
    });
  }

  return (
    <ContextMenu items={items} onClose={onClose} x={x} y={y} />
  );
};

export default ChatRoomContextMenu;

