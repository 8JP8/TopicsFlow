import React, { useState } from 'react';
import UserBanner from '@/components/UI/UserBanner';
import UserContextMenu from '@/components/UI/UserContextMenu';
import { useRouter } from 'next/router';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import ReportUserDialog from '@/components/Reports/ReportUserDialog';

interface ClickableUsernameProps {
  userId: string;
  username: string;
  isAnonymous?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * ClickableUsername Component
 * 
 * Makes usernames clickable and right-clickable.
 * - Left click: Shows user banner
 * - Right click: Shows context menu with actions
 * - Hover: Optional tooltip (can be added)
 * 
 * Usage:
 * <ClickableUsername userId="123" username="JohnDoe">
 *   JohnDoe
 * </ClickableUsername>
 */
const ClickableUsername: React.FC<ClickableUsernameProps> = ({
  userId,
  username,
  isAnonymous = false,
  className = '',
  children,
}) => {
  const router = useRouter();
  const { t } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [bannerPos, setBannerPos] = useState({ x: 0, y: 0 });
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  // Don't make anonymous users clickable
  if (isAnonymous) {
    return (
      <span className={`theme-text-muted italic ${className}`} title="Anonymous User">
        {children || username}
      </span>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get click position for banner
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setBannerPos({
      x: rect.left,
      y: rect.bottom + 5, // Position below the username
    });
    
    setShowBanner(true);
    setShowContextMenu(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
    setShowBanner(false);
  };

  const handleSendMessage = (userId: string, username: string) => {
    // Navigate to private messages with this user
    router.push(`/messages/${userId}`);
  };

  const handleBlockUser = async (userId: string, username: string) => {
    try {
      if (isBlocked) {
        // Unblock
        await api.delete(API_ENDPOINTS.BLOCKING.UNBLOCK(userId));
        toast.success(t('blocking.unblocked') || `Unblocked ${username}`);
        setIsBlocked(false);
      } else {
        // Block
        if (!confirm(t('blocking.confirmBlock') || `Are you sure you want to block ${username}?`)) {
          return;
        }
        await api.post(API_ENDPOINTS.BLOCKING.BLOCK(userId));
        toast.success(t('blocking.blocked') || `Blocked ${username}`);
        setIsBlocked(true);
      }
    } catch (error: any) {
      console.error('Block/unblock error:', error);
      toast.error(error.response?.data?.message || t('errors.actionFailed') || 'Action failed');
    } finally {
      setShowContextMenu(false);
    }
  };

  const handleReportUser = (userId: string, username: string) => {
    setShowContextMenu(false);
    setShowReportModal(true);
  };

  const handleAddFriend = async (userId: string, username: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.USERS.SEND_FRIEND_REQUEST, {
        to_user_id: userId
      });
      if (response.data.success) {
        toast.success(t('privateMessages.friendRequestSent') || `Friend request sent to ${username}`);
      } else {
        toast.error(response.data.errors?.[0] || t('privateMessages.failedToSendFriendRequest') || 'Failed to send friend request');
      }
      setShowContextMenu(false);
    } catch (error: any) {
      console.error('Failed to send friend request:', error);
      toast.error(error.response?.data?.errors?.[0] || t('privateMessages.failedToSendFriendRequest') || 'Failed to send friend request');
      setShowContextMenu(false);
    }
  };

  return (
    <>
      <span
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`cursor-pointer hover:underline theme-text-primary font-medium ${className}`}
        title={`View ${username}'s profile`}
      >
        {children || username}
      </span>

      {/* User Banner */}
      {showBanner && (
        <UserBanner
          userId={userId}
          username={username}
          x={bannerPos.x}
          y={bannerPos.y}
          onClose={() => setShowBanner(false)}
          onSendMessage={handleSendMessage}
          onReport={handleReportUser}
          onBlock={handleBlockUser}
        />
      )}

      {/* Context Menu */}
      {showContextMenu && (
        <UserContextMenu
          userId={userId}
          username={username}
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onClose={() => setShowContextMenu(false)}
          onSendMessage={handleSendMessage}
          onAddFriend={handleAddFriend}
          onBlockUser={handleBlockUser}
          onReportUser={handleReportUser}
          isBlocked={isBlocked}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportUserDialog
          userId={userId}
          username={username}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </>
  );
};

export default ClickableUsername;
