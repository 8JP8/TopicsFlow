import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: 'message' | 'mention' | 'report' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const NotificationCenter: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Helper function to show browser notification
  const showBrowserNotification = (title: string, body: string, tag?: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: tag || `notification-${Date.now()}`,
          requireInteraction: false,
        });
      } catch (error) {
        console.error('Failed to show browser notification:', error);
      }
    }
  };

  // Listen for private messages
  useEffect(() => {
    if (!socket || !connected || !user) {
      console.log('[NotificationCenter] Not listening - missing socket, connection, or user');
      return;
    }

    console.log('[NotificationCenter] Setting up private message listener');

    const handleNewPrivateMessage = (data: any) => {
      console.log('[NotificationCenter] New private message received:', {
        messageId: data.id,
        fromUserId: data.from_user_id,
        toUserId: data.to_user_id,
        currentUserId: user.id,
        senderUsername: data.sender_username,
      });
      
      // Only show notification if message is for current user (not from them)
      // For self-messages, data.is_from_me will be false, so we should still show it
      const isForCurrentUser = data.to_user_id === user.id;
      const isFromCurrentUser = data.from_user_id === user.id;
      
      if (isForCurrentUser && !isFromCurrentUser) {
        console.log('[NotificationCenter] Adding notification for private message');
        const notification: Notification = {
          id: `pm-${data.id || Date.now()}`,
          type: 'message',
          title: t('notifications.newPrivateMessage'),
          message: `${data.sender_username || t('notifications.someone')} sent you a message: ${data.preview || data.content?.substring(0, 50) || ''}`,
          timestamp: data.created_at || new Date().toISOString(),
          read: false,
        };

        // Add to notifications
        setNotifications(prev => {
          // Check if notification already exists
          const exists = prev.some(n => n.id === notification.id);
          if (exists) {
            console.log('[NotificationCenter] Notification already exists, skipping');
            return prev;
          }
          console.log('[NotificationCenter] Adding new notification to state');
          return [notification, ...prev];
        });

        // Show toast notification
        toast.success(t('notifications.newMessageFrom', { username: data.sender_username || t('notifications.someone') }), {
          duration: 5000,
          icon: '💬',
        });

        // Show browser notification
        showBrowserNotification(
          t('notifications.newMessageFrom', { username: data.sender_username || t('notifications.someone') }),
          data.preview || data.content?.substring(0, 100) || t('notifications.newPrivateMessage'),
          `pm-${data.id}`
        );
      } else {
        console.log('[NotificationCenter] Message not for current user, ignoring:', {
          isForCurrentUser,
          isFromCurrentUser,
        });
      }
    };

    const handleUserMentioned = (data: any) => {
      console.log('[NotificationCenter] User mentioned event received:', {
        topicId: data.topic_id,
        topicTitle: data.topic_title,
        mentionedBy: data.mentioned_by,
        mentionedName: data.mentioned_name,
      });
      
      const notification: Notification = {
        id: `mention-${data.message_id || Date.now()}`,
        type: 'mention',
        title: t('notifications.youWereMentioned'),
        message: t('notifications.mentionedBy', { 
          username: data.mentioned_by || t('notifications.someone'),
          topic: data.topic_title || t('home.topics')
        }) + `: ${data.content_preview || ''}`,
        timestamp: data.created_at || new Date().toISOString(),
        read: false,
      };

      // Add to notifications
      setNotifications(prev => {
        // Check if notification already exists
        const exists = prev.some(n => n.id === notification.id);
        if (exists) {
          console.log('[NotificationCenter] Mention notification already exists, skipping');
          return prev;
        }
        console.log('[NotificationCenter] Adding mention notification to state');
        return [notification, ...prev];
      });

      // Show toast notification
      toast.success(t('notifications.mentionedBy', { 
        username: data.mentioned_by || t('notifications.someone'),
        topic: data.topic_title || t('home.topics')
      }), {
        duration: 5000,
        icon: '🔔',
      });

      // Show browser notification
      showBrowserNotification(
        t('notifications.youWereMentioned'),
        t('notifications.mentionedBy', { 
          username: data.mentioned_by || t('notifications.someone'),
          topic: data.topic_title || t('home.topics')
        }) + `: ${data.content_preview || ''}`,
        `mention-${data.message_id}`
      );
    };

    socket.on('new_private_message', handleNewPrivateMessage);
    socket.on('user_mentioned', handleUserMentioned);
    console.log('[NotificationCenter] Private message and mention listeners registered');

    return () => {
      console.log('[NotificationCenter] Cleaning up listeners');
      socket.off('new_private_message', handleNewPrivateMessage);
      socket.off('user_mentioned', handleUserMentioned);
    };
  }, [socket, connected, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'message':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'mention':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
      case 'report':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'system':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60 * 1000) {
      return t('notifications.justNow');
    } else if (diff < 60 * 60 * 1000) {
      return t('notifications.minutesAgo', { count: Math.floor(diff / (60 * 1000)) });
    } else if (diff < 24 * 60 * 60 * 1000) {
      return t('notifications.hoursAgo', { count: Math.floor(diff / (60 * 60 * 1000)) });
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="relative" ref={notificationRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
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
          <div className="absolute right-0 top-full mt-2 w-80 theme-bg-secondary border theme-border rounded-lg shadow-lg z-20">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b theme-border">
              <h3 className="text-sm font-medium theme-text-primary">{t('notifications.title')}</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs theme-blue-primary hover:underline"
                >
                  {t('notifications.markAllAsRead')}
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <svg className="w-12 h-12 theme-text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-sm theme-text-secondary">{t('notifications.noNotifications')}</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b theme-border last:border-b-0 cursor-pointer hover:theme-bg-tertiary transition-colors ${
                      !notification.read ? 'theme-bg-primary' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full ${
                        notification.type === 'message' ? 'theme-blue-primary' :
                        notification.type === 'mention' ? 'theme-blue-secondary' :
                        notification.type === 'report' ? 'bg-red-500' :
                        'theme-bg-tertiary'
                      }`}>
                        <div className={`${
                          notification.type === 'message' || notification.type === 'mention' ? 'text-white' :
                          notification.type === 'report' ? 'text-white' :
                          'theme-text-primary'
                        }`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium theme-text-primary truncate">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 theme-blue-primary rounded-full" />
                          )}
                        </div>
                        <p className="text-xs theme-text-secondary mt-1 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs theme-text-muted mt-1">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;