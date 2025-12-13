import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from './LoadingSpinner';
import { useRouter } from 'next/router';
import Avatar from './Avatar';
import UserBadges from './UserBadges';
import { getUserBannerGradient, getUserColorClass } from '@/utils/colorUtils';

interface UserBannerProps {
  userId?: string;
  username?: string;
  isAnonymous?: boolean;
  x?: number;
  y?: number;
  onClose?: () => void;
  onSendMessage?: (userId: string, username: string) => void;
  onReport?: (userId: string, username: string) => void;
  onBlock?: (userId: string, username: string) => void;
}

interface UserData {
  id: string;
  username: string;
  email?: string;
  created_at: string;
  banner?: string;
  preferences?: {
    theme?: string;
    language?: string;
  };
}

const UserBanner: React.FC<UserBannerProps> = ({
  userId,
  username: initialUsername,
  isAnonymous = false,
  x,
  y,
  onClose,
  onSendMessage,
  onReport,
  onBlock,
}) => {
  const { t } = useLanguage();
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserData();
  }, [userId, isAnonymous]);

  const fetchUserData = async () => {
    // If anonymous, don't show banner at all - return early
    if (isAnonymous || (!userId && initialUsername && initialUsername === 'Anonymous')) {
      setError(null);
      setUser(null);
      setLoading(false);
      return;
    }

    if (!userId && !initialUsername) {
      setError(t('errors.userNotFound') || 'User not found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let response;

      if (userId) {
        response = await api.get(API_ENDPOINTS.USERS.GET(userId));
      } else if (initialUsername) {
        response = await api.get(API_ENDPOINTS.USERS.GET_BY_USERNAME(initialUsername));
      }

      if (response && response.data.success) {
        setUser(response.data.data);
      } else {
        setError(t('errors.userNotFound') || 'User not found');
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      // Fallback: if we have username and it failed, maybe just show username with no extra data?
      if (!userId && initialUsername) {
        setUser({
          id: '',
          username: initialUsername,
          created_at: new Date().toISOString(), // Mock date or hide
        });
        setError(null);
      } else {
        setError(t('errors.loadingFailed') || 'Failed to load user data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (user && onSendMessage) {
      onSendMessage(user.id, user.username);
    }
    onClose?.();
  };

  const handleReport = () => {
    if (user && onReport) {
      onReport(user.id, user.username);
    }
    onClose?.();
  };

  const handleBlock = () => {
    if (user && onBlock) {
      onBlock(user.id, user.username);
    }
    onClose?.();
  };

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  };

  // Calculate position
  const hasCoordinates = x !== undefined && y !== undefined;

  // Get dynamic colors
  // Ensure we use the same identifier for both to keep them consistent
  const identifier = user?.id || userId || user?.username || initialUsername;
  const bannerGradient = getUserBannerGradient(isAnonymous ? undefined : identifier);
  const avatarColor = getUserColorClass(isAnonymous ? undefined : identifier);

  // Avatar styling adjustments
  // Reduced inset on gray background to make margin narrower
  const grayCircleClass = "absolute inset-0.5 bg-gray-500 dark:bg-gray-700 rounded-full -z-10";

  const content = (
    <div
      className="theme-bg-secondary rounded-lg shadow-xl overflow-hidden w-80 border theme-border"
      style={hasCoordinates ? { position: 'absolute', top: y, left: x } : {}}
      onClick={(e) => e.stopPropagation()}
    >
      {loading ? (
        <div className="p-4">
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        </div>
      ) : error || !user ? (
        <div className="p-4">
          <div className="text-center theme-text-muted">
            {error || t('errors.userNotFound')}
          </div>
        </div>
      ) : (
        <>
          {/* Header/Banner */}
          <div className="h-20 relative overflow-hidden" style={bannerGradient}>
            {/* Show user's banner if not anonymous and has banner, otherwise show default gradient */}
            {!isAnonymous && user.banner ? (
              <img
                src={user.banner.startsWith('data:') ? user.banner : `data:image/jpeg;base64,${user.banner}`}
                alt={`${user.username} banner`}
                className="w-full h-full object-cover relative z-10"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'; // Fallback to gradient if image fails
                }}
              />
            ) : null}
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1 rounded-full bg-black bg-opacity-30 hover:bg-opacity-50 transition-colors z-20"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Avatar */}
          <div className="relative px-4 pb-4">
            <div className="absolute -top-12 left-4 z-20">
              <div className="relative">
                {/* Gray opaque layer behind avatar for transparent PNGs */}
                <div className={grayCircleClass} />
                {!user.id ? (
                  // Anonymous user - show default avatar with initial
                  <div className={`w-20 h-20 rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold text-2xl border-4 border-white dark:border-gray-800 shadow-lg relative z-10`}>
                    {user.username?.charAt(0).toUpperCase() || 'A'}
                  </div>
                ) : (
                  <div className="relative z-10">
                    <Avatar
                      userId={user.id}
                      username={user.username}
                      size="2xl"
                      className="border-4 theme-border shadow-lg"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* User Info */}
            <div className="pt-10">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold theme-text-primary">{user.username}</h3>
                {(isAnonymous || !user.id) && (
                  <UserBadges isAnonymous={true} />
                )}
              </div>
              {!user.id || isAnonymous ? (
                <p className="text-sm theme-text-muted mt-1 italic">
                  {t('userBanner.anonymousUser') || 'Anonymous User'}
                </p>
              ) : (
                <p className="text-sm theme-text-muted mt-1">
                  {t('userBanner.joined')} {formatJoinDate(user.created_at)}
                </p>
              )}
            </div>

            {/* Quick Actions - Hide for anonymous users */}
            {!isAnonymous && user.id && (
              <div className="mt-4 space-y-2">
                {onSendMessage && (
                  <button
                    onClick={handleSendMessage}
                    className="w-full px-4 py-2 theme-bg-tertiary hover:theme-bg-hover rounded-lg transition-colors theme-text-primary flex items-center justify-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>{t('userBanner.sendMessage') || 'Send Message'}</span>
                  </button>
                )}

                <div className="flex space-x-2">
                  {onReport && (
                    <button
                      onClick={handleReport}
                      className="flex-1 px-4 py-2 theme-bg-tertiary hover:theme-bg-hover rounded-lg transition-colors theme-text-primary flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{t('userBanner.report') || 'Report'}</span>
                    </button>
                  )}

                  {onBlock && (
                    <button
                      onClick={handleBlock}
                      className="flex-1 px-4 py-2 theme-bg-tertiary hover:theme-bg-hover rounded-lg transition-colors text-red-500 hover:text-red-600 flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span>{t('userBanner.block') || 'Block'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  // Return with backdrop if we have coordinates, or as centered modal otherwise
  // But always use a backdrop to handle outside clicks
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent" // Transparent by default for popup logic, dimmed for modal logic?
      style={!hasCoordinates ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}}
      onClick={onClose}
    >
      {content}
    </div>
  );
};

export default UserBanner;
