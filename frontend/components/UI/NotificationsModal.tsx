import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

import useEscapeKey from '@/hooks/useEscapeKey';

interface Notification {
  id: string;
  type: 'message' | 'mention' | 'report' | 'system' | 'invitation' | 'friend_request' | 'comment' | 'chatroom_message';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
  sender_username?: string;
  context_id?: string;
  context_type?: string;
  context_name?: string;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  useEscapeKey(() => {
    if (isOpen) onClose();
  });
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'mentions'>('all');
  const [activeTab, setActiveTab] = useState<'general' | 'mentions'>('general');
  const pageSize = 20;

  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications(true);
    }
  }, [isOpen, user, filter]);

  const fetchNotifications = async (reset = false) => {
    if (!user) return;

    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.LIST, {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        unread_only: filter === 'unread',
      });

      if (response.data.success && response.data.data) {
        const fetchedNotifications: Notification[] = response.data.data.map((notif: any) => ({
          id: notif.id || notif._id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          timestamp: notif.created_at || notif.timestamp,
          read: notif.read || false,
          data: notif.data || {},
          sender_username: notif.data?.sender_username || notif.data?.commenter_username || notif.data?.from_username,
          context_id: notif.context_id || notif.data?.chat_room_id || notif.data?.post_id,
          context_type: notif.context_type,
          context_name: notif.context_name || notif.data?.chat_room_name || notif.data?.post_title,
        }));

        if (reset) {
          setNotifications(fetchedNotifications);
          setPage(1);
        } else {
          setNotifications(prev => [...prev, ...fetchedNotifications]);
        }

        setHasMore(fetchedNotifications.length === pageSize);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error(t('notifications.loadFailed') || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => {
        const nextPage = prev + 1;
        fetchNotifications(false);
        return nextPage;
      });
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.post(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(API_ENDPOINTS.NOTIFICATIONS.DELETE(id));
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success(t('notifications.deleted') || 'Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error(t('notifications.deleteFailed') || 'Failed to delete notification');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success(t('notifications.allMarkedRead') || 'All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('notifications.justNow') || 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8H19C20.1046 8 21 8.89543 21 10V16C21 17.1046 20.1046 18 19 18H17V22L13 18H9C8.44772 18 7.94772 17.7761 7.58579 17.4142M7.58579 17.4142L11 14H15C16.1046 14 17 13.1046 17 12V6C17 4.89543 16.1046 4 15 4H5C3.89543 4 3 4.89543 3 6V12C3 13.1046 3.89543 14 5 14H7V18L7.58579 17.4142Z" />
          </svg>
        );
      case 'mention':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        );
      case 'comment':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8H19C20.1046 8 21 8.89543 21 10V16C21 17.1046 20.1046 18 19 18H17V22L13 18H9C8.44772 18 7.94772 17.7761 7.58579 17.4142M7.58579 17.4142L11 14H15C16.1046 14 17 13.1046 17 12V6C17 4.89543 16.1046 4 15 4H5C3.89543 4 3 4.89543 3 6V12C3 13.1046 3.89543 14 5 14H7V18L7.58579 17.4142Z" />
          </svg>
        );
      case 'chatroom_message':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);

    if (notification.type === 'message' && notification.data?.from_user_id) {
      const event = new CustomEvent('openPrivateMessage', {
        detail: {
          userId: notification.data.from_user_id,
          username: notification.data.from_username || notification.sender_username || 'User'
        }
      });
      window.dispatchEvent(event);
      onClose();
    } else if (notification.type === 'chatroom_message' && notification.context_id) {
      router.push(`/chat-room/${notification.context_id}`);
      onClose();
    } else if (notification.type === 'comment' && notification.context_id) {
      router.push(`/post/${notification.context_id}`);
      onClose();
    } else if (notification.type === 'mention') {
      if (notification.context_type === 'chat_room' && notification.context_id) {
        router.push(`/chat-room/${notification.context_id}`);
      } else if (notification.context_type === 'post' && notification.context_id) {
        router.push(`/post/${notification.context_id}`);
      }
      onClose();
    }
  };

  const getNotificationContent = (notification: Notification) => {
    // Helper to safely get translation with fallback
    const safeT = (key: string, params?: Record<string, string | number>, fallback?: string) => {
      const translation = t(key, params);
      return translation !== key ? translation : (fallback || translation);
    };

    switch (notification.type) {
      case 'mention':
        if (notification.context_type === 'chat_room') {
          return {
            title: safeT('notifications.youWereMentioned'),
            message: safeT('notifications.mentionedInChat', {
              username: notification.sender_username || 'Someone',
              roomName: notification.context_name || t('notifications.aChatRoom')
            })
          };
        } else if (notification.context_type === 'post') {
          return {
            title: safeT('notifications.youWereMentioned'),
            message: safeT('notifications.mentionedInPost', {
              username: notification.sender_username || 'Someone',
              postTitle: notification.context_name || t('notifications.aPost')
            })
          };
        } else {
          // Fallback generic mention
          return {
            title: safeT('notifications.youWereMentioned'),
            message: safeT('notifications.mentionedYou', {
              username: notification.sender_username || 'Someone'
            })
          };
        }

      case 'message':
        return {
          title: safeT('notifications.newPrivateMessage'),
          message: safeT('notifications.newMessageFrom', {
            username: notification.sender_username || 'User'
          })
        };

      case 'chatroom_message':
        return {
          title: safeT('notifications.newMessageInRoom', {
            roomName: notification.context_name || 'Chat'
          }),
          message: safeT('notifications.messageFromUser', {
            username: notification.sender_username || 'User'
          })
        };

      case 'invitation':
        return {
          title: safeT('notifications.chatInvitation'),
          message: safeT('notifications.invitedToChat', {
            inviter: notification.sender_username || 'Someone',
            roomName: notification.context_name || t('notifications.aChatRoom')
          })
        };

      case 'friend_request':
        return {
          title: safeT('notifications.friendRequestReceived'),
          message: safeT('notifications.friendRequestFrom', {
            username: notification.sender_username || 'User'
          })
        };

      case 'comment':
        return {
          title: safeT('notifications.newCommentOnPost'),
          message: safeT('notifications.newCommentsOnPost', {
            count: 1,
            postTitle: notification.context_name || 'post'
          })
        };

      case 'report':
        return {
          title: safeT('notifications.reportUpdate'),
          message: notification.message // Usually specific message from admin
        };

      case 'system':
        return {
          title: safeT('notifications.systemMessage'),
          message: notification.message
        };

      default:
        return {
          title: notification.title,
          message: notification.message
        };
    }
  };

  const generalNotifications = notifications.filter(n => n.type !== 'mention');
  const mentionNotifications = notifications.filter(n => n.type === 'mention');
  const displayedNotifications = activeTab === 'general' ? generalNotifications : mentionNotifications;

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
          className="bg-white dark:bg-gray-800 border theme-border rounded-lg shadow-xl w-full max-w-4xl mx-4 sm:mx-auto max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b theme-border">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-bold theme-text-primary">
                {t('notifications.title') || 'Notifications'}
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${activeTab === 'general'
                    ? 'theme-blue-primary text-white'
                    : 'theme-bg-tertiary theme-text-secondary hover:theme-bg-hover'
                    }`}
                >
                  {t('notifications.general') || 'General'}
                </button>
                <button
                  onClick={() => setActiveTab('mentions')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${activeTab === 'mentions'
                    ? 'theme-blue-primary text-white'
                    : 'theme-bg-tertiary theme-text-secondary hover:theme-bg-hover'
                    }`}
                >
                  {t('notifications.mentions') || 'Mentions'}
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
              >
                <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-3 border-b theme-border flex items-center space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${filter === 'all'
                ? 'theme-blue-primary text-white'
                : 'theme-bg-tertiary theme-text-secondary hover:theme-bg-hover'
                }`}
            >
              {t('notifications.all') || 'All'}
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${filter === 'unread'
                ? 'theme-blue-primary text-white'
                : 'theme-bg-tertiary theme-text-secondary hover:theme-bg-hover'
                }`}
            >
              {t('notifications.unread') || 'Unread'}
            </button>
          </div>

          {/* Actions Line */}
          <div className="px-6 py-2 border-b theme-border flex justify-end">
            <button
              onClick={markAllAsRead}
              className="px-3 py-1 text-sm theme-bg-tertiary theme-text-primary rounded-lg hover:theme-bg-hover transition-colors whitespace-nowrap"
            >
              {t('notifications.markAllRead') || 'Mark all read'}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 theme-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-lg theme-text-primary mb-2">
                  {activeTab === 'mentions'
                    ? (t('notifications.noMentions') || 'No mentions yet')
                    : (t('notifications.noNotifications') || 'No notifications')
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedNotifications.map((notification) => {
                  const content = getNotificationContent(notification);

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-lg border theme-border relative group cursor-pointer hover:theme-bg-tertiary transition-colors ${!notification.read ? 'theme-bg-primary' : ''
                        }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* X button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        title={t('notifications.delete') || 'Delete'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>

                      <div className="flex items-start space-x-3 pr-6">
                        <div className={`p-2 rounded-full ${notification.type === 'message' ? 'theme-blue-primary' :
                          notification.type === 'mention' ? 'bg-purple-500' :
                            notification.type === 'comment' ? 'bg-green-500' :
                              notification.type === 'chatroom_message' ? 'bg-blue-500' :
                                'theme-bg-tertiary'
                          }`}>
                          <div className={notification.type === 'message' || notification.type === 'mention' || notification.type === 'comment' || notification.type === 'chatroom_message' ? 'text-white' : 'theme-text-primary'}>
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium theme-text-primary">
                              {content.title}
                            </p>
                            {!notification.read && (
                              <div className="w-2 h-2 theme-blue-primary rounded-full" />
                            )}
                          </div>
                          <p className="text-xs theme-text-secondary mt-1">
                            {content.message}
                          </p>
                          <p className="text-xs theme-text-muted mt-2">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full py-3 theme-bg-tertiary theme-text-primary rounded-lg hover:theme-bg-hover transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      t('notifications.loadMore') || 'Load more'
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationsModal;

