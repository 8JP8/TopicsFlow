import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import UserBanner from './UserBanner';
import ReportUserDialog from '@/components/Reports/ReportUserDialog';
import toast from 'react-hot-toast';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface ClickableUsernameProps {
  userId: string;
  username: string;
  displayName?: string;
  isAnonymous?: boolean;
  className?: string;
  showContextMenuProp?: boolean;
}

const ClickableUsername: React.FC<ClickableUsernameProps> = ({
  userId,
  username,
  displayName,
  isAnonymous = false,
  className = '',
  showContextMenuProp = true,
}) => {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [showBanner, setShowBanner] = useState(false);
  const [showContextMenu, setShowContextMenuState] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [bannerPosition, setBannerPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const usernameRef = useRef<HTMLSpanElement>(null);

  const displayText = displayName || username;
  const isCurrentUser = currentUser?.id === userId;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenuState(false);
      }
    };

    if (showContextMenuProp) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showContextMenuProp]);

  const handleClick = (e: React.MouseEvent) => {
    if (isAnonymous) return; // Don't show banner for anonymous users
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setBannerPosition({
      x: rect.left,
      y: rect.bottom + 5
    });
    setShowBanner(true);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isAnonymous || !showContextMenuProp) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenuPosition({
      x: e.clientX,
      y: e.clientY
    });
    setShowContextMenuState(true);
  };

  const handleSendMessage = () => {
    setShowContextMenuState(false);
    setShowBanner(false);
    router.push(`/messages?user=${userId}`);
  };

  const handleReport = () => {
    setShowContextMenuState(false);
    setShowBanner(false);
    setShowReportModal(true);
  };

  const handleBlock = async () => {
    setShowContextMenuState(false);
    setShowBanner(false);
    
    try {
      const response = await api.post(API_ENDPOINTS.USERS.BLOCK(userId));
      if (response.data.success) {
        toast.success(t('success.userBlocked') || 'User blocked successfully');
      } else {
        toast.error(response.data.errors?.[0] || t('errors.blockFailed') || 'Failed to block user');
      }
    } catch (error) {
      console.error('Failed to block user:', error);
      toast.error(t('errors.blockFailed') || 'Failed to block user');
    }
  };

  const handleUnblock = async () => {
    setShowContextMenuState(false);
    setShowBanner(false);
    
    try {
      const response = await api.delete(API_ENDPOINTS.USERS.UNBLOCK(userId));
      if (response.data.success) {
        toast.success(t('success.userUnblocked') || 'User unblocked successfully');
      } else {
        toast.error(response.data.errors?.[0] || t('errors.unblockFailed') || 'Failed to unblock user');
      }
    } catch (error) {
      console.error('Failed to unblock user:', error);
      toast.error(t('errors.unblockFailed') || 'Failed to unblock user');
    }
  };

  if (isAnonymous) {
    return (
      <span className={`${className} cursor-default`}>
        {displayText}
      </span>
    );
  }

  return (
    <>
      <span
        ref={usernameRef}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`${className} cursor-pointer hover:underline hover:text-blue-500 transition-colors`}
        title={`Click to view ${displayText}'s info`}
      >
        {displayText}
      </span>

      {/* User Banner */}
      {showBanner && bannerPosition && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowBanner(false)}
          />
          <UserBanner
            userId={userId}
            username={username}
            x={bannerPosition.x}
            y={bannerPosition.y}
            onClose={() => setShowBanner(false)}
            onSendMessage={!isCurrentUser ? handleSendMessage : undefined}
            onReport={!isCurrentUser ? handleReport : undefined}
            onBlock={!isCurrentUser ? handleBlock : undefined}
          />
        </>
      )}

      {/* Context Menu */}
      {showContextMenuProp && showContextMenu && contextMenuPosition && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowContextMenuState(false)}
          />
          <div
            ref={contextMenuRef}
            className="fixed z-50 w-48 theme-bg-secondary border theme-border rounded-lg shadow-xl overflow-hidden"
            style={{
              left: `${contextMenuPosition.x}px`,
              top: `${contextMenuPosition.y}px`,
            }}
          >
            {!isCurrentUser && (
              <>
                <button
                  onClick={handleSendMessage}
                  className="w-full px-4 py-2 text-left theme-text-primary hover:theme-bg-tertiary transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>{t('contextMenu.sendMessage') || 'Send Message'}</span>
                </button>
                
                <button
                  onClick={handleReport}
                  className="w-full px-4 py-2 text-left theme-text-primary hover:theme-bg-tertiary transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{t('contextMenu.report') || 'Report User'}</span>
                </button>
                
                <div className="border-t theme-border" />
                
                <button
                  onClick={handleBlock}
                  className="w-full px-4 py-2 text-left text-red-500 hover:theme-bg-tertiary transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <span>{t('contextMenu.block') || 'Block User'}</span>
                </button>
              </>
            )}
          </div>
        </>
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
