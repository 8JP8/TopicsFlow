import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
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
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const currentTopics = useRef<Set<string>>(new Set());

  // Initialize socket connection
  useEffect(() => {
    if (user) {
      const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      newSocket.on('connect', () => {
        console.log('Connected to chat server');
        setConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from chat server');
        setConnected(false);
        setOnlineUsers(0);
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
        toast.error('Connection error. Please refresh the page.');
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
  }, [user]);

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

      'topic_joined': (data: any) => {
        console.log('Joined topic:', data.topic_title);
      },

      'topic_left': (data: any) => {
        console.log('Left topic:', data.topic_id);
        currentTopics.current.delete(data.topic_id);
      },

      'new_message': (data: any) => {
        // This will be handled by individual components
        console.log('New message received:', data);
      },

      'new_private_message': (data: any) => {
        // This will be handled by individual components
        console.log('New private message:', data);
        toast.success(`New message from ${data.sender_username}`);
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
        console.log('Private message sent:', data.message_id);
      },

      'error': (data: any) => {
        console.error('Socket error:', data.message);
        toast.error(data.message);
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
    if (socket && connected) {
      socket.emit('join_topic', {
        topic_id: topicId,
        use_anonymous: useAnonymous,
        custom_anonymous_name: customAnonymousName,
      });
      currentTopics.current.add(topicId);
    }
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
    if (socket && connected) {
      socket.emit('send_message', {
        topic_id: topicId,
        content: content.trim(),
        message_type: messageType,
        use_anonymous: useAnonymous,
        gif_url: gifUrl,
      });
    }
  };

  const sendPrivateMessage = (
    toUserId: string,
    content: string,
    messageType = 'text',
    gifUrl?: string
  ) => {
    if (socket && connected) {
      socket.emit('send_private_message', {
        to_user_id: toUserId,
        content: content.trim(),
        message_type: messageType,
        gif_url: gifUrl,
      });
    }
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