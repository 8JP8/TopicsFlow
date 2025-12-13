import React, { useState, useEffect, useRef } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from './LoadingSpinner';

interface UserTooltipProps {
  username: string;
  x: number;
  y: number;
  onClose: () => void;
  onMouseEnter?: (event: React.MouseEvent) => void;
}

interface UserInfo {
  id: string;
  username: string;
  email: string;
  profile_picture?: string;
  created_at?: string;
}

// Cache for user info to avoid duplicate requests
const userInfoCache = new Map<string, { data: UserInfo; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const pendingRequests = new Map<string, Promise<UserInfo | null>>();

const UserTooltip: React.FC<UserTooltipProps> = ({ username, x, y, onClose, onMouseEnter }) => {
  const { t } = useLanguage();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Reset state when username changes
    setUserInfo(null);
    setLoading(true);
    setError(null);

    const fetchUserInfo = async () => {
      // Check cache first
      const cached = userInfoCache.get(username);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        if (mountedRef.current) {
          setUserInfo(cached.data);
          setLoading(false);
          setError(null);
        }
        return;
      }

      // Check if there's already a pending request for this username
      if (pendingRequests.has(username)) {
        try {
          const data = await pendingRequests.get(username)!;
          if (mountedRef.current && data) {
            setUserInfo(data);
            setLoading(false);
            setError(null);
          } else if (mountedRef.current) {
            setLoading(false);
            setError(t('userTooltip.userNotFound'));
          }
        } catch (error: any) {
          if (mountedRef.current) {
            setLoading(false);
            setError(error.response?.data?.errors?.[0] || t('userTooltip.failedToLoad'));
          }
        }
        return;
      }

      // Create new request
      const requestPromise = (async () => {
        try {
          if (mountedRef.current) {
            setLoading(true);
            setError(null);
          }
          const response = await api.get(API_ENDPOINTS.USERS.GET_BY_USERNAME(username));
          if (response.data.success && response.data.data) {
            const data = response.data.data;
            // Cache the result
            userInfoCache.set(username, { data, timestamp: Date.now() });
            if (mountedRef.current) {
              setUserInfo(data);
              setLoading(false);
              setError(null);
            }
            return data;
          }
          if (mountedRef.current) {
            setLoading(false);
            setError(t('userTooltip.userNotFound'));
          }
          return null;
        } catch (error: any) {
          console.error('Failed to fetch user info:', error);
          if (mountedRef.current) {
            setLoading(false);
            const errorMessage = error.response?.data?.errors?.[0] ||
              error.response?.data?.message ||
              error.message ||
              t('userTooltip.failedToLoad');
            setError(errorMessage);
          }
          return null;
        } finally {
          // Remove from pending requests
          pendingRequests.delete(username);
        }
      })();

      pendingRequests.set(username, requestPromise);
      await requestPromise;
    };

    fetchUserInfo();
  }, [username]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('userTooltip.unknown');
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Show loading state, error, or user info
  if (!userInfo && !loading && !error) {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 theme-bg-secondary border theme-border rounded-lg shadow-xl p-4 min-w-[200px] max-w-[300px] pointer-events-auto"
      style={{
        left: typeof window !== 'undefined' ? `${Math.max(10, Math.min(x, window.innerWidth - 320))}px` : `${x}px`, // Keep within viewport
        top: typeof window !== 'undefined' ? `${Math.max(10, y - 20)}px` : `${y}px`, // Position above cursor with margin
        transform: 'translateY(-100%)', // Position above the cursor
      }}
      onMouseEnter={(e) => {
        // Keep tooltip open when hovering over it
        e.stopPropagation();
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        // Close when leaving tooltip
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center space-y-2 py-2">
          <svg className="w-8 h-8 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm theme-text-secondary text-center">{error}</p>
        </div>
      ) : userInfo ? (
        <div className="flex flex-col items-center space-y-3">
          {/* Profile Picture */}
          <div className="w-16 h-16 rounded-full overflow-hidden theme-bg-tertiary flex items-center justify-center">
            {userInfo.profile_picture ? (
              <img
                src={userInfo.profile_picture.startsWith('data:') ? userInfo.profile_picture : `data:image/jpeg;base64,${userInfo.profile_picture}`}
                alt={userInfo.username}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span className="text-2xl font-semibold theme-text-primary">
                {userInfo.username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Username */}
          <div className="text-center">
            <p className="text-sm font-semibold theme-text-primary">{userInfo.username}</p>
            {userInfo.created_at && (
              <p className="text-xs theme-text-muted mt-1">
                {t('userTooltip.joined')} {formatDate(userInfo.created_at)}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UserTooltip;

