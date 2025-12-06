import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import GifPicker from '@/components/Chat/GifPicker';
import ContextMenu from '@/components/UI/ContextMenu';
import UserTooltip from '@/components/UI/UserTooltip';
import UserContextMenu from '@/components/UI/UserContextMenu';
import UserBanner from '@/components/UI/UserBanner';
import Avatar from '@/components/UI/Avatar';
import { useUserBanner } from '@/hooks/useUserBanner';
import { getUserProfilePicture } from '@/hooks/useUserProfile';
import FriendsDialog from '@/components/UI/FriendsDialog';
import FriendRequestsButton from '@/components/UI/FriendRequestsButton';
import ReportUserDialog from '@/components/Reports/ReportUserDialog';
import FileCard from '@/components/UI/FileCard';
import ImageViewerModal from '@/components/UI/ImageViewerModal';
import VideoPlayer from '@/components/UI/VideoPlayer';
import toast from 'react-hot-toast';

interface Conversation {
  id: string;
  user_id: string;
  username: string;
  last_message: {
    id: string;
    content: string;
    created_at: string;
    is_from_me: boolean;
  };
  unread_count: number;
}

interface Message {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  is_from_me: boolean;
  sender_username: string;
  user_id?: string;
  gif_url?: string;
  attachments?: Array<{
    type: string;
    url: string;
    filename: string;
    size?: number;
    mime_type?: string;
  }>;
}

interface PrivateMessagesSimplifiedProps {
  onExpandMessage?: (userId: string, username: string) => void;
  expandedMessage?: {userId: string, username: string} | null;
  onCloseExpanded?: () => void;
  isExpanded?: boolean;
}

const PrivateMessagesSimplified: React.FC<PrivateMessagesSimplifiedProps> = ({
  onExpandMessage,
  expandedMessage,
  onCloseExpanded,
  isExpanded = false,
}) => {
  const { t } = useLanguage();
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{id: string, username: string} | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{id: string, username: string, email: string, profile_picture?: string}>>([]);
  const [searching, setSearching] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [viewingImage, setViewingImage] = useState<{url: string, filename: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, userId: string, username: string} | null>(null);
  const [userContextMenu, setUserContextMenu] = useState<{userId: string, username: string, x: number, y: number} | null>(null);
  const [tooltip, setTooltip] = useState<{username: string, x: number, y: number} | null>(null);
  const { showBanner, bannerPos, selectedUser: bannerUser, handleMouseEnter, handleMouseLeave, handleClick, handleClose } = useUserBanner();
  const [friends, setFriends] = useState<Array<{id: string, username: string, email: string, profile_picture?: string}>>([]);
  const [showFriendsDialog, setShowFriendsDialog] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [userToReport, setUserToReport] = useState<{userId: string, username: string} | null>(null);
  const tooltipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [areFriends, setAreFriends] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [onlineUsersList, setOnlineUsersList] = useState<Set<string>>(new Set());
  const [conversationStatuses, setConversationStatuses] = useState<Map<string, {isOnline: boolean, lastLogin: string | null, areFriends: boolean}>>(new Map());
  
  // If expanded message is provided, use it
  useEffect(() => {
    if (expandedMessage) {
      setSelectedConversation(expandedMessage.userId);
      setSelectedUser({id: expandedMessage.userId, username: expandedMessage.username});
      setMessages([]);
      loadMessages(expandedMessage.userId);
    }
  }, [expandedMessage?.userId, expandedMessage?.username]);

  useEffect(() => {
    if (user) {
      // Reset loading state when user changes
      setLoading(true);
      // Load friends first, then conversations will use friends list
      loadFriends().then(() => {
        loadConversations();
      });
    }
  }, [user]);


  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
      // Check friendship from loaded friends list
      const isFriend = isUserFriend(selectedConversation);
      setAreFriends(isFriend);
      
      // Load user info and online status
      const loadUserData = async () => {
        const [userInfo, onlineUsersSet] = await Promise.all([
          loadUserInfo(selectedConversation),
          loadOnlineUsers(),
        ]);
        // Use onlineUsersSet as primary source, but also check userInfo.isOnline from backend
        const userIsOnline = onlineUsersSet.has(selectedConversation) || userInfo.isOnline;
        setIsOnline(userIsOnline);
        // Only set lastLogin if user is offline (if online, lastLogin should be null)
        setLastLogin(userIsOnline ? null : userInfo.lastLogin);
      };
      loadUserData();
    }
  }, [selectedConversation, friends]);

  // Load online users periodically and on mount
  useEffect(() => {
    if (user) {
      loadOnlineUsers();
      const interval = setInterval(() => {
        loadOnlineUsers();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for new private messages via socket
  useEffect(() => {
    if (!socket || !connected || !user) {
      console.log('[PrivateMessages] Not listening - missing socket, connection, or user');
      return;
    }

    console.log('[PrivateMessages] Setting up socket listeners');

    const handleNewPrivateMessage = (data: any) => {
      console.log('[PrivateMessages] New private message received:', {
        messageId: data.id,
        fromUserId: data.from_user_id,
        toUserId: data.to_user_id,
        currentUserId: user.id,
        selectedConversation,
      });
      
      // Check if this message is for the currently selected conversation
      // Ensure all comparisons use String() to avoid type coercion issues
      const fromUserId = String(data.from_user_id || '').trim();
      const toUserId = String(data.to_user_id || '').trim();
      const currentUserId = String(user.id || '').trim();
      const selectedUserId = String(selectedConversation || '').trim();

      // Message is for current conversation if:
      // - It's from the selected user (they sent it to me)
      // - Or it's to the selected user (I sent it to them)
      // - Or it's a self-message (from me to me)
      const isForCurrentConversation = selectedConversation && (
        (fromUserId === selectedUserId && toUserId === currentUserId) ||
        (toUserId === selectedUserId && fromUserId === currentUserId) ||
        (fromUserId === currentUserId && toUserId === currentUserId && selectedUserId === currentUserId)
      );
      
      console.log('[PrivateMessages] Message check:', {
        isForCurrentConversation,
        fromUserId,
        toUserId,
        currentUserId,
        selectedUserId,
      });
      
      if (isForCurrentConversation) {
        const newMessage: Message = {
          id: String(data.id),
          content: data.content,
          message_type: data.message_type || 'text',
          created_at: data.created_at,
          is_from_me: fromUserId === currentUserId,
          sender_username: data.sender_username || t('privateMessages.unknown'),
          gif_url: data.gif_url,
        };
        console.log('[PrivateMessages] Adding message to current conversation:', {
          messageId: newMessage.id,
          isFromMe: newMessage.is_from_me,
        });
        setMessages(prev => {
          // Check for duplicates
          const exists = prev.some(m => m.id === newMessage.id);
          if (exists) {
            console.log('[PrivateMessages] Message already exists, skipping');
            return prev;
          }
          return [...prev, newMessage];
        });
      }
      
      // Reload conversations to update unread count and sort by most recent
      loadConversations();
    };

    const handlePrivateMessageSent = (data: any) => {
      console.log('[PrivateMessages] Private message sent confirmation:', {
        messageId: data.id,
        fromUserId: data.from_user_id,
        toUserId: data.to_user_id,
        selectedConversation,
      });
      // If this is for the current conversation, add it to messages
      // Ensure all comparisons use String() and trim() to avoid type coercion issues
      const toUserId = String(data.to_user_id || '').trim();
      const fromUserId = String(data.from_user_id || '').trim();
      const currentUserId = String(user?.id || '').trim();
      const selectedUserId = String(selectedConversation || '').trim();

      // Check if message is for current conversation (including self-messages)
      const isForCurrentConversation = selectedConversation && (
        toUserId === selectedUserId ||
        fromUserId === selectedUserId ||
        (fromUserId === currentUserId && toUserId === currentUserId && selectedUserId === currentUserId)
      );
      
      if (isForCurrentConversation) {
        const newMessage: Message = {
          id: String(data.id),
          content: data.content,
          message_type: data.message_type || 'text',
          created_at: data.created_at,
          is_from_me: fromUserId === currentUserId,
          sender_username: data.sender_username || user?.username || t('common.you'),
          gif_url: data.gif_url,
        };
        console.log('[PrivateMessages] Adding sent message to current conversation');
        setMessages(prev => {
          // Check for duplicates
          const exists = prev.some(m => m.id === newMessage.id);
          if (exists) {
            console.log('[PrivateMessages] Sent message already exists, skipping');
            return prev;
          }
          return [...prev, newMessage];
        });
      }
      
      // Reload conversations to update order
      loadConversations();
    };

    socket.on('new_private_message', handleNewPrivateMessage);
    socket.on('private_message_sent', handlePrivateMessageSent);

    return () => {
      socket.off('new_private_message', handleNewPrivateMessage);
      socket.off('private_message_sent', handlePrivateMessageSent);
    };
  }, [socket, connected, user, selectedConversation]);

  const loadConversations = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.PRIVATE_CONVERSATIONS, {
        limit: 50,
      });

      if (response.data.success) {
        const conversationsData = response.data.data || [];
        console.log('[PrivateMessages] Loaded conversations:', conversationsData);
        // Backend now sorts by last_message.created_at, so no need to sort client-side
        setConversations(conversationsData);
        
        // Load status for all conversations
        const onlineUsersSet = await loadOnlineUsers();
        const statusMap = new Map<string, {isOnline: boolean, lastLogin: string | null, areFriends: boolean}>();
        
        // Create a Set of friend IDs for faster lookup - use current friends state
        const friendIdsSet = new Set(friends.map(f => String(f.id).trim()));
        
        await Promise.all(conversationsData.map(async (conv: Conversation) => {
          try {
            const userInfo = await loadUserInfo(conv.user_id);
            // Check friendship from loaded friends list instead of API call
            const convUserId = String(conv.user_id).trim();
            const areFriendsResult = friendIdsSet.has(convUserId);
            const convIsOnline = onlineUsersSet.has(conv.user_id) || userInfo.isOnline;
            statusMap.set(conv.user_id, {
              isOnline: convIsOnline,
              // Only set lastLogin if user is offline (if online, lastLogin should be null)
              lastLogin: convIsOnline ? null : userInfo.lastLogin,
              areFriends: areFriendsResult,
            });
          } catch (error) {
            console.error(`Failed to load status for user ${conv.user_id}:`, error);
          }
        }));
        
        setConversationStatuses(statusMap);
      } else {
        console.error('[PrivateMessages] Failed to load conversations:', response.data);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      setLoadingFriends(true);
      const friendsResponse = await api.get(API_ENDPOINTS.USERS.FRIENDS);

      if (friendsResponse.data.success) {
        const friendsList = friendsResponse.data.data || [];
        setFriends(friendsList);
        
        // Update areFriends for selected conversation
        if (selectedConversation) {
          const normalizedSelectedId = String(selectedConversation).trim();
          const isFriend = friendsList.some((friend: any) => String(friend.id).trim() === normalizedSelectedId);
          setAreFriends(isFriend);
        }
        
        // Update conversation statuses with friendship info
        setConversationStatuses(prev => {
          const newMap = new Map(prev);
          conversations.forEach((conv: Conversation) => {
            const normalizedConvId = String(conv.user_id).trim();
            const isFriend = friendsList.some((friend: any) => String(friend.id).trim() === normalizedConvId);
            const existingStatus = newMap.get(conv.user_id);
            if (existingStatus) {
              newMap.set(conv.user_id, { ...existingStatus, areFriends: isFriend });
            } else {
              newMap.set(conv.user_id, { isOnline: false, lastLogin: null, areFriends: isFriend });
            }
          });
          return newMap;
        });
        
        // Reload conversations to update statuses with friend info
        if (conversations.length > 0) {
          loadConversations();
        }
      }
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Helper function to check if a user is in the friends list
  const isUserFriend = (userId: string): boolean => {
    if (!userId || !friends || friends.length === 0) return false;
    const normalizedUserId = String(userId).trim();
    return friends.some(friend => String(friend.id).trim() === normalizedUserId);
  };

  const checkFriendship = async (userId: string) => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.CHECK_FRIENDSHIP(userId));
      if (response.data.success) {
        return response.data.are_friends || false;
      }
      return false;
    } catch (error) {
      console.error('Failed to check friendship:', error);
      return false;
    }
  };

  const loadOnlineUsers = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.ONLINE_USERS);
      if (response.data.success) {
        const onlineUserIds = new Set<string>((response.data.data || []).map((u: any) => String(u.id || u.user_id)));
        setOnlineUsersList(onlineUserIds);
        return onlineUserIds;
      }
      return new Set<string>();
    } catch (error) {
      console.error('Failed to load online users:', error);
      return new Set<string>();
    }
  };

  const loadUserInfo = async (userId: string) => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.GET(userId));
      if (response.data.success) {
        // Use last_seen (WebSocket disconnect time) if available, fallback to last_login
        return {
          lastLogin: response.data.data?.last_seen || response.data.data?.last_login || null,
          isOnline: response.data.data?.is_online || false,
        };
      }
      return { lastLogin: null, isOnline: false };
    } catch (error) {
      console.error('Failed to load user info:', error);
      return { lastLogin: null, isOnline: false };
    }
  };

  const formatLastSeen = (lastLogin: string | null) => {
    if (!lastLogin) return null;
    try {
      const date = new Date(lastLogin);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (seconds < 60) return t('privateMessages.justNow') || 'Just now';
      // Show minutes for anything less than 60 minutes, then switch to hours
      if (minutes < 60) return `${t('privateMessages.lastSeenAgo') || 'Last seen'} ${minutes} ${t('privateMessages.minutesAgo') || 'minutes ago'}`;
      if (hours < 24) return `${t('privateMessages.lastSeenAgo') || 'Last seen'} ${hours} ${t('privateMessages.hoursAgo') || 'hours ago'}`;
      if (days < 7) return `${t('privateMessages.lastSeenAgo') || 'Last seen'} ${days} ${t('privateMessages.daysAgo') || 'days ago'}`;
      return `${t('privateMessages.lastSeen') || 'Last seen'} ${date.toLocaleDateString()}`;
    } catch {
      return null;
    }
  };


  const loadMessages = async (userId: string) => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.PRIVATE_CONVERSATION(userId));

      if (response.data.success) {
        setMessages(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleGifSelect = (gifUrl: string) => {
    if (!selectedConversation) {
      return;
    }

    // If message input is empty, send GIF immediately
    if (!messageInput.trim()) {
      handleSendGif(gifUrl);
    } else {
      // Otherwise, attach GIF to current message
      setSelectedGifUrl(gifUrl);
    }
  };

  const handleSendGif = async (gifUrl: string) => {
    if (!selectedConversation || sendingMessage) {
      return;
    }

    setSendingMessage(true);
    setShowGifPicker(false); // Close GIF picker immediately

    try {
      const response = await api.post(API_ENDPOINTS.MESSAGES.SEND_PRIVATE, {
        to_user_id: selectedConversation,
        content: '',
        message_type: 'gif',
        gif_url: gifUrl,
      });

      if (response.data.success) {
        const newMessage: Message = {
          id: response.data.data.id,
          content: '',
          message_type: 'gif',
          created_at: response.data.data.created_at,
          is_from_me: true,
          sender_username: user?.username || 'You',
          gif_url: gifUrl,
        };
        setMessages(prev => [...prev, newMessage]);
        setSelectedGifUrl(null);
        setMessageInput(''); // Clear input
        // Refresh conversation list after a short delay to ensure backend has processed
        setTimeout(() => {
          loadConversations();
        }, 100);
      }
    } catch (error: any) {
      console.error('Failed to send GIF:', error);
      toast.error(t('toast.failedToSendMessage'));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const uploadFiles = async (files: File[]): Promise<Array<{type: string, data: string, filename: string, size: number, mime_type: string}>> => {
    const uploadPromises = files.map(async (file) => {
      // Convert file to base64 data URL for backend processing
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      return {
        type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
        data: dataUrl, // Backend expects 'data' field with base64
        filename: file.name,
        size: file.size,
        mime_type: file.type,
      };
    });

    return Promise.all(uploadPromises);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((!messageInput.trim() && !selectedGifUrl && selectedFiles.length === 0) || !selectedConversation || sendingMessage) {
      return;
    }

    try {
      setUploadingFiles(true);
      setSendingMessage(true);

      // Upload files if any
      let attachments: Array<{type: string, data: string, filename: string, size: number, mime_type: string}> = [];
      if (selectedFiles.length > 0) {
        attachments = await uploadFiles(selectedFiles);
      }

      // Determine message type
      let messageType = 'text';
      let gifUrl: string | undefined = undefined;
      let content = messageInput.trim();

      if (selectedGifUrl) {
        messageType = 'gif';
        gifUrl = selectedGifUrl;
      } else if (attachments.length > 0) {
        if (attachments.some(a => a.type === 'image')) {
          messageType = 'image';
        } else if (attachments.some(a => a.type === 'video')) {
          messageType = 'video';
        } else {
          messageType = 'file';
        }
      }

      const attachmentPlaceholder = `[${t('privateMessages.attachment')}]`;
      const response = await api.post(API_ENDPOINTS.MESSAGES.SEND_PRIVATE, {
        to_user_id: selectedConversation,
        content: content || (messageType === 'gif' ? '[GIF]' : '') || (attachments.length > 0 ? attachmentPlaceholder : ''),
        message_type: messageType,
        gif_url: gifUrl,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      if (response.data.success) {
        // Add message to local state
        const newMessage: Message = {
          id: response.data.data.id,
          content: content || (messageType === 'gif' ? '[GIF]' : '') || (attachments.length > 0 ? attachmentPlaceholder : ''),
          message_type: messageType,
          created_at: response.data.data.created_at || new Date().toISOString(),
          is_from_me: true,
          sender_username: user?.username || 'You',
          gif_url: gifUrl,
          attachments: response.data.data.attachments || attachments.map(a => ({
            type: a.type,
            url: '', // Will be populated by backend
            filename: a.filename,
            size: a.size,
            mime_type: a.mime_type,
          })),
        };

        setMessages(prev => [...prev, newMessage]);
        setMessageInput('');
        setSelectedGifUrl(null);
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Update conversation list after a short delay to ensure backend has processed
        setTimeout(() => {
          loadConversations();
        }, 100);
      } else {
        const errorMessage = response.data.errors?.[0] || t('toast.failedToSendMessage') || 'Failed to send message';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errorMessage = error.response?.data?.errors?.[0] || error.response?.data?.message || t('toast.failedToSendMessage') || 'Failed to send message';
      toast.error(errorMessage);
    } finally {
      setSendingMessage(false);
      setUploadingFiles(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
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

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60 * 1000) {
      return t('notifications.justNow') || 'Just now';
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}m ${t('posts.ago') || 'ago'}`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}h ${t('posts.ago') || 'ago'}`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatMessageContent = (content: string) => {
    if (!content) return '';
    // Translate [Attachment] to current language
    if (content === '[Attachment]') {
      return `[${t('privateMessages.attachment')}]`;
    }
    return content;
  };

  const handleSelectUser = (userId: string, username: string) => {
    setSelectedConversation(userId);
    setSelectedUser({id: userId, username});
    setShowUserSelect(false);
    setMessages([]);
    loadMessages(userId);

    // Mark as read
    api.post(API_ENDPOINTS.USERS.MARK_CONVERSATION_READ(userId)).catch(() => {});
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return;
    }

    setSearching(true);

    try {
      const response = await api.get(API_ENDPOINTS.USERS.SEARCH, {
        q: searchQuery,
        limit: 10,
      });

      if (response.data.success) {
        setSearchResults(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleStartConversation = (userId: string, username: string) => {
    setSelectedConversation(userId);
    setSelectedUser({id: userId, username});
    setShowAddFriendModal(false);
    setSearchQuery('');
    setSearchResults([]);
    setMessages([]);
    loadMessages(userId);
    loadConversations();
  };

  const handleSendFriendRequest = async (userId: string, username?: string) => {
    try {
      // Check if trying to send to yourself
      if (user && userId === user.id) {
        toast.error(t('privateMessages.cannotSendFriendRequestToYourself'));
        return;
      }

      const response = await api.post(API_ENDPOINTS.USERS.SEND_FRIEND_REQUEST, {
        to_user_id: userId,
      });
      if (response.data.success) {
        toast.success(t('privateMessages.friendRequestSent') || (username ? `Friend request sent to ${username}` : 'Friend request sent'));
        // Reload friends list to update status
        await loadFriends();
        // Refresh friendship status if we have a selected conversation (will be updated by loadFriends)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || error.response?.data?.error || '';
      // Translate common error messages
      let translatedError = errorMessage;
      if (errorMessage.includes('Cannot send friend request to yourself') || 
          errorMessage.toLowerCase().includes('yourself')) {
        translatedError = t('privateMessages.cannotSendFriendRequestToYourself');
      } else if (errorMessage.includes('Already friends') || 
                 errorMessage.toLowerCase().includes('already friends')) {
        translatedError = t('privateMessages.alreadyFriends');
      } else if (errorMessage.toLowerCase().includes('already sent') || 
                 errorMessage.toLowerCase().includes('already pending')) {
        translatedError = t('privateMessages.friendRequestAlreadyPending');
      } else if (!errorMessage) {
        translatedError = t('privateMessages.failedToSendRequest');
      }
      toast.error(translatedError);
    }
  };

  const handleRemoveFriend = async (userId: string, username?: string) => {
    try {
      const response = await api.delete(API_ENDPOINTS.USERS.REMOVE_FRIEND(userId));
      if (response.data.success) {
        toast.success(t('privateMessages.friendRemoved') || (username ? `Removed ${username} from friends` : 'Friend removed'));
        // Reload friends list to update status (will update areFriends automatically)
        await loadFriends();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || error.response?.data?.error || '';
      toast.error(errorMessage || t('privateMessages.failedToRemoveFriend') || 'Failed to remove friend');
    }
  };


  const handleMuteConversation = async (userId: string, minutes: number) => {
    try {
      const response = await api.post(API_ENDPOINTS.USERS.MUTE_CONVERSATION(userId), {
        minutes,
      });
      if (response.data.success) {
        loadConversations();
      }
    } catch (error) {
      console.error('Failed to mute conversation:', error);
    }
  };

  const handleBlockUser = async (userId: string) => {
    if (!confirm(t('privateMessages.blockUserConfirm'))) {
      return;
    }
    try {
      const response = await api.post(API_ENDPOINTS.USERS.BLOCK(userId));
      if (response.data.success) {
        // Remove from conversations
        setConversations(prev => prev.filter(c => c.user_id !== userId));
        if (selectedConversation === userId) {
          setSelectedConversation(null);
          setSelectedUser(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Failed to block user:', error);
    }
  };

  const handleDeleteConversation = async (userId: string) => {
    if (!confirm(t('privateMessages.deleteConversationConfirm'))) {
      return;
    }
    try {
      const response = await api.delete(API_ENDPOINTS.USERS.DELETE_CONVERSATION(userId));
      if (response.data.success) {
        // Remove from conversations
        setConversations(prev => prev.filter(c => c.user_id !== userId));
        if (selectedConversation === userId) {
          setSelectedConversation(null);
          setSelectedUser(null);
          setMessages([]);
        }
        loadConversations();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {selectedConversation && selectedUser ? (
        <>
          {/* Header */}
          <div className="h-16 border-b theme-border flex items-center justify-between px-6">
            <div className="flex items-center space-x-3">
              {!isExpanded && (
                <button
                  onClick={() => {
                    setSelectedConversation(null);
                    setSelectedUser(null);
                    setMessages([]);
                  }}
                  className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
                >
                  <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {isExpanded && onCloseExpanded && (
                <button
                  onClick={onCloseExpanded}
                  className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
                >
                  <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <Avatar
                userId={selectedUser.id}
                username={selectedUser.username}
                size="md"
                onClick={() => {
                  if (selectedUser.id && selectedUser.username) {
                    handleClick({ currentTarget: {} } as React.MouseEvent, selectedUser.id, selectedUser.username);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setUserContextMenu({
                    userId: selectedUser.id,
                    username: selectedUser.username,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 
                    className="font-medium theme-text-primary cursor-pointer hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClick(e, selectedUser.id, selectedUser.username);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setUserContextMenu({
                        userId: selectedUser.id,
                        username: selectedUser.username,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                  >
                    {selectedUser.username}
                  </h3>
                  {areFriends && (
                    <>
                      {isOnline ? (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          {t('privateMessages.online') || 'Online'}
                        </span>
                      ) : lastLogin && formatLastSeen(lastLogin) ? (
                        <span className="text-xs theme-text-muted">
                          {formatLastSeen(lastLogin)}
                        </span>
                      ) : null}
                    </>
                  )}
                  {!areFriends && (
                    <button
                      onClick={() => handleSendFriendRequest(selectedUser.id, selectedUser.username)}
                      className="p-1 rounded-md theme-bg-tertiary theme-text-secondary hover:theme-bg-hover transition-colors"
                      title={t('privateMessages.sendFriendRequest') || 'Send friend request'}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="text-sm theme-text-secondary">{t('privateMessages.privateConversation')}</p>
              </div>
            </div>
            {!isExpanded && onExpandMessage && (
              <button
                onClick={() => onExpandMessage(selectedUser.id, selectedUser.username)}
                className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
                title={t('privateMessages.expandToMainView')}
              >
                <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="theme-text-secondary">{t('privateMessages.noMessages')}</p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-3 ${
                      message.is_from_me ? 'justify-end' : ''
                    }`}
                  >
                    {!message.is_from_me && (
                      <Avatar
                        userId={message.user_id || selectedUser?.id}
                        username={message.sender_username}
                        profilePicture={(message.user_id || selectedUser?.id) ? getUserProfilePicture(message.user_id || selectedUser?.id || '') : undefined}
                        size="sm"
                        onClick={() => {
                          const userId = message.user_id || selectedUser?.id;
                          if (userId) {
                            handleClick({ currentTarget: {} } as React.MouseEvent, userId, message.sender_username);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          const userId = message.user_id || selectedUser?.id;
                          if (userId) {
                            setUserContextMenu({
                              userId,
                              username: message.sender_username,
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }
                        }}
                      />
                    )}
                    <div className={`max-w-xs lg:max-w-md ${
                      message.is_from_me ? 'order-first' : ''
                    }`}>
                      {!message.is_from_me && (
                        <div className="flex items-center space-x-2 mb-1">
                          <span
                            className="text-sm font-medium theme-text-primary cursor-pointer hover:underline"
                            onMouseEnter={(e) => {
                              const userId = message.user_id || selectedUser?.id;
                              if (userId) {
                                handleMouseEnter(e, userId, message.sender_username);
                              }
                            }}
                            onMouseLeave={handleMouseLeave}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const userId = message.user_id || selectedUser?.id;
                              if (userId) {
                                handleClick(e, userId, message.sender_username);
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              const userId = message.user_id || selectedUser?.id;
                              if (userId) {
                                setUserContextMenu({
                                  userId,
                                  username: message.sender_username,
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                              }
                            }}
                          >
                            {message.sender_username}
                          </span>
                          <span className="text-xs theme-text-muted">
                            {formatMessageTime(message.created_at)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`message-bubble ${
                          message.is_from_me ? 'message-bubble-own' : 'message-bubble-other'
                        }`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (!message.is_from_me) {
                            const userId = message.user_id || selectedUser?.id;
                            if (userId) {
                              setUserContextMenu({
                                userId,
                                username: message.sender_username,
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }
                          }
                        }}
                      >
                        {message.gif_url ? (
                          <div className="mb-2">
                            <img
                              src={message.gif_url}
                              alt="GIF"
                              className="max-w-xs rounded-lg"
                              loading="lazy"
                            />
                          </div>
                        ) : null}
                        {message.attachments && message.attachments.length > 0 ? (
                          <div className="space-y-2 mb-2">
                            {message.attachments.map((attachment, idx) => {
                              if (attachment.type === 'image') {
                                return (
                                  <img
                                    key={idx}
                                    src={attachment.url}
                                    alt={attachment.filename}
                                    className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setViewingImage({ url: attachment.url, filename: attachment.filename })}
                                  />
                                );
                              } else if (attachment.type === 'video') {
                                return (
                                  <VideoPlayer
                                    key={idx}
                                    src={attachment.url}
                                    filename={attachment.filename}
                                    className="max-w-xs h-48"
                                  />
                                );
                              } else {
                                return (
                                  <FileCard
                                    key={idx}
                                    attachment={attachment}
                                  />
                                );
                              }
                            })}
                          </div>
                        ) : null}
                        {message.content && !message.content.includes(`[${t('privateMessages.attachment')}]`) && message.content !== '[Attachment]' ? (
                          <div>
                            {formatMessageContent(message.content).split(/(@\w+)/g).map((part: string, idx: number) => {
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
                                          setUserContextMenu({
                                            userId: response.data.data.id,
                                            username,
                                            x: e.clientX,
                                            y: e.clientY,
                                          });
                                        } else {
                                          setUserContextMenu({
                                            userId: '',
                                            username,
                                            x: e.clientX,
                                            y: e.clientY,
                                          });
                                        }
                                      } catch (error) {
                                        console.error('Failed to fetch user info:', error);
                                        setUserContextMenu({
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
                      {message.is_from_me && (
                        <p className="text-xs theme-text-muted mt-1 px-1">
                          {formatMessageTime(message.created_at)}
                        </p>
                      )}
                    </div>
                    {message.is_from_me && (
                      <div className="w-8 h-8 rounded-full theme-blue-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-semibold">{t('common.you')}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input */}
          <div className="border-t theme-border p-4">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(e)}
                  placeholder={t('privateMessages.typeMessage')}
                  className="w-full px-4 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  disabled={sendingMessage}
                />
                {selectedGifUrl && (
                  <div className="absolute top-1 right-1">
                    <img src={selectedGifUrl} alt={t('privateMessages.selectedGif')} className="w-8 h-8 rounded object-cover" />
                  </div>
                )}
                {selectedFiles.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 p-2 theme-bg-secondary rounded-lg border theme-border max-h-32 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-xs">
                          <span className="truncate max-w-[100px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* File Upload Button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
                accept="image/*,video/*,*/*"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative p-2 theme-bg-secondary rounded-lg hover:theme-bg-tertiary transition-colors"
                title={t('common.attachFile') || 'Attach file'}
              >
                <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

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
                      position="right"
                    />
                  </div>
                )}
              </button>

              <button
                type="submit"
                disabled={(!messageInput.trim() && !selectedGifUrl && selectedFiles.length === 0) || sendingMessage || uploadingFiles}
                className="px-4 py-2 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingFiles || sendingMessage ? <LoadingSpinner size="sm" /> : t('chat.send')}
              </button>
            </form>
          </div>
        </>
      ) : (
        /* Conversations List View */
        <div className="h-full flex flex-col relative">
          {/* Header */}
          <div className="p-4 border-b theme-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold theme-text-primary">{t('home.messages')}</h2>
              <div className="flex items-center space-x-2">
                <FriendRequestsButton />
                <button
                  onClick={() => {
                    setShowFriendsDialog(true);
                    loadFriends();
                  }}
                  className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
                  title={t('privateMessages.friends')}
                >
                  <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowAddFriendModal(true)}
                  className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
                  title={t('privateMessages.startNewConversation')}
                >
                  <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="lg" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 h-full">
                <svg className="w-16 h-16 theme-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="text-lg font-medium theme-text-primary mb-2">
                  {t('privateMessages.noConversations')}
                </h3>
                <p className="theme-text-secondary text-center mb-6">
                  {t('privateMessages.startNewConversation')}
                </p>
                <button
                  onClick={() => setShowAddFriendModal(true)}
                  className="px-4 py-2 btn btn-primary"
                >
                  <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  {t('privateMessages.startNewConversation')}
                </button>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.user_id}
                    onClick={() => handleSelectUser(conversation.user_id, conversation.username)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        userId: conversation.user_id,
                        username: conversation.username,
                      });
                    }}
                    className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg hover:opacity-90 cursor-pointer transition-opacity"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <Avatar
                        userId={conversation.user_id}
                        username={conversation.username}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium theme-text-primary truncate">{conversation.username}</h4>
                          {(() => {
                            const status = conversationStatuses.get(conversation.user_id);
                            if (!status) return null;
                            const { isOnline, lastLogin, areFriends } = status;
                            if (!areFriends) return null;
                            if (isOnline) {
                              return (
                                <span className="text-xs text-green-500 flex items-center gap-1 flex-shrink-0">
                                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                  {t('privateMessages.online') || 'Online'}
                                </span>
                              );
                            }
                            if (lastLogin && formatLastSeen(lastLogin)) {
                              return (
                                <span className="text-xs theme-text-muted flex-shrink-0">
                                  {formatLastSeen(lastLogin)}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <p className="text-sm theme-text-secondary truncate flex-1 min-w-0">
                            {conversation.last_message?.is_from_me ? `${t('common.you')}: ` : ''}
                            {conversation.last_message?.content || t('privateMessages.noMessages')}
                          </p>
                          {conversation.last_message?.created_at && (
                            <span className="text-xs theme-text-muted flex-shrink-0 whitespace-nowrap">
                              {formatTimestamp(conversation.last_message.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {conversation.unread_count > 0 && (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs rounded-full">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Select Modal */}
      {showUserSelect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="theme-bg-secondary rounded-lg shadow-xl max-w-md w-full p-6 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold theme-text-primary">{t('privateMessages.yourConversations')}</h3>
              <button
                onClick={() => setShowUserSelect(false)}
                className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
              >
                <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.user_id}
                  onClick={() => handleSelectUser(conversation.user_id, conversation.username)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      userId: conversation.user_id,
                      username: conversation.username,
                    });
                  }}
                  className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg hover:opacity-90 cursor-pointer transition-opacity"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar
                      userId={conversation.user_id}
                      username={conversation.username}
                      size="md"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium theme-text-primary">{conversation.username}</h4>
                      <p className="text-sm theme-text-secondary truncate">
                        {conversation.last_message.is_from_me ? `${t('common.you')}: ` : ''}
                        {conversation.last_message.content}
                      </p>
                    </div>
                  </div>
                  {conversation.unread_count > 0 && (
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs rounded-full">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Friend Modal */}
      {showAddFriendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="theme-bg-secondary rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold theme-text-primary">{t('privateMessages.startNewConversation')}</h3>
              <button
                onClick={() => {
                  setShowAddFriendModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
              >
                <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Box */}
            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim().length >= 2) {
                    handleSearch();
                  } else {
                    setSearchResults([]);
                  }
                }}
                onKeyPress={(e) => e.key === 'Enter' && searchQuery.length >= 2 && handleSearch()}
                placeholder={t('privateMessages.searchUsers')}
                className="flex-1 px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                autoFocus
              />
            </div>

            {/* Content: Friends when search is empty, Search Results when typing */}
            <div className="max-h-96 overflow-y-auto">
              {searchQuery.trim().length === 0 ? (
                /* Show Friends when search is empty */
                friends.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium theme-text-primary mb-2">{t('privateMessages.myFriends')}</h4>
                    <div className="space-y-2">
                      {friends.map((friend) => (
                        <div
                          key={friend.id}
                          onClick={() => handleStartConversation(friend.id, friend.username)}
                          className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg hover:opacity-90 cursor-pointer transition-opacity"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full theme-blue-primary flex items-center justify-center">
                              <span className="text-white font-semibold">
                                {friend.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-medium theme-text-primary">{friend.username}</h4>
                              <p className="text-xs theme-text-secondary">{friend.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartConversation(friend.id, friend.username);
                            }}
                            className="px-3 py-1 btn btn-primary text-sm"
                          >
                            {t('privateMessages.message')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 theme-text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="theme-text-secondary text-sm">{t('privateMessages.noFriends')}</p>
                  </div>
                )
              ) : (
                /* Show Search Results when typing */
                searching ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((searchUser) => (
                      <div
                        key={searchUser.id}
                        className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg hover:opacity-90 transition-opacity"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full theme-blue-primary flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {searchUser.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-medium theme-text-primary">{searchUser.username}</h4>
                            <p className="text-xs theme-text-secondary">{searchUser.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {user && searchUser.id !== user.id && (
                            <button
                              onClick={() => handleSendFriendRequest(searchUser.id, searchUser.username)}
                              className="px-2 py-1 text-xs btn btn-secondary"
                              title={t('privateMessages.sendFriendRequest')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleStartConversation(searchUser.id, searchUser.username)}
                            className="px-3 py-1 btn btn-primary text-sm"
                          >
                            {t('privateMessages.message')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 theme-text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="theme-text-secondary">{t('privateMessages.noUsersFound')}</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Friends Dialog */}
      <FriendsDialog
        isOpen={showFriendsDialog}
        onClose={() => setShowFriendsDialog(false)}
        onSelectFriend={(friendId, username) => handleStartConversation(friendId, username)}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: t('privateMessages.muteConversation'),
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ),
              action: () => {}, // No action needed when submenu exists
              submenu: [
                {
                  label: t('privateMessages.for15Minutes'),
                  action: () => handleMuteConversation(contextMenu.userId, 15),
                },
                {
                  label: t('privateMessages.for1Hour'),
                  action: () => handleMuteConversation(contextMenu.userId, 60),
                },
                {
                  label: t('privateMessages.for8Hours'),
                  action: () => handleMuteConversation(contextMenu.userId, 480),
                },
                {
                  label: t('privateMessages.for24Hours'),
                  action: () => handleMuteConversation(contextMenu.userId, 1440),
                },
                {
                  label: t('privateMessages.forever'),
                  action: () => handleMuteConversation(contextMenu.userId, -1),
                },
              ],
            },
            {
              label: t('privateMessages.blockUser'),
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              ),
              danger: true,
              action: () => handleBlockUser(contextMenu.userId),
            },
            {
              label: t('privateMessages.deleteConversation'),
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              ),
              danger: true,
              action: () => handleDeleteConversation(contextMenu.userId),
            },
          ]}
        />
      )}

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
      {userContextMenu && (
        <UserContextMenu
          userId={userContextMenu.userId}
          username={userContextMenu.username}
          x={userContextMenu.x}
          y={userContextMenu.y}
          areFriends={areFriends}
          onClose={() => setUserContextMenu(null)}
          onSendMessage={(userId, username) => {
            window.dispatchEvent(new CustomEvent('openPrivateMessage', {
              detail: { userId, username }
            }));
            setUserContextMenu(null);
          }}
          onAddFriend={async (userId, username) => {
            try {
              const response = await api.post(API_ENDPOINTS.USERS.SEND_FRIEND_REQUEST, {
                to_user_id: userId
              });
              if (response.data.success) {
                toast.success(t('privateMessages.friendRequestSent') || `Friend request sent to ${username}`);
                // Reload friends list to update status
                await loadFriends();
              } else {
                toast.error(response.data.errors?.[0] || t('privateMessages.failedToSendFriendRequest') || 'Failed to send friend request');
              }
              setUserContextMenu(null);
            } catch (error: any) {
              console.error('Failed to send friend request:', error);
              toast.error(error.response?.data?.errors?.[0] || t('privateMessages.failedToSendFriendRequest') || 'Failed to send friend request');
            }
          }}
          onRemoveFriend={async (userId, username) => {
            await handleRemoveFriend(userId, username);
            setUserContextMenu(null);
          }}
          onReportUser={async (userId, username) => {
            setUserContextMenu(null);
            setUserToReport({ userId, username });
            setShowReportDialog(true);
          }}
          onBlockUser={async (userId, username) => {
            try {
              await api.post(API_ENDPOINTS.USERS.BLOCK(userId));
              toast.success(t('chat.blockedUser', { username }));
              setUserContextMenu(null);
            } catch (error: any) {
              toast.error(error.response?.data?.errors?.[0] || t('privateMessages.blockUser'));
            }
          }}
        />
      )}

      {/* User Banner */}
      {showBanner && bannerUser && bannerPos && (
        <UserBanner
          userId={bannerUser.userId}
          username={bannerUser.username}
          x={bannerPos.x}
          y={bannerPos.y}
          onClose={handleClose}
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
          includeMessageHistory={true}
        />
      )}

      {/* Image Viewer Modal */}
      {viewingImage && (
        <ImageViewerModal
          imageUrl={viewingImage.url}
          filename={viewingImage.filename}
          onClose={() => setViewingImage(null)}
        />
      )}
    </div>
  );
};

export default PrivateMessagesSimplified;
