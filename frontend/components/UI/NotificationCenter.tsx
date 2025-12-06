import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: 'message' | 'mention' | 'report' | 'system' | 'invitation' | 'friend_request';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any; // Additional data for actions (e.g., invitation_id, room_id, request_id)
  sender_username?: string; // For aggregating messages
  room_id?: string; // For aggregating chatroom messages
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
      // Ensure strict string comparison to avoid type coercion issues
      const isForCurrentUser = String(data.to_user_id) === String(user.id);
      const isFromCurrentUser = String(data.from_user_id) === String(user.id);

      console.log('[NotificationCenter] User ID comparison:', {
        dataToUserId: data.to_user_id,
        dataFromUserId: data.from_user_id,
        currentUserId: user.id,
        isForCurrentUser,
        isFromCurrentUser,
      });

      if (isForCurrentUser && !isFromCurrentUser) {
        console.log('[NotificationCenter] Adding notification for private message');
        const notification: Notification = {
          id: `pm-${data.id || Date.now()}`,
          type: 'message',
          title: t('notifications.newPrivateMessage'),
          message: `${data.sender_username || t('notifications.someone')} sent you a message: ${data.preview || data.content?.substring(0, 50) || ''}`,
          timestamp: data.created_at || new Date().toISOString(),
          read: false,
          sender_username: data.sender_username,
          data: {
            message_id: data.id,
            from_user_id: data.from_user_id,
            preview: data.preview || data.content?.substring(0, 50) || '',
          },
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
        message: `${t('notifications.mentionedBy', { 
          username: data.mentioned_by || t('notifications.someone'),
          topic: data.topic_title || t('home.topics')
        })}\n${data.content_preview || data.content || ''}`,
        timestamp: data.created_at || new Date().toISOString(),
        read: false,
        data: {
          message_id: data.message_id,
          mentioned_by: data.mentioned_by,
          topic_title: data.topic_title,
          content_preview: data.content_preview || data.content,
        },
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

    const handleChatRoomInvitation = (data: any) => {
      console.log('[NotificationCenter] Chat room invitation received:', data);
      
      const notification: Notification = {
        id: `invitation-${data.room_id}-${Date.now()}`,
        type: 'invitation',
        title: t('notifications.chatInvitation') || 'Chat Room Invitation',
        message: t('notifications.invitedToChat', { 
          inviter: data.invited_by_username || t('notifications.someone'),
          roomName: data.room_name || t('notifications.aChatRoom')
        }),
        timestamp: new Date().toISOString(),
        read: false,
        data: {
          invitation_id: data.invitation_id,
          room_id: data.room_id,
          room_name: data.room_name,
          invited_by: data.invited_by,
          invited_by_username: data.invited_by_username
        }
      };

      // Add to notifications
      setNotifications(prev => {
        // Check if notification already exists
        const exists = prev.some(n => n.id === notification.id || (n.type === 'invitation' && n.data?.room_id === data.room_id && !n.read));
        if (exists) {
          console.log('[NotificationCenter] Invitation notification already exists, skipping');
          return prev;
        }
        console.log('[NotificationCenter] Adding invitation notification to state');
        return [notification, ...prev];
      });

      // Show toast notification
      toast.success(t('notifications.invitedToChat', { 
        inviter: data.invited_by_username || t('notifications.someone'),
        roomName: data.room_name || t('notifications.aChatRoom')
      }), {
        duration: 5000,
        icon: '💬',
      });

      // Show browser notification
      showBrowserNotification(
        t('notifications.chatInvitation') || 'Chat Room Invitation',
        t('notifications.invitedToChat', { 
          inviter: data.invited_by_username || t('notifications.someone'),
          roomName: data.room_name || t('notifications.aChatRoom')
        }),
        `invitation-${data.room_id}`
      );
    };

    const handleFriendRequestReceived = (data: any) => {
      console.log('[NotificationCenter] Friend request received:', data);
      
      const notification: Notification = {
        id: `friend_request-${data.request_id}-${Date.now()}`,
        type: 'friend_request',
        title: t('notifications.friendRequestReceived') || 'New Friend Request',
        message: t('notifications.friendRequestFrom', { 
          username: data.from_username || t('notifications.someone')
        }) || `${data.from_username || 'Someone'} sent you a friend request`,
        timestamp: data.created_at || new Date().toISOString(),
        read: false,
        data: {
          request_id: data.request_id,
          from_user_id: data.from_user_id,
          from_username: data.from_username
        }
      };

      // Add to notifications
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id || (n.type === 'friend_request' && n.data?.request_id === data.request_id && !n.read));
        if (exists) {
          console.log('[NotificationCenter] Friend request notification already exists, skipping');
          return prev;
        }
        console.log('[NotificationCenter] Adding friend request notification to state');
        return [notification, ...prev];
      });

      // Show toast notification
      toast.success(t('notifications.friendRequestFrom', { 
        username: data.from_username || t('notifications.someone')
      }) || `${data.from_username || 'Someone'} sent you a friend request`, {
        duration: 5000,
        icon: '👋',
      });

      // Show browser notification
      showBrowserNotification(
        t('notifications.friendRequestReceived') || 'New Friend Request',
        t('notifications.friendRequestFrom', { 
          username: data.from_username || t('notifications.someone')
        }) || `${data.from_username || 'Someone'} sent you a friend request`,
        `friend_request-${data.request_id}`
      );
    };

    socket.on('new_private_message', handleNewPrivateMessage);
    socket.on('user_mentioned', handleUserMentioned);
    socket.on('chat_room_invitation', handleChatRoomInvitation);
    socket.on('friend_request_received', handleFriendRequestReceived);
    console.log('[NotificationCenter] Private message, mention, invitation, and friend request listeners registered');

    return () => {
      console.log('[NotificationCenter] Cleaning up listeners');
      socket.off('new_private_message', handleNewPrivateMessage);
      socket.off('user_mentioned', handleUserMentioned);
      socket.off('chat_room_invitation', handleChatRoomInvitation);
      socket.off('friend_request_received', handleFriendRequestReceived);
    };
  }, [socket, connected, user, t]);

  // Fetch pending invitations on mount
  useEffect(() => {
    const fetchPendingInvitations = async () => {
      if (!user) return;
      
      try {
        const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_INVITATIONS);
        if (response.data.success && response.data.data) {
          const invitationNotifications = response.data.data.map((inv: any) => ({
            id: `invitation-${inv.room_id}-${inv.id}`,
            type: 'invitation' as const,
            title: t('notifications.chatInvitation') || 'Chat Room Invitation',
            message: t('notifications.invitedToChat', { 
              inviter: inv.invited_by?.username || t('notifications.someone'),
              roomName: inv.room_name || t('notifications.aChatRoom')
            }),
            timestamp: inv.created_at,
            read: false,
            data: {
              invitation_id: inv.id,
              room_id: inv.room_id,
              room_name: inv.room_name,
              invited_by: inv.invited_by?.id,
              invited_by_username: inv.invited_by?.username
            }
          }));

          setNotifications(prev => {
            // Merge with existing notifications, avoiding duplicates
            const existingIds = new Set(prev.map((n: Notification) => n.id));
            const newNotifications = invitationNotifications.filter((n: Notification) => !existingIds.has(n.id));
            return [...newNotifications, ...prev];
          });
        }
      } catch (error) {
        console.error('Failed to fetch pending invitations:', error);
      }
    };

    fetchPendingInvitations();
  }, [user, t]);

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

  const handleAcceptInvitation = async (invitationId: string, roomId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.ACCEPT_INVITATION(invitationId));
      if (response.data.success) {
        toast.success(t('notifications.invitationAccepted') || 'Invitation accepted');
        // Remove notification
        setNotifications(prev => prev.filter(n => !(n.type === 'invitation' && n.data?.invitation_id === invitationId)));
        // Optionally navigate to the chat room
        // router.push(`/chat-room/${roomId}`);
      } else {
        toast.error(response.data.errors?.[0] || t('notifications.failedToAccept') || 'Failed to accept invitation');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('notifications.failedToAccept') || 'Failed to accept invitation');
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.DECLINE_INVITATION(invitationId));
      if (response.data.success) {
        toast.success(t('notifications.invitationDeclined') || 'Invitation declined');
        // Remove notification
        setNotifications(prev => prev.filter(n => !(n.type === 'invitation' && n.data?.invitation_id === invitationId)));
      } else {
        toast.error(response.data.errors?.[0] || t('notifications.failedToDecline') || 'Failed to decline invitation');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('notifications.failedToDecline') || 'Failed to decline invitation');
    }
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
      case 'invitation':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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

  // Group notifications into aggregated and mentions
  const groupNotifications = () => {
    const aggregated: Notification[] = [];
    const mentions: Notification[] = [];

    notifications.forEach(notification => {
      if (notification.type === 'mention') {
        mentions.push(notification);
      } else {
        aggregated.push(notification);
      }
    });

    // Aggregate similar notifications
    const aggregatedMap = new Map<string, Notification[]>();
    
    aggregated.forEach(notif => {
      let key: string;
      
      if (notif.type === 'message' && notif.sender_username) {
        // Group messages by sender
        key = `message-${notif.sender_username}`;
      } else if (notif.type === 'invitation' && notif.data?.room_id) {
        // Group invitations by room
        key = `invitation-${notif.data.room_id}`;
      } else {
        // Keep other notifications separate
        key = `other-${notif.id}`;
      }

      if (!aggregatedMap.has(key)) {
        aggregatedMap.set(key, []);
      }
      aggregatedMap.get(key)!.push(notif);
    });

    // Convert aggregated groups to display format
    const aggregatedGrouped: Array<{ notifications: Notification[], count: number, displayMessage: string }> = [];
    
    aggregatedMap.forEach((group, key) => {
      const sortedGroup = group.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const latest = sortedGroup[0];
      
      let displayMessage = '';
      if (key.startsWith('message-')) {
        if (group.length === 1) {
          displayMessage = t('notifications.messageFromUser', { username: latest.sender_username || t('notifications.someone') });
        } else {
          displayMessage = `${group.length} ${t('notifications.messageFromUser', { username: latest.sender_username || t('notifications.someone') })}`;
        }
      } else {
        displayMessage = latest.message;
      }

      aggregatedGrouped.push({
        notifications: sortedGroup,
        count: group.length,
        displayMessage,
      });
    });

    // Sort by most recent
    aggregatedGrouped.sort((a, b) => {
      const aTime = new Date(a.notifications[0].timestamp).getTime();
      const bTime = new Date(b.notifications[0].timestamp).getTime();
      return bTime - aTime;
    });

    mentions.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return bTime - aTime;
    });

    return { aggregated: aggregatedGrouped, mentions };
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
                (() => {
                  const { aggregated, mentions } = groupNotifications();
                  return (
                    <>
                      {/* Aggregated Notifications Section */}
                      {aggregated.length > 0 && (
                        <>
                          <div className="px-4 py-2 border-b theme-border">
                            <h4 className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                              {t('notifications.aggregatedNotifications')}
                            </h4>
                          </div>
                          {aggregated.map((group, idx) => {
                            const notification = group.notifications[0];
                            const hasUnread = group.notifications.some(n => !n.read);
                            
                            return (
                              <div
                                key={`aggregated-${idx}`}
                                className={`px-4 py-3 border-b theme-border cursor-pointer hover:theme-bg-tertiary transition-colors ${
                                  hasUnread ? 'theme-bg-primary' : ''
                                }`}
                                onClick={() => {
                                  group.notifications.forEach(n => markAsRead(n.id));
                                }}
                              >
                                <div className="flex items-start space-x-3">
                                  <div className={`p-2 rounded-full ${
                                    notification.type === 'message' ? 'theme-blue-primary' :
                                    notification.type === 'invitation' ? 'bg-purple-500' :
                                    notification.type === 'report' ? 'bg-red-500' :
                                    'theme-bg-tertiary'
                                  }`}>
                                    <div className={`${
                                      notification.type === 'message' || notification.type === 'invitation' ? 'text-white' :
                                      notification.type === 'report' ? 'text-white' :
                                      'theme-text-primary'
                                    }`}>
                                      {getNotificationIcon(notification.type)}
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium theme-text-primary truncate">
                                        {group.count > 1 && notification.type === 'message' ? (
                                          `${group.count} ${t('notifications.messageFromUser', { username: notification.sender_username || t('notifications.someone') })}`
                                        ) : (
                                          notification.title
                                        )}
                                      </p>
                                      {hasUnread && (
                                        <div className="w-2 h-2 theme-blue-primary rounded-full" />
                                      )}
                                    </div>
                                    <p className="text-xs theme-text-secondary mt-1">
                                      {group.displayMessage || notification.message}
                                    </p>
                                    {notification.type === 'invitation' && notification.data && (
                                      <div className="flex gap-2 mt-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAcceptInvitation(notification.data.invitation_id, notification.data.room_id);
                                            group.notifications.forEach(n => markAsRead(n.id));
                                          }}
                                          className="px-2 py-1 text-xs btn btn-primary"
                                        >
                                          {t('notifications.accept') || 'Accept'}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeclineInvitation(notification.data.invitation_id);
                                            group.notifications.forEach(n => markAsRead(n.id));
                                          }}
                                          className="px-2 py-1 text-xs btn btn-secondary"
                                        >
                                          {t('notifications.decline') || 'Decline'}
                                        </button>
                                      </div>
                                    )}
                                    <p className="text-xs theme-text-muted mt-1">
                                      {formatTimestamp(notification.timestamp)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Mentions Section */}
                      {mentions.length > 0 && (
                        <>
                          {aggregated.length > 0 && (
                            <div className="px-4 py-2 border-t-2 border-b theme-border">
                              <h4 className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                                {t('notifications.mentions')}
                              </h4>
                            </div>
                          )}
                          {mentions.map((notification) => (
                            <div
                              key={notification.id}
                              className={`px-4 py-3 border-b theme-border last:border-b-0 cursor-pointer hover:theme-bg-tertiary transition-colors ${
                                !notification.read ? 'theme-bg-primary' : ''
                              }`}
                              onClick={() => markAsRead(notification.id)}
                            >
                              <div className="flex items-start space-x-3">
                                <div className="p-2 rounded-full theme-blue-secondary">
                                  <div className="text-white">
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
                                  <p className="text-xs theme-text-secondary mt-1 whitespace-pre-wrap break-words">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs theme-text-muted mt-1">
                                    {formatTimestamp(notification.timestamp)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;