import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import GifPicker from './GifPicker';
import UserTooltip from '@/components/UI/UserTooltip';
import UserContextMenu from '@/components/UI/UserContextMenu';
import toast from 'react-hot-toast';
import { api, API_ENDPOINTS } from '@/utils/api';

interface Message {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  display_name: string;
  sender_username?: string;
  user_id?: string;
  is_anonymous: boolean;
  can_delete: boolean;
  topic_id?: string;
  gif_url?: string;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  tags: string[];
  member_count: number;
  last_activity: string;
  owner: {
    id: string;
    username: string;
  };
  user_permission_level: number;
  settings: {
    allow_anonymous: boolean;
    require_approval: boolean;
  };
}

interface ChatContainerProps {
  topic: Topic;
  messages: Message[];
  onMessageReceived: (message: Message) => void;
  onBackToTopics: () => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  topic,
  messages,
  onMessageReceived,
  onBackToTopics,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket, joinTopic, leaveTopic, sendMessage, typingStart, typingStop, connected } = useSocket();
  const [messageInput, setMessageInput] = useState('');
  const [useAnonymous, setUseAnonymous] = useState(false);
  const [anonymousName, setAnonymousName] = useState('');
  const [showAnonymousSettings, setShowAnonymousSettings] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [topicJoined, setTopicJoined] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{username: string, x: number, y: number} | null>(null);
  const [contextMenu, setContextMenu] = useState<{userId: string, username: string, x: number, y: number} | null>(null);
  const tooltipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Listen for topic_joined event (messages are now loaded via REST API when topic changes)
  useEffect(() => {
    if (!socket || !topic) return;

    const handleTopicJoined = (data: any) => {
      console.log('Topic joined, received data:', data);
      // Compare topic IDs as strings to handle ObjectId conversion
      const receivedTopicId = String(data.topic_id || '');
      const currentTopicId = String(topic.id || '');
      
      console.log('Comparing topic IDs:', { receivedTopicId, currentTopicId, match: receivedTopicId === currentTopicId });
      
      if (receivedTopicId === currentTopicId) {
        setTopicJoined(true);
        setLoading(false);
        // Messages are now loaded via REST API in the topic change effect
        // This event just confirms we joined the topic
      } else {
        console.log('Topic ID mismatch, ignoring topic_joined event');
      }
    };

    // Also listen for new messages in this topic
    const handleNewMessage = (data: any) => {
      console.log('[ChatContainer] New message received:', {
        messageId: data.id,
        topicId: data.topic_id,
        contentLength: data.content?.length,
        displayName: data.display_name,
      });
      
      const receivedTopicId = String(data.topic_id || '');
      const currentTopicId = String(topic.id || '');
      
      console.log('[ChatContainer] Comparing topic IDs:', { 
        receivedTopicId, 
        currentTopicId, 
        match: receivedTopicId === currentTopicId,
        receivedType: typeof receivedTopicId,
        currentType: typeof currentTopicId,
      });
      
      if (receivedTopicId === currentTopicId) {
        // Check if message already exists (avoid duplicates)
        const messageId = String(data.id || '');
        const message: Message = {
          id: messageId,
          content: data.content || '',
          message_type: data.message_type || 'text',
          created_at: data.created_at || new Date().toISOString(),
          display_name: data.display_name || t('userTooltip.unknown'),
          sender_username: data.sender_username,
          user_id: data.user_id,
          is_anonymous: data.is_anonymous || false,
          can_delete: data.can_delete || false,
          topic_id: receivedTopicId,
          gif_url: data.gif_url,
        };
        
        console.log('[ChatContainer] Adding message to state:', {
          messageId: message.id,
          contentPreview: message.content.substring(0, 50),
        });
        setLocalMessages(prev => {
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            return prev;
          }
          // Add new message at the end (most recent)
          return [...prev, message];
        });
        onMessageReceived(message);
      } else {
        console.log('[ChatContainer] Message not for current topic, ignoring:', {
          receivedTopicId,
          currentTopicId,
        });
      }
    };

    const handleError = (data: any) => {
      console.error('Socket error in ChatContainer:', data);
      if (data.message) {
        console.error('Error message:', data.message);
        toast.error(data.message || t('errors.generic'));
      }
      // Don't set loading to false here - let the timeout handle it
      // But log the error for debugging
    };

    // Handle message sent confirmation - replace temp message with real one
    const handleMessageSent = (data: any) => {
      console.log('[ChatContainer] Message sent confirmation:', data);
      // The new_message event should already have handled this, but this confirms it
      // We can use this to remove any temp messages that weren't replaced
    };

    socket.on('topic_joined', handleTopicJoined);
    socket.on('new_message', handleNewMessage);
    socket.on('message_sent', handleMessageSent);
    socket.on('error', handleError);

    return () => {
      socket.off('topic_joined', handleTopicJoined);
      socket.off('new_message', handleNewMessage);
      socket.off('message_sent', handleMessageSent);
      socket.off('error', handleError);
    };
  }, [socket, topic, onMessageReceived]);

  // Join topic when component mounts or topic changes
  useEffect(() => {
    if (topic && user && connected) {
      setLoading(true);
      setTopicJoined(false); // Reset joined status when topic changes
      console.log('Joining topic:', topic.id, topic.title, 'Type:', typeof topic.id);
      
      // Ensure topic.id is a string
      const topicId = String(topic.id);
      if (!topicId || topicId === 'undefined' || topicId === 'null') {
        console.error('Invalid topic ID:', topic.id);
        setLoading(false);
        return;
      }
      
      // Set a timeout to stop loading if topic_joined doesn't arrive
      const timeoutId = setTimeout(() => {
        console.warn('Topic join timeout - topic_joined event not received');
        setLoading(false);
      }, 10000); // 10 second timeout
      
      joinTopic(topicId, useAnonymous, anonymousName || undefined);
      
      // Cleanup timeout on unmount or topic change
      return () => {
        clearTimeout(timeoutId);
      };
    }

    return () => {
      if (topic) {
        console.log('Leaving topic:', topic.id);
        setTopicJoined(false);
        setLoading(false);
        leaveTopic(String(topic.id));
      }
    };
    // Only re-run when topic ID or connection status changes, not on function reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id, user?.id, connected]);

  // Get a stable topic ID for comparison
  const currentTopicId = React.useMemo(() => {
    if (!topic) return null;
    const topicIdRaw = topic?.id || (topic as any)?._id;
    return topicIdRaw ? String(topicIdRaw).trim() : null;
  }, [topic?.id, (topic as any)?._id]);

  // Load messages when topic changes
  useEffect(() => {
    console.log('[ChatContainer] Topic changed effect triggered:', {
      topic,
      currentTopicId,
      topicId: topic?.id,
      topic_id: (topic as any)?._id,
    });

    if (!topic || !currentTopicId) {
      console.log('[ChatContainer] No topic or topicId, clearing messages');
      setLocalMessages([]);
      setHasMoreMessages(true);
      setOldestMessageId(null);
      return;
    }

    // Validate topic ID format
    if (currentTopicId === 'undefined' || currentTopicId === 'null' || currentTopicId.length !== 24) {
      console.error('[ChatContainer] Invalid topic ID format:', currentTopicId);
      setLocalMessages([]);
      setHasMoreMessages(false);
      setOldestMessageId(null);
      return;
    }

    const loadMessages = async () => {
      try {
        console.log('[ChatContainer] Loading messages for topic:', currentTopicId);
        setLoading(true);
        // Clear previous messages immediately
        setLocalMessages([]);
        setHasMoreMessages(true);
        setOldestMessageId(null);

        const response = await api.get(API_ENDPOINTS.MESSAGES.TOPIC_MESSAGES(currentTopicId), {
          params: {
            limit: 50, // Load last 50 messages initially
          },
        });

        console.log('[ChatContainer] Messages API response:', {
          success: response.data.success,
          messageCount: response.data.data?.length || 0,
        });

        if (response.data.success && response.data.data) {
          const loadedMessages: Message[] = response.data.data.map((msg: any) => ({
            id: String(msg.id || msg._id),
            content: msg.content || '',
            message_type: msg.message_type || 'text',
            created_at: msg.created_at || new Date().toISOString(),
            display_name: msg.display_name || msg.sender_username || t('userTooltip.unknown'),
            sender_username: msg.sender_username,
            user_id: msg.user_id,
            is_anonymous: msg.is_anonymous || false,
            can_delete: msg.can_delete || false,
            topic_id: currentTopicId,
            gif_url: msg.gif_url,
          }));

          console.log('[ChatContainer] Loaded messages:', loadedMessages.length);
          setLocalMessages(loadedMessages);
          
          // Set oldest message ID for pagination
          if (loadedMessages.length > 0) {
            setOldestMessageId(loadedMessages[0].id);
            // If we got less than the limit, there are no more messages
            setHasMoreMessages(loadedMessages.length >= 50);
          } else {
            setHasMoreMessages(false);
          }

          // Scroll to bottom after loading
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          }, 100);
        } else {
          console.warn('[ChatContainer] Failed to load messages:', response.data);
          setLocalMessages([]);
          setHasMoreMessages(false);
        }
      } catch (error) {
        console.error('[ChatContainer] Failed to load messages:', error);
        toast.error(t('chat.failedToLoadMessages'));
        setLocalMessages([]);
        setHasMoreMessages(false);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [currentTopicId]); // Use the stable topic ID

  // Scroll to bottom when new messages arrive (but not when loading older messages)
  useEffect(() => {
    if (!loadingMore && localMessages.length > 0) {
      // Only auto-scroll if we're near the bottom
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }
      }
    }
  }, [localMessages.length, loadingMore]);

  // Load more messages when scrolling up
  const loadOlderMessages = React.useCallback(async () => {
    if (!topic || loadingMore || !hasMoreMessages || !oldestMessageId) {
      return;
    }

    try {
      setLoadingMore(true);
      const topicId = String(topic.id || (topic as any)?._id).trim();
      
      const response = await api.get(API_ENDPOINTS.MESSAGES.TOPIC_MESSAGES(topicId), {
        params: {
          limit: 50,
          before_message_id: oldestMessageId,
        },
      });

      if (response.data.success && response.data.data) {
        const olderMessages: Message[] = response.data.data.map((msg: any) => ({
          id: String(msg.id || msg._id),
          content: msg.content || '',
          message_type: msg.message_type || 'text',
          created_at: msg.created_at || new Date().toISOString(),
          display_name: msg.display_name || msg.sender_username || t('userTooltip.unknown'),
          sender_username: msg.sender_username,
          user_id: msg.user_id,
          is_anonymous: msg.is_anonymous || false,
          can_delete: msg.can_delete || false,
          topic_id: topicId,
          gif_url: msg.gif_url,
        }));

        if (olderMessages.length > 0) {
          // Prepend older messages to the beginning
          setLocalMessages(prev => [...olderMessages, ...prev]);
          setOldestMessageId(olderMessages[0].id);
          setHasMoreMessages(olderMessages.length >= 50);
          
          // Maintain scroll position
          const container = messagesContainerRef.current;
          if (container) {
            const scrollHeightBefore = container.scrollHeight;
            setTimeout(() => {
              const scrollHeightAfter = container.scrollHeight;
              container.scrollTop = scrollHeightAfter - scrollHeightBefore + container.scrollTop;
            }, 0);
          }
        } else {
          setHasMoreMessages(false);
        }
      }
    } catch (error) {
      console.error('Failed to load older messages:', error);
      toast.error(t('chat.failedToLoadOlderMessages'));
    } finally {
      setLoadingMore(false);
    }
  }, [topic, loadingMore, hasMoreMessages, oldestMessageId]);

  // Handle scroll to detect when user scrolls to top
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Load more when scrolled to top (within 100px)
      if (container.scrollTop < 100 && hasMoreMessages && !loadingMore) {
        loadOlderMessages();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, loadingMore, loadOlderMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() && !selectedGifUrl) {
      return;
    }

    // Better topic ID extraction - handle both id and _id
    const topicIdRaw = topic?.id || (topic as any)?._id;
    
    if (!topic || !topicIdRaw) {
      console.error('Cannot send message: topic or topic.id is missing', { 
        topic, 
        topicId: topicIdRaw,
        topicKeys: topic ? Object.keys(topic) : []
      });
      toast.error(t('chat.invalidTopic'));
      return;
    }

    const topicId = String(topicIdRaw).trim();
    const messageContent = messageInput.trim();
    
    // Validate topic ID format (should be 24 hex characters for MongoDB ObjectId)
    if (!topicId || topicId === 'undefined' || topicId === 'null' || topicId.length !== 24) {
      console.error('[ChatContainer] Invalid topic ID format:', {
        topicId,
        topicIdLength: topicId.length,
        topicIdType: typeof topicId,
        originalTopic: topic,
        topicIdRaw
      });
      toast.error(t('chat.invalidTopicId'));
      return;
    }
    
    console.log('[ChatContainer] handleSendMessage called:', {
      topicId,
      topicIdType: typeof topicId,
      topicIdLength: topicId.length,
      contentLength: messageContent.length,
      hasUser: !!user,
      topicTitle: topic.title,
    });

    // Determine message type and content
    // If there's both text and GIF, use 'gif' type but include the text content
    let messageType = selectedGifUrl ? 'gif' : 'text';
    let gifUrl: string | undefined = selectedGifUrl || undefined;
    
    // Clear selected GIF after using it
    if (selectedGifUrl) {
      setSelectedGifUrl(null);
    }

    // Optimistically add message to UI (will be replaced by server response)
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      message_type: messageType,
      created_at: new Date().toISOString(),
      display_name: useAnonymous && anonymousName ? anonymousName : user?.username || t('common.you'),
      is_anonymous: useAnonymous,
      can_delete: false,
      topic_id: topicId,
      gif_url: gifUrl,
    };
    onMessageReceived(tempMessage);

    // Send via REST API
    try {
      const payload: any = {
        content: messageContent,
        message_type: messageType,
        use_anonymous: useAnonymous,
      };
      
      if (gifUrl) {
        payload.gif_url = gifUrl;
      }

      console.log('[ChatContainer] Sending message via REST API:', {
        topicId,
        endpoint: API_ENDPOINTS.MESSAGES.CREATE(topicId),
        payload,
      });

      const response = await api.post(API_ENDPOINTS.MESSAGES.CREATE(topicId), payload);
      
      if (response.data.success && response.data.data) {
        const newMessage: Message = {
          id: String(response.data.data.id || response.data.data._id),
          content: response.data.data.content || messageContent,
          message_type: response.data.data.message_type || messageType,
          created_at: response.data.data.created_at || new Date().toISOString(),
          display_name: response.data.data.display_name || (useAnonymous && anonymousName ? anonymousName : user?.username || t('common.you')),
          sender_username: response.data.data.sender_username || user?.username,
          user_id: response.data.data.user_id || user?.id,
          is_anonymous: response.data.data.is_anonymous || useAnonymous,
          can_delete: response.data.data.can_delete || false,
          topic_id: topicId,
          gif_url: response.data.data.gif_url || gifUrl,
        };
        
        // Add message to local state immediately
        setLocalMessages(prev => {
          const exists = prev.some(m => m.id === newMessage.id);
          if (exists) {
            return prev;
          }
          return [...prev, newMessage];
        });
        onMessageReceived(newMessage);
        console.log('[ChatContainer] Message sent successfully via REST API:', newMessage);
        setMessageInput('');
        setIsTyping(false);
      } else {
        throw new Error(response.data.errors?.[0] || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('[ChatContainer] REST API send failed:', error);
      toast.error(error.response?.data?.errors?.[0] || error.message || t('chat.failedToSendMessage'));
      // Remove temp message on error
      // The temp message will be replaced when the real message arrives via socket
    }
  };

  const handleGifSelect = async (gifUrl: string) => {
    if (!gifUrl || !topic) {
      console.error('Cannot handle GIF: missing GIF URL or topic');
      toast.error(t('chat.invalidTopic'));
      return;
    }

    // If there's text in the message input, attach the GIF to the message instead of sending immediately
    if (messageInput.trim()) {
      console.log('[ChatContainer] Message input has text, attaching GIF to message');
      setSelectedGifUrl(gifUrl);
      setShowGifPicker(false);
      return;
    }

    // If message box is empty, send GIF immediately
    const topicIdRaw = topic?.id || (topic as any)?._id;
    if (!topicIdRaw) {
      console.error('Cannot send GIF: topic ID is missing');
      toast.error(t('chat.invalidTopic'));
      return;
    }

    const topicId = String(topicIdRaw).trim();
    
    // Validate topic ID format
    if (!topicId || topicId === 'undefined' || topicId === 'null' || topicId.length !== 24) {
      console.error('[ChatContainer] Invalid topic ID format for GIF:', topicId);
      toast.error(t('chat.invalidTopicId'));
      return;
    }

    // Optimistically add message to UI
    const tempMessage: Message = {
      id: `temp-gif-${Date.now()}`,
      content: '[GIF]',
      message_type: 'gif',
      created_at: new Date().toISOString(),
      display_name: useAnonymous && anonymousName ? anonymousName : user?.username || t('common.you'),
      sender_username: user?.username,
      user_id: user?.id,
      is_anonymous: useAnonymous,
      can_delete: false,
      topic_id: topicId,
      gif_url: gifUrl,
    };
    
    // Add temp message to local state immediately
    setLocalMessages(prev => {
      const exists = prev.some(m => m.id === tempMessage.id);
      if (exists) {
        return prev;
      }
      return [...prev, tempMessage];
    });
    onMessageReceived(tempMessage);

    // Send GIF via REST API
    try {
      const payload = {
        content: '',
        message_type: 'gif',
        use_anonymous: useAnonymous,
        gif_url: gifUrl,
      };

      console.log('[ChatContainer] Auto-sending GIF via REST API:', {
        topicId,
        endpoint: API_ENDPOINTS.MESSAGES.CREATE(topicId),
        payload,
      });

      const response = await api.post(API_ENDPOINTS.MESSAGES.CREATE(topicId), payload);
      
      if (response.data.success && response.data.data) {
        const newMessage: Message = {
          id: String(response.data.data.id || response.data.data._id),
          content: response.data.data.content || '[GIF]',
          message_type: response.data.data.message_type || 'gif',
          created_at: response.data.data.created_at || new Date().toISOString(),
          display_name: response.data.data.display_name || (useAnonymous && anonymousName ? anonymousName : user?.username || t('common.you')),
          sender_username: response.data.data.sender_username || user?.username,
          user_id: response.data.data.user_id || user?.id,
          is_anonymous: response.data.data.is_anonymous || useAnonymous,
          can_delete: response.data.data.can_delete || false,
          topic_id: topicId,
          gif_url: response.data.data.gif_url || gifUrl,
        };
        
        // Replace temp message with real one
        setLocalMessages(prev => {
          // Remove temp message
          const filtered = prev.filter(m => m.id !== tempMessage.id);
          // Check if real message already exists
          const exists = filtered.some(m => m.id === newMessage.id);
          if (exists) {
            return filtered;
          }
          return [...filtered, newMessage];
        });
        onMessageReceived(newMessage);
        console.log('[ChatContainer] GIF sent successfully via REST API:', newMessage);
        setSelectedGifUrl(null);
        setShowGifPicker(false);
      } else {
        // Remove temp message on error
        setLocalMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        throw new Error(response.data.errors?.[0] || 'Failed to send GIF');
      }
    } catch (error: any) {
      console.error('[ChatContainer] Failed to send GIF:', error);
      // Remove temp message on error
      setLocalMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      toast.error(error.response?.data?.errors?.[0] || error.message || t('chat.failedToSendGif'));
      setSelectedGifUrl(null);
    }
  };

  const handleTypingStart = () => {
    if (!isTyping) {
      setIsTyping(true);
      typingStart(String(topic.id));
    }
  };

  const handleTypingStop = () => {
    if (isTyping) {
      setIsTyping(false);
      typingStop(String(topic.id));
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);

    if (e.target.value.trim()) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-16 border-b theme-border flex items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToTopics}
            className="lg:hidden p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
          >
            <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div>
            <h2 className="text-lg font-semibold theme-text-primary">{topic.title}</h2>
            <p className="text-sm theme-text-secondary">
              {topic.member_count} {t('chat.members')} • {connected ? t('chat.connected') : t('chat.connecting')}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Anonymous toggle */}
          {topic.settings.allow_anonymous && (
            <button
              onClick={() => setShowAnonymousSettings(!showAnonymousSettings)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                useAnonymous
                  ? 'theme-blue-primary text-white'
                  : 'theme-bg-tertiary theme-text-primary hover:theme-bg-secondary'
              }`}
            >
              {useAnonymous ? t('chat.anonymous') : t('chat.realName')}
            </button>
          )}

          {/* Connection status */}
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm ${
            connected ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
          }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span>{connected ? t('chat.online') : t('chat.reconnecting')}</span>
          </div>
        </div>
      </div>

      {/* Anonymous Settings Panel */}
      {showAnonymousSettings && (
        <div className="p-4 border-b theme-border theme-bg-tertiary">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-1">
                {t('chat.anonymousName')}
              </label>
              <input
                type="text"
                value={anonymousName}
                onChange={(e) => setAnonymousName(e.target.value)}
                placeholder={t('chat.anonymousNamePlaceholder')}
                className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useAnonymous"
                checked={useAnonymous}
                onChange={(e) => setUseAnonymous(e.target.checked)}
                className="w-4 h-4 theme-blue-primary rounded"
              />
              <label htmlFor="useAnonymous" className="ml-2 text-sm theme-text-primary">
                {t('chat.sendAnonymously')}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : localMessages.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 theme-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="theme-text-secondary">{t('chat.noMessagesStart')}</p>
          </div>
        ) : (
          <>
            {/* Load more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-2">
                <LoadingSpinner size="sm" />
              </div>
            )}
            {localMessages.map((message) => {
              // Check if message is from current user - compare as strings to handle ObjectId conversion
              const currentUserId = String(user?.id || '').trim();
              const messageUserId = String(message.user_id || '').trim();
              const currentUsername = (user?.username || '').trim().toLowerCase();
              const messageUsername = (message.sender_username || '').trim().toLowerCase();
              const messageDisplayName = (message.display_name || '').trim();
              
              // Determine if message is from current user
              // Check by user_id first (most reliable), then by username
              const isFromMe = user && (
                (messageUserId && currentUserId && messageUserId === currentUserId) || 
                (messageUsername && currentUsername && messageUsername === currentUsername) ||
                (!message.is_anonymous && messageDisplayName && messageDisplayName.toLowerCase() === currentUsername)
              );

              return (
                <div 
                  key={message.id} 
                  className={`flex items-start ${isFromMe ? 'justify-end' : 'justify-start'} ${isFromMe ? 'flex-row-reverse' : ''} space-x-3`}
                >
                  {!isFromMe && (
                    <div 
                      className="w-8 h-8 rounded-full theme-bg-tertiary flex items-center justify-center flex-shrink-0 cursor-pointer"
                      onMouseEnter={(e) => {
                        // Only set tooltip if it's not already set for this username
                        if (!tooltip || tooltip.username !== messageDisplayName) {
                          // Clear any pending timeout
                          if (tooltipTimeoutRef.current) {
                            clearTimeout(tooltipTimeoutRef.current);
                            tooltipTimeoutRef.current = null;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            username: messageDisplayName,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        // Clear any existing timeout
                        if (tooltipTimeoutRef.current) {
                          clearTimeout(tooltipTimeoutRef.current);
                        }
                        // Small delay to allow moving to tooltip
                        tooltipTimeoutRef.current = setTimeout(() => {
                          setTooltip(null);
                          tooltipTimeoutRef.current = null;
                        }, 200);
                      }}
                    >
                      <span className="text-sm font-medium theme-text-primary">
                        {messageDisplayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className={`max-w-xs lg:max-w-md`}>
                    <div className={`flex items-center space-x-2 mb-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                      <span
                        className="text-sm font-medium theme-text-primary cursor-pointer hover:underline"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (message.user_id) {
                            setContextMenu({
                              userId: message.user_id,
                              username: messageDisplayName,
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }
                        }}
                      >
                        {messageDisplayName}
                      </span>
                      {message.is_anonymous && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs theme-bg-tertiary theme-text-secondary">
                          {t('chat.anonymous')}
                        </span>
                      )}
                      <span className="text-xs theme-text-muted">
                        {formatTimestamp(message.created_at)}
                      </span>
                    </div>
                    <div
                      className={`message-bubble ${isFromMe ? 'message-bubble-own' : 'message-bubble-other'}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (message.user_id) {
                          setContextMenu({
                            userId: message.user_id,
                            username: messageDisplayName,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }
                      }}
                    >
                      {message.gif_url ? (
                        <div>
                          <img
                            src={message.gif_url}
                            alt="GIF"
                            className="max-w-xs rounded-lg"
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                      {message.content && message.content !== '[GIF]' ? (
                        <div>
                          {message.content.split(/(@\w+)/g).map((part, idx) => {
                            if (part.startsWith('@')) {
                              const username = part.substring(1);
                              return (
                                <span
                                  key={idx}
                                  className="font-semibold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                  onMouseEnter={(e) => {
                                    // Only set tooltip if it's not already set for this username
                                    if (!tooltip || tooltip.username !== username) {
                                      // Clear any pending timeout
                                      if (tooltipTimeoutRef.current) {
                                        clearTimeout(tooltipTimeoutRef.current);
                                        tooltipTimeoutRef.current = null;
                                      }
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTooltip({
                                        username,
                                        x: rect.left + rect.width / 2,
                                        y: rect.top,
                                      });
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    // Clear any existing timeout
                                    if (tooltipTimeoutRef.current) {
                                      clearTimeout(tooltipTimeoutRef.current);
                                    }
                                    // Small delay to allow moving to tooltip
                                    tooltipTimeoutRef.current = setTimeout(() => {
                                      setTooltip(null);
                                      tooltipTimeoutRef.current = null;
                                    }, 200);
                                  }}
                                  onContextMenu={async (e) => {
                                    e.preventDefault();
                                    // Fetch user ID from username
                                    try {
                                      const response = await api.get(API_ENDPOINTS.USERS.GET_BY_USERNAME(username));
                                      if (response.data.success && response.data.data) {
                                        setContextMenu({
                                          userId: response.data.data.id,
                                          username,
                                          x: e.clientX,
                                          y: e.clientY,
                                        });
                                      } else {
                                        // If user not found, still show menu with empty userId
                                        setContextMenu({
                                          userId: '',
                                          username,
                                          x: e.clientX,
                                          y: e.clientY,
                                        });
                                      }
                                    } catch (error) {
                                      console.error('Failed to fetch user info:', error);
                                      setContextMenu({
                                        userId: '',
                                        username,
                                        x: e.clientX,
                                        y: e.clientY,
                                      });
                                    }
                                  }}
                                >
                                  {part}
                                </span>
                              );
                            }
                            return <span key={idx}>{part}</span>;
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {isFromMe && (
                    <div className="w-8 h-8 rounded-full theme-blue-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-semibold">
                        {currentUsername.charAt(0).toUpperCase() || 'Y'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2">
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
            <span className="text-sm theme-text-secondary">
              {typingUsers.length === 1 ? t('chat.someoneTyping') : t('chat.peopleTyping', { count: typingUsers.length })}
            </span>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t theme-border p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={messageInput}
              onChange={handleMessageInputChange}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(e)}
              placeholder={t('chat.messageAs', { name: useAnonymous && anonymousName ? anonymousName : user?.username || '' })}
              className="w-full px-4 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
            />
            {selectedGifUrl && (
              <div className="absolute top-1 right-1">
                <img src={selectedGifUrl} alt="Selected GIF" className="w-8 h-8 rounded object-cover" />
              </div>
            )}
          </div>

          {/* GIF Button */}
          <button
            type="button"
            onClick={() => setShowGifPicker(!showGifPicker)}
            className="relative p-2 theme-bg-secondary rounded-lg hover:theme-bg-tertiary transition-colors"
            title={t('privateMessages.addGif')}
          >
            <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {showGifPicker && (
              <div className="absolute bottom-full right-0 mb-2">
                <GifPicker
                  onSelectGif={handleGifSelect}
                  onClose={() => setShowGifPicker(false)}
                />
              </div>
            )}
          </button>

          <button
            type="submit"
            disabled={(!messageInput.trim() && !selectedGifUrl)}
            className="px-4 py-2 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('chat.send')}
          </button>
        </form>
      </div>

      {/* User Tooltip */}
        {tooltip && (
          <UserTooltip
            username={tooltip.username}
            x={tooltip.x}
            y={tooltip.y}
            onClose={() => {
              // Clear timeout when closing
              if (tooltipTimeoutRef.current) {
                clearTimeout(tooltipTimeoutRef.current);
                tooltipTimeoutRef.current = null;
              }
              setTooltip(null);
            }}
          />
        )}

      {/* User Context Menu */}
      {contextMenu && (
        <UserContextMenu
          userId={contextMenu.userId}
          username={contextMenu.username}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSendMessage={async (userId, username) => {
            // Navigate to private messages with this user
            console.log('Send message to:', userId, username);
            setContextMenu(null);
            // Emit custom event or use router to navigate
            window.dispatchEvent(new CustomEvent('openPrivateMessage', { detail: { userId, username } }));
          }}
          onBlockUser={async (userId, username) => {
            try {
              await api.post(API_ENDPOINTS.USERS.BLOCK_USER(userId));
              toast.success(t('chat.blockedUser', { username }));
              setContextMenu(null);
            } catch (error: any) {
              console.error('Failed to block user:', error);
              toast.error(error.response?.data?.errors?.[0] || t('privateMessages.blockUser'));
            }
          }}
        />
      )}
    </div>
  );
};

export default ChatContainer;