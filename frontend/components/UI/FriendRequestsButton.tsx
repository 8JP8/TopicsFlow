import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from './LoadingSpinner';

interface FriendRequestsButtonProps {}

const FriendRequestsButton: React.FC<FriendRequestsButtonProps> = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [friendRequests, setFriendRequests] = useState<{received: Array<any>, sent: Array<any>}>({received: [], sent: []});
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && isOpen) {
      loadFriendRequests();
    }
  }, [user, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const loadFriendRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.USERS.FRIEND_REQUESTS);
      if (response.data.success) {
        setFriendRequests(response.data.data || {received: [], sent: []});
      }
    } catch (error) {
      console.error('Failed to load friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.USERS.ACCEPT_FRIEND_REQUEST(requestId));
      if (response.data.success) {
        loadFriendRequests();
      }
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    }
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.USERS.REJECT_FRIEND_REQUEST(requestId));
      if (response.data.success) {
        loadFriendRequests();
      }
    } catch (error) {
      console.error('Failed to reject friend request:', error);
    }
  };

  const handleCancelFriendRequest = async (requestId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.USERS.CANCEL_FRIEND_REQUEST(requestId));
      if (response.data.success) {
        loadFriendRequests();
      }
    } catch (error) {
      console.error('Failed to cancel friend request:', error);
    }
  };

  if (!user) {
    return null;
  }

  const unreadCount = friendRequests.received.length;

  return (
    <div className="relative" ref={popupRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors"
        aria-label="Friend Requests"
      >
        <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 theme-bg-secondary border theme-border rounded-lg shadow-lg z-20 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b theme-border">
              <h3 className="text-sm font-medium theme-text-primary">{t('privateMessages.friendRequests')}</h3>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              ) : (
                <>
                  {/* Received Requests */}
                  {friendRequests.received.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium theme-text-primary mb-2">
                        {t('privateMessages.receivedRequests')} ({friendRequests.received.length})
                      </h4>
                      <div className="space-y-2">
                        {friendRequests.received.map((request: any) => (
                          <div
                            key={request.id}
                            className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg"
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 rounded-full theme-blue-primary flex items-center justify-center">
                                <span className="text-white text-xs font-semibold">
                                  {request.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-sm theme-text-primary">{request.username}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleAcceptFriendRequest(request.id)}
                                className="px-2 py-1 text-xs btn btn-primary"
                                title={t('privateMessages.accept')}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => handleRejectFriendRequest(request.id)}
                                className="px-2 py-1 text-xs btn btn-secondary"
                                title={t('privateMessages.reject')}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sent Requests */}
                  {friendRequests.sent.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium theme-text-primary mb-2">
                        {t('privateMessages.sentRequests')} ({friendRequests.sent.length})
                      </h4>
                      <div className="space-y-2">
                        {friendRequests.sent.map((request: any) => (
                          <div
                            key={request.id}
                            className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg"
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 rounded-full theme-blue-primary flex items-center justify-center">
                                <span className="text-white text-xs font-semibold">
                                  {request.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-sm theme-text-primary">{request.username}</span>
                            </div>
                            <button
                              onClick={() => handleCancelFriendRequest(request.id)}
                              className="px-2 py-1 text-xs btn btn-secondary"
                              title={t('privateMessages.cancel')}
                            >
                              {t('privateMessages.cancel')}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {friendRequests.received.length === 0 && friendRequests.sent.length === 0 && (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 theme-text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      <p className="theme-text-secondary text-sm">{t('privateMessages.noFriendRequests')}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FriendRequestsButton;

