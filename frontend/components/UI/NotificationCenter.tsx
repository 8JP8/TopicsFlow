import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: 'message' | 'mention' | 'report' | 'system' | 'invitation' | 'friend_request' | 'comment' | 'chatroom_message';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any; // Additional data for actions (e.g., invitation_id, room_id, request_id, post_id, comment_id)
  sender_username?: string; // For aggregating messages
  room_id?: string; // For aggregating chatroom messages
  chat_room_id?: string; // For chatroom messages
  post_id?: string; // For comment notifications
  count?: number; // For aggregated notifications
  context_id?: string; // Context ID (chat_room_id, post_id, etc.)
  context_type?: string; // Context type (chat_room, post, etc.)
  context_name?: string; // Context name (chatroom name, post title, etc.)
}

interface NotificationCenterProps {
  onOpenNotificationsModal?: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onOpenNotificationsModal }) => {
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  // Play notification sound using Web Audio API
  const playNotificationSound = () => {
    try {
      if (typeof window === 'undefined' || !window.AudioContext && !(window as any).webkitAudioContext) {
        return;
      }

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      
      // Create a pleasant notification tone (two-tone chime)
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect oscillators to gain node
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // First tone: 800Hz
      oscillator1.frequency.value = 800;
      oscillator1.type = 'sine';
      
      // Second tone: 1000Hz (plays slightly after first)
      oscillator2.frequency.value = 1000;
      oscillator2.type = 'sine';
      
      // Envelope for smooth sound
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      
      // Start oscillators
      oscillator1.start(now);
      oscillator2.start(now + 0.1);
      
      // Stop oscillators
      oscillator1.stop(now + 0.3);
      oscillator2.stop(now + 0.3);
      
      // Clean up
      oscillator1.onended = () => {
        audioContext.close();
      };
    } catch (error) {
      // Silently fail - sound is optional
      console.warn('Failed to play notification sound:', error);
    }
  };

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

  // Fetch notifications from API
  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.LIST, {
        limit: 100,
        unread_only: false
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
          room_id: notif.data?.room_id || notif.data?.chat_room_id,
          chat_room_id: notif.data?.chat_room_id || notif.context_id,
          post_id: notif.data?.post_id || notif.context_id,
          context_id: notif.context_id || notif.data?.chat_room_id || notif.data?.post_id,
          context_type: notif.context_type,
          context_name: notif.context_name || notif.data?.chat_room_name || notif.data?.post_title,
        }));
        
        setNotifications(fetchedNotifications);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notifications on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

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

        // Play notification sound
        playNotificationSound();

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
        
        // Refresh notifications from API
        fetchNotifications();
      } else {
        console.log('[NotificationCenter] Message not for current user, ignoring:', {
          isForCurrentUser,
          isFromCurrentUser,
        });
      }
    };

    const handleUserMentioned = (data: any) => {
      console.log('[NotificationCenter] User mentioned event received:', {
        contentId: data.content_id,
        contentType: data.content_type,
        senderUsername: data.sender_username,
        chatRoomName: data.context?.chat_room_name,
        postTitle: data.context?.post_title,
      });
      
      // Build message based on context
      const senderUsername = data.sender_username || data.mentioned_by || data.data?.sender_username || t('notifications.someone');
      const chatRoomName = data.context?.chat_room_name || data.data?.chat_room_name;
      const postTitle = data.context?.post_title || data.data?.post_title;
      
      let message = '';
      if (chatRoomName) {
        message = `${senderUsername} mentioned you on "${chatRoomName}"`;
      } else if (postTitle) {
        message = `${senderUsername} mentioned you on "${postTitle}"`;
      } else {
        message = `${senderUsername} mentioned you`;
      }
      
      const notification: Notification = {
        id: `mention-${data.content_id || data.message_id || data.notification_id || Date.now()}`,
        type: 'mention',
        title: t('notifications.youWereMentioned') || 'You were mentioned',
        message: message,
        timestamp: data.created_at || data.timestamp || new Date().toISOString(),
        read: false,
        data: {
          content_id: data.content_id || data.message_id,
          content_type: data.content_type,
          sender_id: data.sender_id || data.mentioned_by_id,
          sender_username: senderUsername,
          chat_room_id: data.context?.chat_room_id || data.data?.chat_room_id,
          chat_room_name: chatRoomName,
          post_id: data.context?.post_id || data.data?.post_id,
          post_title: postTitle,
        },
        sender_username: senderUsername,
        chat_room_id: data.context?.chat_room_id || data.data?.chat_room_id,
        post_id: data.context?.post_id || data.data?.post_id,
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

      // Play notification sound
      playNotificationSound();

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
      
      // Refresh notifications from API
      fetchNotifications();
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
    
    // Listen for new notifications from API
    const handleNewNotification = (data: any) => {
      console.log('[NotificationCenter] New notification received:', data);
      
      // Add notification to state immediately
      const notification: Notification = {
        id: data.id || `notification-${Date.now()}`,
        type: data.type || 'system',
        title: data.title || 'New notification',
        message: data.message || '',
        timestamp: data.timestamp || data.created_at || new Date().toISOString(),
        read: false,
        data: data.data || {},
        sender_username: data.sender_username || data.data?.sender_username || data.data?.from_username,
        context_id: data.context_id || data.data?.chat_room_id || data.data?.post_id,
        context_type: data.context_type,
        context_name: data.context_name || data.data?.chat_room_name || data.data?.post_title,
      };
      
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
      
      // Play notification sound
      playNotificationSound();
      
      // Show browser notification based on type
      let title = notification.title;
      let body = notification.message;
      
      if (notification.type === 'message' && notification.sender_username) {
        title = t('notifications.newMessageFrom', { username: notification.sender_username });
        body = notification.data?.preview || notification.message;
      } else if (notification.type === 'chatroom_message' && notification.context_name) {
        title = t('notifications.newMessageInRoom', { roomName: notification.context_name });
        body = `${notification.sender_username || t('notifications.someone')}: ${notification.message}`;
      }
      
      showBrowserNotification(title, body, notification.id);
      
      // Also refresh from API to ensure consistency
      fetchNotifications();
    };
    
    socket.on('new_notification', handleNewNotification);
    
    console.log('[NotificationCenter] All notification listeners registered');

    return () => {
      console.log('[NotificationCenter] Cleaning up listeners');
      socket.off('new_private_message', handleNewPrivateMessage);
      socket.off('user_mentioned', handleUserMentioned);
      socket.off('chat_room_invitation', handleChatRoomInvitation);
      socket.off('friend_request_received', handleFriendRequestReceived);
      socket.off('new_notification', handleNewNotification);
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

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(API_ENDPOINTS.NOTIFICATIONS.DELETE(id));
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error(t('notifications.deleteFailed') || 'Failed to delete notification');
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
      // Still update locally on error
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      // Still update locally on error
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
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

    // Aggregate similar notifications by type and entity
    const aggregatedMap = new Map<string, Notification[]>();
    
    aggregated.forEach(notif => {
      let key: string;
      
      if (notif.type === 'message' && notif.sender_username) {
        // Group private messages by sender: "1 new message from Guy" or "2 new messages from Guy"
        key = `message-${notif.data?.from_user_id || notif.sender_username}`;
      } else if (notif.type === 'chatroom_message' && notif.chat_room_id) {
        // Group chatroom messages by room: "1 new message in Room" or "3 new messages in Room"
        key = `chatroom-${notif.chat_room_id}`;
      } else if (notif.type === 'comment' && notif.post_id) {
        // Group comments by post: "1 new comment on Post" or "5 new comments on Post"
        key = `comment-${notif.post_id}`;
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
    const aggregatedGrouped: Array<{ notifications: Notification[], count: number, displayMessage: string, displayTitle: string }> = [];
    
    aggregatedMap.forEach((group, key) => {
      const sortedGroup = group.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const latest = sortedGroup[0];
      
      let displayMessage = '';
      let displayTitle = latest.title;
      
      if (key.startsWith('message-')) {
        // Private messages: "new message from Guy" or "3 new messages from Jeff"
        const username = latest.sender_username || latest.data?.sender_username || latest.data?.from_username || t('notifications.someone');
        if (group.length === 1) {
          displayTitle = t('notifications.newMessageFrom', { username }) || `New message from ${username}`;
          displayMessage = latest.data?.preview || latest.message || '';
        } else {
          const messagesText = t('notifications.newMessagesFrom', { count: group.length, username }) || `new messages from ${username}`;
          displayTitle = `${group.length} ${messagesText}`;
          displayMessage = `${group.length} ${messagesText}`;
        }
      } else if (key.startsWith('chatroom-')) {
        // Chatroom messages: "4 new messages for 'SOME' chatroom"
        const roomName = latest.data?.chat_room_name || latest.data?.room_name || latest.context_name || t('notifications.aChatRoom') || 'a chatroom';
        if (group.length === 1) {
          displayTitle = t('notifications.newMessageInRoom', { roomName }) || `New message in "${roomName}"`;
          displayMessage = latest.message || '';
        } else {
          const messagesText = t('notifications.newMessagesInRoom', { count: group.length, roomName }) || `new messages for "${roomName}"`;
          displayTitle = `${group.length} ${messagesText}`;
          displayMessage = `${group.length} ${messagesText}`;
        }
      } else if (key.startsWith('comment-')) {
        // Comments: "2 new comments on 'Hello' publication"
        const postTitle = latest.data?.post_title || latest.context_name || t('notifications.aPost') || 'a publication';
        if (group.length === 1) {
          displayTitle = t('notifications.newCommentOnPost', { postTitle }) || `New comment on "${postTitle}"`;
          displayMessage = latest.message || '';
        } else {
          const commentsText = t('notifications.newCommentsOnPost', { count: group.length, postTitle }) || `new comments on "${postTitle}"`;
          displayTitle = `${group.length} ${commentsText}`;
          displayMessage = `${group.length} ${commentsText}`;
        }
      } else {
        displayMessage = latest.message;
      }

      aggregatedGrouped.push({
        notifications: sortedGroup,
        count: group.length,
        displayMessage,
        displayTitle,
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
                          <div className="px-4 py-2 border-b theme-border bg-theme-bg-tertiary">
                            <h4 className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                              {t('notifications.general') || 'General'}
                            </h4>
                          </div>
                          {aggregated.map((group, idx) => {
                            const notification = group.notifications[0];
                            const hasUnread = group.notifications.some(n => !n.read);
                            
                            return (
                              <div
                                key={`aggregated-${idx}`}
                                className={`px-4 py-3 border-b theme-border relative group ${
                                  hasUnread ? 'theme-bg-primary' : ''
                                }`}
                              >
                                {/* X button to close/delete */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    group.notifications.forEach(n => deleteNotification(n.id));
                                  }}
                                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title={t('notifications.delete') || 'Delete'}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                
                                {/* Clickable area (except X and link icon) */}
                                <div
                                  className="cursor-pointer hover:theme-bg-tertiary transition-colors -mx-4 -my-3 px-4 py-3"
                                  onClick={() => {
                                    group.notifications.forEach(n => markAsRead(n.id));
                                    if (onOpenNotificationsModal) {
                                      onOpenNotificationsModal();
                                      setIsOpen(false);
                                    }
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
                                          {group.displayTitle || notification.title}
                                        </p>
                                        {hasUnread && (
                                          <div className="w-2 h-2 theme-blue-primary rounded-full" />
                                        )}
                                      </div>
                                      <p className="text-xs theme-text-secondary mt-1">
                                        {group.displayMessage || notification.message}
                                      </p>
                                      <div className="flex items-center justify-between mt-2">
                                        <p className="text-xs theme-text-muted">
                                          {formatTimestamp(notification.timestamp)}
                                        </p>
                                        {/* Navigation button - simple gray link icon */}
                                        {(() => {
                                        if (notification.type === 'message' && notification.data?.from_user_id) {
                                          return (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                group.notifications.forEach(n => markAsRead(n.id));
                                                // Dispatch event to open private messages
                                                const event = new CustomEvent('openPrivateMessage', {
                                                  detail: {
                                                    userId: notification.data.from_user_id,
                                                    username: notification.data.from_username || notification.sender_username || 'User'
                                                  }
                                                });
                                                window.dispatchEvent(event);
                                                setIsOpen(false);
                                              }}
                                              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                                              title={t('notifications.goToMessages') || 'Go to messages'}
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                              </svg>
                                            </button>
                                          );
                                        } else if (notification.type === 'chatroom_message' && (notification.data?.chat_room_id || notification.chat_room_id || notification.context_id)) {
                                          const chatRoomId = notification.data?.chat_room_id || notification.chat_room_id || notification.context_id;
                                          return (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                group.notifications.forEach(n => markAsRead(n.id));
                                                router.push(`/chat-room/${chatRoomId}`);
                                                setIsOpen(false);
                                              }}
                                              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                                              title={t('notifications.goToChatroom') || 'Go to chatroom'}
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                              </svg>
                                            </button>
                                          );
                                        } else if (notification.type === 'comment' && (notification.data?.post_id || notification.post_id || notification.context_id)) {
                                          const postId = notification.data?.post_id || notification.post_id || notification.context_id;
                                          return (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                group.notifications.forEach(n => markAsRead(n.id));
                                                router.push(`/post/${postId}`);
                                                setIsOpen(false);
                                              }}
                                              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                                              title={t('notifications.goToPost') || 'Go to post'}
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                              </svg>
                                            </button>
                                          );
                                        } else if (notification.type === 'invitation' && notification.data) {
                                          return (
                                            <div className="flex gap-2">
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
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
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
                            <div className="px-4 py-2 border-t-2 border-b theme-border bg-theme-bg-tertiary">
                              <h4 className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                                {t('notifications.mentions') || 'Mentions'}
                              </h4>
                            </div>
                          )}
                          {mentions.map((notification) => (
                            <div
                              key={notification.id}
                              className={`px-4 py-3 border-b theme-border last:border-b-0 relative group ${
                                !notification.read ? 'theme-bg-primary' : ''
                              }`}
                            >
                              {/* X button to close/delete */}
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
                              
                              {/* Clickable area (except X and link icon) */}
                              <div
                                className="cursor-pointer hover:theme-bg-tertiary transition-colors -mx-4 -my-3 px-4 py-3"
                                onClick={() => {
                                  markAsRead(notification.id);
                                  if (onOpenNotificationsModal) {
                                    onOpenNotificationsModal();
                                    setIsOpen(false);
                                  }
                                }}
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
                                    <div className="flex items-center justify-between mt-2">
                                      <p className="text-xs theme-text-muted">
                                        {formatTimestamp(notification.timestamp)}
                                      </p>
                                      {/* Navigation button for mentions - simple gray link icon */}
                                      {(() => {
                                        if (notification.data?.chat_room_id || notification.context_id) {
                                          const chatRoomId = notification.data?.chat_room_id || notification.context_id;
                                          return (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                markAsRead(notification.id);
                                                router.push(`/chat-room/${chatRoomId}`);
                                                setIsOpen(false);
                                              }}
                                              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                              title={t('notifications.goToChatroom') || 'Go to chatroom'}
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                              </svg>
                                            </button>
                                          );
                                        } else if (notification.data?.post_id || notification.context_id) {
                                          const postId = notification.data?.post_id || notification.context_id;
                                          return (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                markAsRead(notification.id);
                                                router.push(`/post/${postId}`);
                                                setIsOpen(false);
                                              }}
                                              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                              title={t('notifications.goToPost') || 'Go to post'}
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                              </svg>
                                            </button>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </div>
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