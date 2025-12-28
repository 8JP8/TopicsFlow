import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import toast from 'react-hot-toast';
import ContextMenu from './ContextMenu';
import {
  Check,
  MessageSquare,
  UserPlus,
  UserMinus,
  Flag,
  Ban,
  ShieldCheck,
  UserX,
  Volume2,
  VolumeX
} from 'lucide-react';

interface UserContextMenuProps {
  userId: string;
  username: string;
  x: number;
  y: number;
  onClose: () => void;
  onSendMessage?: (userId: string, username: string) => void;
  onBlockUser?: (userId: string, username: string) => void;
  onReportUser?: (userId: string, username: string) => void;
  onAddFriend?: (userId: string, username: string) => void;
  onRemoveFriend?: (userId: string, username: string) => void;
  onMarkAsRead?: (userId: string) => void;
  onSilence?: (userId: string, username: string) => void; // NEW: Open mute menu for DM
  isBlocked?: boolean;
  areFriends?: boolean;
  // Chat room management actions (for private chats only)
  onPromoteToModerator?: (userId: string, username: string) => void;
  onKickUser?: (userId: string, username: string) => void;
  isModerator?: boolean;
  isOwner?: boolean;
  canManage?: boolean;
}

const UserContextMenu: React.FC<UserContextMenuProps> = ({
  userId,
  username,
  x,
  y,
  onClose,
  onSendMessage,
  onBlockUser,
  onReportUser,
  onAddFriend,
  onRemoveFriend,
  onMarkAsRead,
  onSilence,
  isBlocked = false,
  areFriends = false,
  onPromoteToModerator,
  onKickUser,
  isModerator = false,
  isOwner = false,
  canManage = false,
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isCurrentUser = user?.id === userId;

  const items = [];

  // Add Mark as Read option first if available
  if (onMarkAsRead) {
    items.push({
      label: t('contextMenu.markAsRead') || 'Mark as Read',
      action: () => {
        onMarkAsRead(userId);
      },
      icon: <Check className="w-4 h-4" />,
      disabled: false,
    });
  }

  // Add Silence option with submenu for duration options
  if (onSilence) {
    const handleMute = async (minutes: number) => {
      try {
        const response = await api.post(API_ENDPOINTS.USERS.MUTE_CONVERSATION(userId), { minutes });
        if (response.data.success) {
          const duration = minutes === -1 ? (t('mute.forever') || 'forever') : `${minutes} ${t('common.minutes') || 'minutes'}`;
          toast.success(t('mute.success', { name: username, duration }) || `${username} muted for ${duration}`);
        } else {
          toast.error(t('mute.error') || 'Failed to mute');
        }
      } catch (error) {
        console.error('Mute error:', error);
        toast.error(t('mute.error') || 'Failed to mute');
      }
    };

    items.push({
      label: t('mute.mute') || 'Mute',
      action: () => { }, // Parent item doesn't do anything; submenu handles it
      icon: <VolumeX className="w-4 h-4" />,
      disabled: false,
      submenu: [
        { label: t('mute.unmute') || 'Unmute', action: () => handleMute(0) },
        { label: t('mute.15m') || '15 minutes', action: () => handleMute(15) },
        { label: t('mute.1h') || '1 hour', action: () => handleMute(60) },
        { label: t('mute.8h') || '8 hours', action: () => handleMute(480) },
        { label: t('mute.24h') || '24 hours', action: () => handleMute(1440) },
        { label: t('mute.always') || 'Until I unmute', action: () => handleMute(-1) },
      ],
    });
  }

  // Send Message option
  items.push({
    label: t('userContextMenu.sendMessage'),
    action: () => {
      if (onSendMessage) {
        onSendMessage(userId, username);
      }
    },
    icon: <MessageSquare className="w-4 h-4" />,
    disabled: !onSendMessage,
  });

  // Only show other options if not current user
  if (!isCurrentUser) {
    // Show "Add Friend" option if not already friends, or "Remove Friend" if already friends
    if (!areFriends && onAddFriend) {
      items.push({
        label: t('userContextMenu.addFriend') || 'Add Friend',
        action: () => {
          onAddFriend(userId, username);
        },
        icon: <UserPlus className="w-4 h-4" />,
        disabled: false,
      });
    } else if (areFriends && onRemoveFriend) {
      items.push({
        label: t('userContextMenu.removeFriend') || 'Remove Friend',
        action: () => {
          onRemoveFriend(userId, username);
        },
        icon: <UserMinus className="w-4 h-4" />,
        disabled: false,
      });
    }

    items.push({
      label: t('userContextMenu.reportUser'),
      action: () => {
        if (onReportUser) {
          onReportUser(userId, username);
        }
      },
      icon: <Flag className="w-4 h-4" />,
      disabled: !onReportUser,
    });

    items.push({
      label: isBlocked ? t('blocking.unblockUser') : t('blocking.blockUser'),
      action: () => {
        if (onBlockUser) {
          onBlockUser(userId, username);
        }
      },
      icon: <Ban className="w-4 h-4" />,
      disabled: !onBlockUser,
    });
  }

  // Add chat room management items if available (for private chats only)
  if (canManage && !isOwner) {
    if (isModerator) {
      items.push({
        label: t('chat.removeModerator') || 'Remove Moderator',
        action: () => {
          if (onPromoteToModerator) {
            onPromoteToModerator(userId, username);
          }
        },
        icon: <ShieldCheck className="w-4 h-4" />,
        disabled: !onPromoteToModerator,
      });
    } else {
      items.push({
        label: t('chat.promoteToModerator') || 'Promote to Moderator',
        action: () => {
          if (onPromoteToModerator) {
            onPromoteToModerator(userId, username);
          }
        },
        icon: <ShieldCheck className="w-4 h-4" />,
        disabled: !onPromoteToModerator,
      });
    }
    items.push({
      label: t('chat.kickUser') || 'Kick User',
      action: () => {
        if (onKickUser) {
          onKickUser(userId, username);
        }
      },
      icon: <UserX className="w-4 h-4" />,
      disabled: !onKickUser,
    });
  }

  return <ContextMenu items={items} onClose={onClose} x={x} y={y} />;
};

export default UserContextMenu;

