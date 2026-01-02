import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { toast } from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  onlineUsers: number;
  joinTopic: (topicId: string, useAnonymous?: boolean, customAnonymousName?: string) => void;
  leaveTopic: (topicId: string) => void;
  sendMessage: (topicId: string, content: string, messageType?: string, useAnonymous?: boolean, gifUrl?: string) => void;
  sendPrivateMessage: (toUserId: string, content: string, messageType?: string, gifUrl?: string) => void;
  typingStart: (topicId: string) => void;
  typingStop: (topicId: string) => void;
  markMessagesRead: (fromUserId: string) => void;
  updateAnonymousName: (topicId: string, newName: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    // During SSR, return a safe default instead of throwing
    if (typeof window === 'undefined') {
      return {
        socket: null,
        connected: false,
        onlineUsers: 0,
        joinTopic: () => { },
        leaveTopic: () => { },
        sendMessage: () => { },
        sendPrivateMessage: () => { },
        typingStart: () => { },
        typingStop: () => { },
        markMessagesRead: () => { },
        updateAnonymousName: () => { },
      } as SocketContextType;
    }
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const currentTopics = useRef<Set<string>>(new Set());

  // Initialize socket connection
  // Only depend on user.id to prevent reconnection when user preferences change
  useEffect(() => {
    if (user?.id) {
      // In browser: 
      // - Production (Azure): Use api.topicsflow.me directly
      // - Local Development: Use localhost:5000 directly
      // On server: use BACKEND_IP or NEXT_PUBLIC_API_URL
      let socketUrl: string;
      if (typeof window !== 'undefined') {
        const isProduction = window.location.hostname === 'topicsflow.me' ||
          window.location.hostname === 'www.topicsflow.me' ||
          window.location.hostname.includes('azurestaticapps.net');

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        const backendUrl = process.env.BACKEND_IP || process.env.NEXT_PUBLIC_API_URL;

        if (isProduction) {
          // Production: Always use backend URL or default to api.topicsflow.me
          if (backendUrl) {
            socketUrl = backendUrl;
          } else {
            socketUrl = 'https://api.topicsflow.me';
          }
        } else if (isLocalhost) {
          // Local Development: Prioritize localhost:5000
          if (backendUrl && (backendUrl.includes('topicsflow.me') || backendUrl.includes('azurestaticapps.net'))) {
            socketUrl = 'http://localhost:5000';
            console.warn('[SocketContext] Environment variables point to production but running on localhost. Forcing socket to http://localhost:5000');
          } else {
            socketUrl = backendUrl || 'http://localhost:5000';
          }
        } else {
          // Other environments
          socketUrl = backendUrl || 'http://localhost:5000';
        }
      } else {
        // Server-side: use environment variable
        const backendUrl = process.env.BACKEND_IP || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        socketUrl = backendUrl;
      }

      console.log('[SocketContext] Connecting to:', socketUrl);

      const newSocket = io(socketUrl, {
        transports: ['polling', 'websocket'],
        autoConnect: true,
        withCredentials: true, // CRITICAL: Send session cookies with WebSocket connection
      });

      newSocket.on('connect', () => {
        console.log('Connected to chat server');
        setConnected(true);
        toast.success(t('toast.connectedToServer'));
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from chat server');
        setConnected(false);
        setOnlineUsers(0);
        toast.error(t('toast.disconnectedFromServer'));
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setConnected(false);
        toast.error(t('toast.failedToConnect'));
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
        toast.error(t('toast.connectionError'));
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setSocket(null);
        setConnected(false);
      };
    } else {
      // User logged out, close socket
      if (socket) {
        socket.close();
        setSocket(null);
        setConnected(false);
      }
    }
  }, [user?.id]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handlers = {
      'user_online': (data: any) => {
        console.log('User came online:', data.username);
      },

      'user_offline': (data: any) => {
        console.log('User went offline:', data.username);
      },

      'online_users_list': (data: any) => {
        setOnlineUsers(data.users.length);
      },

      'online_count_update': (data: any) => {
        console.log('Online count update:', data.count);
        setOnlineUsers(data.count);
      },

      'topic_joined': (data: any) => {
        console.log('[SocketContext] topic_joined event received:', {
          topicId: data.topic_id,
          topicTitle: data.topic_title,
          messageCount: data.messages?.length || 0,
        });
        // Add topic to current topics when join is confirmed
        if (data.topic_id) {
          currentTopics.current.add(data.topic_id);
          console.log('[SocketContext] Added topic to currentTopics:', {
            topicId: data.topic_id,
            allTopics: Array.from(currentTopics.current),
          });
        }
      },

      'topic_left': (data: any) => {
        console.log('Left topic:', data.topic_id);
        currentTopics.current.delete(data.topic_id);
      },

      'new_message': (data: any) => {
        // This will be handled by individual components
        console.log('[SocketContext] new_message event received:', {
          messageId: data.id,
          topicId: data.topic_id,
          contentLength: data.content?.length,
          displayName: data.display_name,
        });
      },

      'new_private_message': (data: any) => {
        // Log and show toast
        console.log('[SocketContext] new_private_message event received:', data);
        if (data.sender_username) {
          toast.success(t('toast.newMessageFrom', { username: data.sender_username }));
        }
        // Dispatch window event so components can receive it reliably
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('new_private_message', { detail: data }));
        }
      },

      'user_typing': (data: any) => {
        // This will be handled by individual components
        console.log('User typing:', data.display_name);
      },

      'user_stop_typing': (data: any) => {
        // This will be handled by individual components
        console.log('User stopped typing:', data.user_id);
      },

      'message_sent': (data: any) => {
        // Confirmation that message was sent
        console.log('Message sent:', data.message_id);
      },

      'private_message_sent': (data: any) => {
        // Confirmation that private message was sent
        console.log('[SocketContext] private_message_sent event received:', data);
        // Dispatch window event so components can receive it reliably
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('private_message_sent', { detail: data }));
        }
      },

      'error': (data: any) => {
        console.error('Socket error:', data.message);
        toast.error(data.message || t('errors.generic'));
      },
      'new_post': (data: any) => {
        console.log('[SocketContext] new_post event received:', data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('new_post', { detail: data }));
        }
      },
      'post_upvoted': (data: any) => {
        console.log('[SocketContext] post_upvoted event received:', data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('post_upvoted', { detail: data }));
        }
      },
      'new_comment': (data: any) => {
        console.log('[SocketContext] new_comment event received:', data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('new_comment', { detail: data }));
        }
      },
      'comment_upvoted': (data: any) => {
        console.log('[SocketContext] comment_upvoted event received:', data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('comment_upvoted', { detail: data }));
        }
      },
      'new_chat_room_message': (data: any) => {
        console.log('[SocketContext] new_chat_room_message event received:', data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('new_chat_room_message', { detail: data }));
        }
      },
      'user_mentioned': (data: any) => {
        console.log('[SocketContext] user_mentioned event received:', data);
        const contentType = data.content_type || 'message';
        // toast.success(t('mentions.mentionedYou') + ' ' + t(`mentions.in${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('user_mentioned', { detail: data }));
        }
      },
      'user_warning': (data: any) => {
        console.log('[SocketContext] user_warning event received:', data);
        // Dispatch window event to trigger user refresh and warning display
        if (typeof window !== 'undefined') {
          console.log('[SocketContext] Dispatching user_warning window event');
          window.dispatchEvent(new CustomEvent('user_warning', { detail: data }));
        } else {
          console.warn('[SocketContext] Window is not available, cannot dispatch user_warning event');
        }
      },
      'chat_room_invitation': (data: any) => {
        console.log('[SocketContext] chat_room_invitation event received:', data);
        toast.success(t('chatRoom.invitationReceived', { roomName: data.room_name || 'Chat Room' }) || `You've been invited to ${data.room_name || 'a chat room'}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chat_room_invitation', { detail: data }));
        }
        // Also trigger notification center update
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('refresh_invitations'));
        }
      },
      'chat_room_invitation_accepted': (data: any) => {
        console.log('[SocketContext] chat_room_invitation_accepted event received:', data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chat_room_invitation_accepted', { detail: data }));
        }
      },
      'topic_invitation': (data: any) => {
        console.log('[SocketContext] topic_invitation event received:', data);
        toast.success(t('notifications.invitedToTopic', { topicTitle: data.topic_title || 'a topic' }) || `You've been invited to ${data.topic_title || 'a topic'}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('topic_invitation', { detail: data }));
          // Trigger global refresh for invitations (badges, modals)
          window.dispatchEvent(new CustomEvent('refresh_invitations'));
        }
      },
    };

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup handlers
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket]);

  const joinTopic = (topicId: string, useAnonymous = false, customAnonymousName?: string) => {
    if (!socket || !connected) {
      console.warn('Cannot join topic: socket not connected', { socket: !!socket, connected });
      return;
    }

    if (!topicId) {
      console.error('joinTopic: topicId is missing');
      return;
    }

    console.log('Emitting join_topic:', {
      topic_id: String(topicId),
      use_anonymous: useAnonymous,
      custom_anonymous_name: customAnonymousName,
    });

    socket.emit('join_topic', {
      topic_id: String(topicId), // Ensure it's a string
      use_anonymous: useAnonymous,
      custom_anonymous_name: customAnonymousName,
    });
    // Don't add to currentTopics here - wait for 'topic_joined' event confirmation
  };

  const leaveTopic = (topicId: string) => {
    if (socket && connected) {
      socket.emit('leave_topic', { topic_id: topicId });
      currentTopics.current.delete(topicId);
    }
  };

  const sendMessage = (
    topicId: string,
    content: string,
    messageType = 'text',
    useAnonymous = false,
    gifUrl?: string
  ) => {
    if (!socket || !connected) {
      toast.error(t('toast.notConnected'));
      return;
    }

    const trimmedContent = content.trim();
    if (!topicId) {
      console.error('sendMessage: topicId is missing', { topicId, content: trimmedContent });
      toast.error(t('toast.topicIdRequired'));
      return;
    }

    if (!trimmedContent) {
      console.error('sendMessage: content is empty', { topicId, content });
      toast.error(t('toast.messageContentRequired'));
      return;
    }

    if (!currentTopics.current.has(topicId)) {
      console.warn('sendMessage: Topic not in currentTopics, attempting to send anyway', {
        topicId,
        currentTopics: Array.from(currentTopics.current)
      });
      // Don't block - let the server handle it
    }

    console.log('[FRONTEND] Emitting send_message:', {
      topic_id: topicId,
      content_length: trimmedContent.length,
      message_type: messageType,
      use_anonymous: useAnonymous,
      socket_connected: connected,
      socket_id: socket?.id,
      current_topics: Array.from(currentTopics.current),
    });

    try {
      socket.emit('send_message', {
        topic_id: String(topicId), // Ensure it's a string
        content: trimmedContent,
        message_type: messageType,
        use_anonymous: useAnonymous,
        gif_url: gifUrl,
      });
      console.log('[FRONTEND] send_message event emitted successfully');
    } catch (error) {
      console.error('[FRONTEND] Error emitting send_message:', error);
      toast.error(t('toast.failedToSendMessage'));
    }
  };

  const sendPrivateMessage = (
    toUserId: string,
    content: string,
    messageType = 'text',
    gifUrl?: string
  ) => {
    if (!socket || !connected) {
      toast.error(t('toast.notConnected'));
      return;
    }

    if (!toUserId || !content.trim()) {
      toast.error(t('toast.recipientAndContentRequired'));
      return;
    }

    socket.emit('send_private_message', {
      to_user_id: toUserId,
      content: content.trim(),
      message_type: messageType,
      gif_url: gifUrl,
    });
  };

  const typingStart = (topicId: string) => {
    if (socket && connected) {
      socket.emit('typing_start', { topic_id: topicId });
    }
  };

  const typingStop = (topicId: string) => {
    if (socket && connected) {
      socket.emit('typing_stop', { topic_id: topicId });
    }
  };

  const markMessagesRead = (fromUserId: string) => {
    if (socket && connected) {
      socket.emit('mark_messages_read', { from_user_id: fromUserId });
    }
  };

  const updateAnonymousName = (topicId: string, newName: string) => {
    if (socket && connected) {
      socket.emit('update_anonymous_name', {
        topic_id: topicId,
        new_name: newName.trim(),
      });
    }
  };

  const value: SocketContextType = {
    socket,
    connected,
    onlineUsers,
    joinTopic,
    leaveTopic,
    sendMessage,
    sendPrivateMessage,
    typingStart,
    typingStop,
    markMessagesRead,
    updateAnonymousName,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};