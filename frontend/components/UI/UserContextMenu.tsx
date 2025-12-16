import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import toast from 'react-hot-toast';
import ContextMenu from './ContextMenu';

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
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
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
      label: t('contextMenu.silenceChat') || 'Silence Chat',
      action: () => { }, // Parent item doesn't do anything; submenu handles it
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      ),
      disabled: false,
      submenu: [
        { label: t('mute.15minutes') || '15 minutes', action: () => handleMute(15) },
        { label: t('mute.1hour') || '1 hour', action: () => handleMute(60) },
        { label: t('mute.8hours') || '8 hours', action: () => handleMute(480) },
        { label: t('mute.24hours') || '24 hours', action: () => handleMute(1440) },
        { label: t('mute.forever') || 'Until I unmute', action: () => handleMute(-1) },
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
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
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
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        ),
        disabled: false,
      });
    } else if (areFriends && onRemoveFriend) {
      items.push({
        label: t('userContextMenu.removeFriend') || 'Remove Friend',
        action: () => {
          onRemoveFriend(userId, username);
        },
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
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
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      disabled: !onReportUser,
    });

    items.push({
      label: isBlocked ? t('blocking.unblockUser') : t('blocking.blockUser'),
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
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
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
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
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
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      disabled: !onKickUser,
    });
  }

  return <ContextMenu items={items} onClose={onClose} x={x} y={y} />;
};

export default UserContextMenu;

