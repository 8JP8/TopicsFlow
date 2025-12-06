import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
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
  isBlocked?: boolean;
  areFriends?: boolean; // Whether users are already friends
  // Chat room management actions (for private chats only)
  onPromoteToModerator?: (userId: string, username: string) => void;
  onKickUser?: (userId: string, username: string) => void;
  isModerator?: boolean;
  isOwner?: boolean;
  canManage?: boolean; // Whether current user can manage (owner or moderator)
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

  const items = [
    {
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
    },
  ];

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

