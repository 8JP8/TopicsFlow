import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import Avatar from './Avatar';

interface FriendRequest {
  id: string;
  from_user_id?: string;
  to_user_id?: string;
  username: string;
  profile_picture?: string;
  created_at: string;
}

interface FriendRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestHandled?: () => void;
}

const FriendRequestsModal: React.FC<FriendRequestsModalProps> = ({
  isOpen,
  onClose,
  onRequestHandled,
}) => {
  const { t } = useLanguage();
  const [friendRequests, setFriendRequests] = useState<{ received: FriendRequest[], sent: FriendRequest[] }>({ received: [], sent: [] });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchFriendRequests();
    }
  }, [isOpen]);

  const fetchFriendRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.USERS.FRIEND_REQUESTS);
      if (response.data.success) {
        setFriendRequests(response.data.data || { received: [], sent: [] });
      }
    } catch (error: any) {
      console.error('Failed to fetch friend requests:', error);
      toast.error(error.response?.data?.errors?.[0] || t('privateMessages.failedToLoadFriendRequests') || 'Failed to load friend requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      setProcessing(requestId);
      const response = await api.post(API_ENDPOINTS.USERS.ACCEPT_FRIEND_REQUEST(requestId));
      if (response.data.success) {
        toast.success(t('privateMessages.friendRequestAccepted') || 'Friend request accepted');
        setFriendRequests(prev => ({
          ...prev,
          received: prev.received.filter(req => req.id !== requestId)
        }));
        onRequestHandled?.();
      } else {
        toast.error(response.data.errors?.[0] || t('privateMessages.failedToAcceptFriendRequest') || 'Failed to accept friend request');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('privateMessages.failedToAcceptFriendRequest') || 'Failed to accept friend request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setProcessing(requestId);
      const response = await api.post(API_ENDPOINTS.USERS.REJECT_FRIEND_REQUEST(requestId));
      if (response.data.success) {
        toast.success(t('privateMessages.friendRequestRejected') || 'Friend request rejected');
        setFriendRequests(prev => ({
          ...prev,
          received: prev.received.filter(req => req.id !== requestId)
        }));
        onRequestHandled?.();
      } else {
        toast.error(response.data.errors?.[0] || t('privateMessages.failedToRejectFriendRequest') || 'Failed to reject friend request');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('privateMessages.failedToRejectFriendRequest') || 'Failed to reject friend request');
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      setProcessing(requestId);
      const response = await api.post(API_ENDPOINTS.USERS.CANCEL_FRIEND_REQUEST(requestId));
      if (response.data.success) {
        toast.success(t('privateMessages.friendRequestCancelled') || 'Friend request cancelled');
        setFriendRequests(prev => ({
          ...prev,
          sent: prev.sent.filter(req => req.id !== requestId)
        }));
        onRequestHandled?.();
      } else {
        toast.error(response.data.errors?.[0] || t('privateMessages.failedToCancelFriendRequest') || 'Failed to cancel friend request');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('privateMessages.failedToCancelFriendRequest') || 'Failed to cancel friend request');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('notifications.justNow') || 'Just now';
    if (minutes < 60) return `${minutes} ${t('posts.minutes')} ${t('posts.ago')}`;
    if (hours < 24) return `${hours} ${t('posts.hours')} ${t('posts.ago')}`;
    if (days < 7) return `${days} ${t('posts.days')} ${t('posts.ago')}`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-gray-800 border theme-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b theme-border">
            <h2 className="text-xl font-bold theme-text-primary">
              {t('privateMessages.friendRequests') || 'Friend Requests'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
            >
              <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : friendRequests.received.length === 0 && friendRequests.sent.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 theme-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <p className="text-lg theme-text-primary mb-2">
                  {t('privateMessages.noFriendRequests') || 'No friend requests'}
                </p>
                <p className="text-sm theme-text-muted">
                  {t('privateMessages.noFriendRequestsDesc') || "You don't have any pending friend requests."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Received Requests */}
                {friendRequests.received.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold theme-text-primary mb-4">
                      {t('privateMessages.receivedRequests') || 'Received Requests'} ({friendRequests.received.length})
                    </h3>
                    <div className="space-y-3">
                      {friendRequests.received.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-4 theme-bg-tertiary rounded-lg border theme-border"
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            <Avatar
                              userId={request.from_user_id || ''}
                              username={request.username}
                              size="md"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium theme-text-primary">
                                {request.username}
                              </p>
                              <p className="text-xs theme-text-muted">
                                {formatDate(request.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleAccept(request.id)}
                              disabled={processing === request.id}
                              className="px-4 py-2 btn btn-primary disabled:opacity-50"
                            >
                              {processing === request.id ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                t('privateMessages.accept') || 'Accept'
                              )}
                            </button>
                            <button
                              onClick={() => handleReject(request.id)}
                              disabled={processing === request.id}
                              className="px-4 py-2 btn btn-secondary disabled:opacity-50"
                            >
                              {processing === request.id ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                t('privateMessages.reject') || 'Reject'
                              )}
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
                    <h3 className="text-lg font-semibold theme-text-primary mb-4">
                      {t('privateMessages.sentRequests') || 'Sent Requests'} ({friendRequests.sent.length})
                    </h3>
                    <div className="space-y-3">
                      {friendRequests.sent.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-4 theme-bg-tertiary rounded-lg border theme-border"
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            <Avatar
                              userId={request.to_user_id || ''}
                              username={request.username}
                              size="md"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium theme-text-primary">
                                {request.username}
                              </p>
                              <p className="text-xs theme-text-muted">
                                {formatDate(request.created_at)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleCancel(request.id)}
                            disabled={processing === request.id}
                            className="px-4 py-2 btn btn-secondary disabled:opacity-50"
                          >
                            {processing === request.id ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              t('privateMessages.cancel') || 'Cancel'
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FriendRequestsModal;




