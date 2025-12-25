import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import GifPicker from './GifPicker';
import MentionList from '@/components/UI/MentionList';
import UserTooltip from '@/components/UI/UserTooltip';
import UserContextMenu from '@/components/UI/UserContextMenu';
import MessageContextMenu from '@/components/UI/MessageContextMenu';
import UserBanner from '@/components/UI/UserBanner';
import Avatar from '@/components/UI/Avatar';
import UserBadges from '@/components/UI/UserBadges';
import { useUserProfile, getUserProfilePicture } from '@/hooks/useUserProfile';
import ReportUserDialog from '@/components/Reports/ReportUserDialog';
import toast from 'react-hot-toast';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useRouter } from 'next/router';
import { getAnonymousModeState, saveAnonymousModeState, getLastAnonymousName, saveLastAnonymousName } from '@/utils/anonymousStorage';

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
  chat_room_id?: string;
  gif_url?: string;
  is_admin?: boolean;
  is_owner?: boolean;
  is_moderator?: boolean;
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
  anonymousIdentity?: { isAnonymous: boolean, name?: string };
  onAnonymousIdentityUpdate?: (isAnonymous: boolean, name?: string) => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  topic,
  messages,
  onMessageReceived,
  onBackToTopics,
  anonymousIdentity,
  onAnonymousIdentityUpdate,
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
  const [tooltip, setTooltip] = useState<{ username: string, x: number, y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ userId: string, username: string, x: number, y: number } | null>(null);
  const [userProfiles, setUserProfiles] = useState<Map<string, { username: string, profile_picture?: string }>>(new Map());
  const [messageContextMenu, setMessageContextMenu] = useState<{ messageId: string, userId?: string, username?: string, x: number, y: number } | null>(null);
  const [showUserBanner, setShowUserBanner] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string, username: string, isAnonymous?: boolean, x?: number, y?: number } | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [userToReport, setUserToReport] = useState<{ userId: string, username: string } | null>(null);
  const tooltipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Mention autocomplete state
  const [roomMembers, setRoomMembers] = useState<Array<{ id: string, username: string }>>([]); // Store base room members
  const [mentionUsers, setMentionUsers] = useState<Array<{ id: string, username: string }>>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0);

  // Debounced global search for mentions
  useEffect(() => {
    const searchGlobalUsers = async () => {
      if (mentionSearch.length < 2) {
        setMentionUsers(roomMembers);
        return;
      }

      try {
        const response = await api.get(API_ENDPOINTS.USERS.SEARCH, {
          params: { query: mentionSearch, limit: 5 }
        });

        if (response.data.success && response.data.data) {
          const globalUsers = response.data.data.map((u: any) => ({
            id: u.id,
            username: u.username,
            display_name: u.display_name || u.username,
            profile_picture: u.profile_picture
          }));

          // Merge room members with global results, avoiding duplicates
          const existingIds = new Set(roomMembers.map(m => m.id));
          const newUsers = globalUsers.filter((u: any) => !existingIds.has(u.id));

          setMentionUsers([...roomMembers, ...newUsers]);
        }
      } catch (error) {
        console.error('Failed to search global users:', error);
      }
    };

    const timeoutId = setTimeout(searchGlobalUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [mentionSearch, roomMembers]);

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

  // Load anonymous identity when topic changes
  useEffect(() => {
    if (!currentTopicId) return;

    const loadAnonymousIdentity = async () => {
      // First, check localStorage for saved state
      const savedState = getAnonymousModeState(currentTopicId);
      const lastName = getLastAnonymousName(currentTopicId);

      // If we have a saved state, use it immediately
      if (savedState.isAnonymous) {
        setUseAnonymous(true);
        // Use saved name or last name
        if (savedState.name) {
          setAnonymousName(savedState.name);
        } else if (lastName) {
          setAnonymousName(lastName);
        }
      }

      // Then try to load from API to get the actual identity
      try {
        const response = await api.get(API_ENDPOINTS.TOPICS.ANONYMOUS_IDENTITY(currentTopicId));
        if (response.data.success && response.data.data?.anonymous_name) {
          const apiName = response.data.data.anonymous_name;
          setAnonymousName(apiName);
          setUseAnonymous(true);
          // Save to localStorage
          saveAnonymousModeState(currentTopicId, true, apiName);
          saveLastAnonymousName(currentTopicId, apiName);
          // Notify parent if callback provided
          if (onAnonymousIdentityUpdate) {
            onAnonymousIdentityUpdate(true, apiName);
          }
        } else {
          // If API doesn't have identity but localStorage says it should be on, keep it on with saved name
          if (savedState.isAnonymous && savedState.name) {
            setUseAnonymous(true);
            setAnonymousName(savedState.name);
            if (onAnonymousIdentityUpdate) {
              onAnonymousIdentityUpdate(true, savedState.name);
            }
          } else {
            setAnonymousName(lastName || '');
            setUseAnonymous(false);
            if (onAnonymousIdentityUpdate) {
              onAnonymousIdentityUpdate(false);
            }
          }
        }
      } catch (error: any) {
        // If identity doesn't exist, that's fine
        if (error.response?.status !== 404) {
          console.error('Failed to load anonymous identity:', error);
        }
        // Use saved state if available
        if (savedState.isAnonymous && savedState.name) {
          setUseAnonymous(true);
          setAnonymousName(savedState.name);
          if (onAnonymousIdentityUpdate) {
            onAnonymousIdentityUpdate(true, savedState.name);
          }
        } else {
          setAnonymousName(lastName || '');
          setUseAnonymous(false);
          if (onAnonymousIdentityUpdate) {
            onAnonymousIdentityUpdate(false);
          }
        }
      }
    };

    loadAnonymousIdentity();
  }, [currentTopicId, onAnonymousIdentityUpdate]);

  // Update from prop if provided (e.g., from parent state)
  useEffect(() => {
    if (anonymousIdentity) {
      setUseAnonymous(anonymousIdentity.isAnonymous);
      if (anonymousIdentity.isAnonymous && anonymousIdentity.name) {
        setAnonymousName(anonymousIdentity.name);
      } else {
        setAnonymousName('');
      }
    }
  }, [anonymousIdentity]);

  // Save anonymous mode state to localStorage whenever it changes
  useEffect(() => {
    if (currentTopicId) {
      saveAnonymousModeState(currentTopicId, useAnonymous, anonymousName);
      if (anonymousName) {
        saveLastAnonymousName(currentTopicId, anonymousName);
      }
    }
  }, [currentTopicId, useAnonymous, anonymousName]);

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

  // Fetch room members for @ mentions
  const fetchRoomMembers = useCallback(async () => {
    if (!topic || !topicJoined || localMessages.length === 0) return;

    try {
      // Get the current room ID from the first message
      const currentRoomId = localMessages[0]?.chat_room_id;
      if (!currentRoomId) return;

      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_MEMBERS(currentRoomId));
      if (response.data.success) {
        let members = response.data.data || [];

        // Add @todos / @everyone if user is admin or owner
        const canMentionEveryone = user?.is_admin || (topic && ((topic as any).user_id === user?.id || (topic as any).owner_id === user?.id));

        if (canMentionEveryone) {
          members = [
            { id: 'everyone', username: 'todos', display_name: 'Everyone', role: 'system' },
            ...members
          ];
        }

        setRoomMembers(members);
        setMentionUsers(members);
      }
    } catch (error) {
      console.error('Failed to fetch room members:', error);
    }
  }, [topic, topicJoined, localMessages, user]);

  // Fetch members when room changes or messages load
  useEffect(() => {
    if (topicJoined && localMessages.length > 0) {
      fetchRoomMembers();
    }
  }, [topicJoined, localMessages.length, fetchRoomMembers]);

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
    const messageType = selectedGifUrl ? 'gif' : 'text';
    const gifUrl: string | undefined = selectedGifUrl || undefined;

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
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (seconds < 60) return t('notifications.justNow') || 'Just now';
      if (minutes < 60) return `${minutes} ${t('posts.minutes')} ${t('posts.ago')}`;
      if (hours < 24) return `${hours} ${t('posts.hours')} ${t('posts.ago')}`;
      if (days < 7) return `${days} ${t('posts.days')} ${t('posts.ago')}`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  // Fetch topic members for @ mention autocomplete (legacy - for topic-level mentions)
  const fetchTopicMembers = async () => {
    if (!topic) return;

    try {
      const topicId = String(topic.id || (topic as any)?._id);
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_MEMBERS(topicId));

      if (response.data.success && response.data.data) {
        setMentionUsers(response.data.data.map((member: any) => ({
          id: member.id,
          username: member.username
        })));
      }
    } catch (error) {
      console.error('Failed to fetch topic members:', error);
    }
  };

  // Fetch members when topic changes (legacy - only if no room members available)
  useEffect(() => {
    if (topicJoined && mentionUsers.length === 0) {
      fetchTopicMembers();
    }
  }, [topicJoined, topic?.id]);

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setMessageInput(value);

    // Check for @ mention
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && (atIndex === 0 || /\s/.test(value[atIndex - 1]))) {
      const textAfterAt = textBeforeCursor.substring(atIndex + 1);
      const hasSpaceAfter = textAfterAt.includes(' ');

      if (!hasSpaceAfter && /^\w*$/.test(textAfterAt)) {
        setMentionSearch(textAfterAt);
        setMentionCursorPosition(atIndex);
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }

    // Typing indicator
    if (value.trim()) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  const handleSelectMention = (username: string) => {
    const before = messageInput.substring(0, mentionCursorPosition);
    const after = messageInput.substring(mentionCursorPosition + mentionSearch.length + 1);
    const newValue = `${before}@${username} ${after}`;
    setMessageInput(newValue);
    setShowMentionDropdown(false);
    setMentionSearch('');

    setTimeout(() => {
      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.focus();
        const newCursorPos = before.length + username.length + 2;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleMentionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentionDropdown) return;

    const filteredUsers = mentionUsers.filter(u =>
      u.username.toLowerCase().includes(mentionSearch.toLowerCase())
    );

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex((prev) =>
        prev < filteredUsers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex((prev) => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && filteredUsers.length > 0) {
      e.preventDefault();
      handleSelectMention(filteredUsers[selectedMentionIndex].username);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowMentionDropdown(false);
    } else if (e.key === 'Tab' && filteredUsers.length > 0) {
      e.preventDefault();
      handleSelectMention(filteredUsers[selectedMentionIndex].username);
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${useAnonymous
                ? 'theme-blue-primary text-white'
                : 'theme-bg-tertiary theme-text-primary hover:theme-bg-secondary'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M14 18a2 2 0 0 0-4 0" />
                <path d="m19 11-2.11-6.657a2 2 0 0 0-2.752-1.148l-1.276.61A2 2 0 0 1 12 4H8.5a2 2 0 0 0-1.925 1.456L5 11" />
                <path d="M2 11h20" />
                <circle cx="17" cy="18" r="3" />
                <circle cx="7" cy="18" r="3" />
              </svg>
              {useAnonymous ? t('chat.anonymous') : t('chat.realName')}
            </button>
          )}

          {/* Connection status */}
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm ${connected ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8H19C20.1046 8 21 8.89543 21 10V16C21 17.1046 20.1046 18 19 18H17V22L13 18H9C8.44772 18 7.94772 17.7761 7.58579 17.4142M7.58579 17.4142L11 14H15C16.1046 14 17 13.1046 17 12V6C17 4.89543 16.1046 4 15 4H5C3.89543 4 3 4.89543 3 6V12C3 13.1046 3.89543 14 5 14H7V18L7.58579 17.4142Z" />
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
              const isFromMe = !!(user && (
                (messageUserId && currentUserId && messageUserId === currentUserId) ||
                (messageUsername && currentUsername && messageUsername === currentUsername) ||
                (!message.is_anonymous && messageDisplayName && messageDisplayName.toLowerCase() === currentUsername)
              ));

              // For anonymous messages from current user, show "Você" instead of anonymous name
              const displayNameForAnonymous = isFromMe && message.is_anonymous
                ? t('common.you') || 'Você'
                : messageDisplayName;

              return (
                <div
                  key={message.id}
                  className={`flex items-start ${isFromMe ? 'justify-end' : 'justify-start'} ${isFromMe ? 'flex-row-reverse' : ''} space-x-3`}
                >
                  {message.is_anonymous && !isFromMe ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm">
                      {messageDisplayName?.charAt(0).toUpperCase() || 'A'}
                    </div>
                  ) : !isFromMe && (
                    <Avatar
                      userId={message.user_id}
                      username={messageDisplayName}
                      profilePicture={message.user_id ? (userProfiles.get(message.user_id)?.profile_picture || getUserProfilePicture(message.user_id)) : undefined}
                      size="sm"
                      onClick={(e) => {
                        // Don't show banner for anonymous users
                        if (message.is_anonymous && !isFromMe) {
                          return;
                        }
                        if (displayNameForAnonymous) {
                          const rect = e?.currentTarget?.getBoundingClientRect();
                          setSelectedUser({
                            userId: message.is_anonymous ? '' : (message.user_id || ''),
                            username: displayNameForAnonymous,
                            isAnonymous: message.is_anonymous && !isFromMe || false,
                            x: rect ? rect.right + 10 : undefined,
                            y: rect ? rect.top : undefined
                          });
                          setShowUserBanner(true);
                        }
                      }}
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
                    />
                  )}
                  {isFromMe && !message.is_anonymous && (
                    <Avatar
                      userId={message.user_id}
                      username={messageDisplayName}
                      profilePicture={message.user_id ? (userProfiles.get(message.user_id)?.profile_picture || getUserProfilePicture(message.user_id)) : undefined}
                      size="sm"
                    />
                  )}
                  <div className={`max-w-xs lg:max-w-md`}>
                    <div className={`flex items-center space-x-2 mb-1 ${isFromMe ? 'justify-end' : 'justify-start'} flex-wrap`}>
                      <span
                        className={`text-sm font-medium theme-text-primary ${message.is_anonymous && !isFromMe ? 'cursor-default' : 'cursor-pointer hover:underline'
                          }`}
                        onClick={(e) => {
                          // Don't show banner for anonymous users
                          if (message.is_anonymous && !isFromMe) {
                            return;
                          }
                          if (displayNameForAnonymous) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setSelectedUser({
                              userId: message.is_anonymous ? '' : (message.user_id || ''),
                              username: displayNameForAnonymous,
                              isAnonymous: message.is_anonymous && !isFromMe || false,
                              x: rect.right + 10,
                              y: rect.top
                            });
                            setShowUserBanner(true);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          // Don't show context menu for anonymous users
                          if (message.is_anonymous && !isFromMe) {
                            return;
                          }
                          if (message.user_id) {
                            setContextMenu({
                              userId: message.user_id,
                              username: displayNameForAnonymous,
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }
                        }}
                      >
                        {displayNameForAnonymous}
                      </span>
                      <UserBadges
                        isFromMe={isFromMe}
                        isAdmin={message.is_admin}
                        isOwner={message.is_owner}
                        isModerator={message.is_moderator}
                        isAnonymous={!!message.is_anonymous}
                      />
                      <span className="text-xs theme-text-muted">
                        {formatTimestamp(message.created_at)}
                      </span>
                    </div>
                    <div
                      className={`message-bubble ${isFromMe ? 'message-bubble-own' : 'message-bubble-other'}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Show message context menu (for reporting message)
                        setMessageContextMenu({
                          messageId: message.id,
                          userId: message.user_id,
                          username: messageDisplayName,
                          x: e.clientX,
                          y: e.clientY,
                        });
                        // Also show user context menu if clicking on username
                        if (message.user_id && !message.is_anonymous) {
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
                                  className="font-semibold text-white cursor-pointer hover:underline !bg-transparent"
                                  style={{ backgroundColor: 'transparent' }}
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Fetch user ID and show banner
                                    try {
                                      const response = await api.get(API_ENDPOINTS.USERS.GET_BY_USERNAME(username));
                                      if (response.data.success && response.data.data) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setSelectedUser({
                                          userId: response.data.data.id,
                                          username: response.data.data.username,
                                          x: rect.left,
                                          y: rect.top + 20, // Offset slightly
                                          isAnonymous: false
                                        });
                                        setShowUserBanner(true);
                                      }
                                    } catch (error) {
                                      console.error('Failed to fetch user:', error);
                                    }
                                  }}
                                  onMouseEnter={async (e) => {
                                    // Trigger UserBanner on hover with delay
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    // Use a ref to store the timeout so we can cancel it
                                    // Reuse existing tooltipTimeoutRef if available, or just set directly
                                    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);

                                    tooltipTimeoutRef.current = setTimeout(async () => {
                                      try {
                                        const response = await api.get(API_ENDPOINTS.USERS.GET_BY_USERNAME(username));
                                        if (response.data.success && response.data.data) {
                                          setSelectedUser({
                                            userId: response.data.data.id,
                                            username: response.data.data.username,
                                            x: rect.left,
                                            y: rect.top + 20,
                                            isAnonymous: false
                                          });
                                          setShowUserBanner(true);
                                        }
                                      } catch (error) {
                                        console.error('Fetch user failed:', error);
                                      }
                                    }, 500); // 500ms delay for hover
                                  }}
                                  onMouseLeave={() => {
                                    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
                                    // Don't immediately hide UserBanner to allow interaction? 
                                    // User said "open the userbanner card on hovering... for the same period".
                                    // Usually this means it auto-closes.
                                    // Let's add a close timeout.
                                    tooltipTimeoutRef.current = setTimeout(() => {
                                      // Only close if we are not hovering the banner itself (handled by banner logic usually)
                                      // But for now, simple behavior:
                                      setShowUserBanner(false);
                                    }, 300);
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
        <form 
          onSubmit={handleSendMessage} 
          className="flex items-center space-x-3"
          onKeyDown={(e) => {
            // Handle Enter key even when buttons are focused
            if (e.key === 'Enter' && !e.shiftKey && !showMentionDropdown) {
              const target = e.target as HTMLElement;
              // Only prevent default if not in a button (buttons should handle their own clicks)
              if (target.tagName !== 'BUTTON' && (messageInput.trim() || selectedGifUrl)) {
                e.preventDefault();
                handleSendMessage(e as any);
              }
            }
          }}
        >
          <div className="flex-1 relative">
            <input
              type="text"
              value={messageInput}
              onChange={handleMessageInputChange}
              onKeyDown={handleMentionKeyDown}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !showMentionDropdown) {
                  handleSendMessage(e);
                }
              }}
              placeholder={t('chat.messageAs', { name: useAnonymous && anonymousName ? anonymousName : user?.username || '' })}
              className="w-full px-4 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
              autoComplete="off"
            />

            {/* Mention Autocomplete Dropdown */}
            {showMentionDropdown && mentionUsers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 z-50">
                <MentionList
                  users={mentionUsers.filter(u => u.username.toLowerCase().includes(mentionSearch.toLowerCase()))}
                  selectedIndex={selectedMentionIndex}
                  onSelect={handleSelectMention}
                />
              </div>
            )}

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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (messageInput.trim() || selectedGifUrl) {
                  handleSendMessage(e as any);
                }
              }
            }}
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
            // Navigate to private messages with this user (works for self too)
            console.log('Send message to:', userId, username);
            setContextMenu(null);
            // Emit custom event or use router to navigate
            window.dispatchEvent(new CustomEvent('openPrivateMessage', { detail: { userId, username } }));
          }}
          onAddFriend={async (userId, username) => {
            try {
              const response = await api.post(API_ENDPOINTS.USERS.SEND_FRIEND_REQUEST, {
                to_user_id: userId
              });
              if (response.data.success) {
                toast.success(t('privateMessages.friendRequestSent') || `Friend request sent to ${username}`);
              } else {
                toast.error(response.data.errors?.[0] || t('privateMessages.failedToSendFriendRequest') || 'Failed to send friend request');
              }
              setContextMenu(null);
            } catch (error: any) {
              console.error('Failed to send friend request:', error);
              toast.error(error.response?.data?.errors?.[0] || t('privateMessages.failedToSendFriendRequest') || 'Failed to send friend request');
            }
          }}
          onReportUser={async (userId, username) => {
            setContextMenu(null);
            setUserToReport({ userId, username });
            setShowReportDialog(true);
          }}
          onBlockUser={async (userId, username) => {
            try {
              await api.post(API_ENDPOINTS.USERS.BLOCK(userId));
              toast.success(t('chat.blockedUser', { username }));
              setContextMenu(null);
            } catch (error: any) {
              console.error('Failed to block user:', error);
              toast.error(error.response?.data?.errors?.[0] || t('privateMessages.blockUser'));
            }
          }}
        />
      )}

      {/* Message Context Menu */}
      {messageContextMenu && (
        <MessageContextMenu
          messageId={messageContextMenu.messageId}
          userId={messageContextMenu.userId}
          username={messageContextMenu.username}
          x={messageContextMenu.x}
          y={messageContextMenu.y}
          onClose={() => setMessageContextMenu(null)}
          onReportMessage={async (messageId, userId, username) => {
            try {
              await api.post(API_ENDPOINTS.MESSAGES.REPORT(messageId), {
                reason: 'Inappropriate content',
                content_type: 'message'
              });
              toast.success(t('chat.messageReported') || 'Message reported successfully');
              setMessageContextMenu(null);
            } catch (error: any) {
              console.error('Failed to report message:', error);
              toast.error(error.response?.data?.errors?.[0] || t('chat.failedToReportMessage') || 'Failed to report message');
            }
          }}
          onHide={async (messageId) => {
            try {
              await api.post(`/api/content-settings/chat-messages/${messageId}/hide`);
              setLocalMessages(prev => prev.filter(m => m.id !== messageId));
              toast.success(t('settings.itemHidden') || 'Message hidden');
              setMessageContextMenu(null);
            } catch (error: any) {
              console.error('Failed to hide message:', error);
              toast.error(error.response?.data?.errors?.[0] || 'Failed to hide message');
            }
          }}
          onDeleteMessage={async (messageId) => {
            if (window.confirm(t('chat.confirmDeleteMessage') || 'Are you sure you want to delete this message?')) {
              try {
                await api.delete(API_ENDPOINTS.MESSAGES.DELETE(messageId));
                setLocalMessages(prev => prev.filter(m => m.id !== messageId));
                toast.success(t('chat.messageDeleted') || 'Message deleted');
                setMessageContextMenu(null);
              } catch (error: any) {
                console.error('Failed to delete message:', error);
                toast.error(error.response?.data?.errors?.[0] || 'Failed to delete message');
              }
            }
          }}
          canDelete={localMessages.find(m => m.id === messageContextMenu.messageId)?.user_id === user?.id || user?.is_admin}
        />
      )}

      {/* User Banner */}
      {showUserBanner && selectedUser && (
        <UserBanner
          userId={selectedUser.userId}
          username={selectedUser.username}
          isAnonymous={selectedUser.isAnonymous}
          x={selectedUser.x}
          y={selectedUser.y}
          onClose={() => {
            setShowUserBanner(false);
            setSelectedUser(null);
          }}
          onSendMessage={(userId, username) => {
            setShowUserBanner(false);
            setSelectedUser(null);
            window.dispatchEvent(new CustomEvent('openPrivateMessage', { detail: { userId, username } }));
          }}
          onReport={(userId, username) => {
            setShowUserBanner(false);
            setSelectedUser(null);
            setUserToReport({ userId, username });
            setShowReportDialog(true);
          }}
          onBlock={async (userId, username) => {
            try {
              await api.post(API_ENDPOINTS.USERS.BLOCK(userId));
              toast.success(t('chat.blockedUser', { username }) || `Blocked ${username}`);
              setShowUserBanner(false);
              setSelectedUser(null);
            } catch (error: any) {
              console.error('Failed to block user:', error);
              toast.error(error.response?.data?.errors?.[0] || t('chat.failedToBlockUser') || 'Failed to block user');
            }
          }}
        />
      )}

      {/* Report User Dialog */}
      {showReportDialog && userToReport && (
        <ReportUserDialog
          userId={userToReport.userId}
          username={userToReport.username}
          onClose={() => {
            setShowReportDialog(false);
            setUserToReport(null);
          }}
        />
      )}
    </div>
  );
};

export default ChatContainer;