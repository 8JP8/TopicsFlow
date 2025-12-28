import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Avatar from '@/components/UI/Avatar';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import UserContextMenu from '@/components/UI/UserContextMenu';
import FriendsDialog from '@/components/UI/FriendsDialog';
import ChatRoomContextMenu from '@/components/UI/ChatRoomContextMenu';
import ContextMenu from '@/components/UI/ContextMenu';
import UserTooltip from '@/components/UI/UserTooltip';
import UserBanner from '@/components/UI/UserBanner';

import MessageInput from '@/components/UI/MessageInput';
import GifPicker from '@/components/Chat/GifPicker';
import FriendRequestsButton from '@/components/UI/FriendRequestsButton';
import { getUserProfilePicture } from '@/hooks/useUserProfile';
import ReportUserDialog from '@/components/Reports/ReportUserDialog';
import FileCard from '@/components/UI/FileCard';
import ImageViewerModal from '@/components/UI/ImageViewerModal';
import VideoPlayer from '@/components/UI/VideoPlayer';
import toast from 'react-hot-toast';
import GroupChatCreateModal from '@/components/Chat/GroupChatCreateModal';
import { VoipButton } from '@/components/Voip';
import { Mic, Square, Trash2, Send, Image, Paperclip, Users, Plus, Volume2, VolumeX } from 'lucide-react';
import AudioPlayer from '@/components/UI/AudioPlayer';

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
  is_muted?: boolean;
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
  expandedMessage?: { userId: string, username: string } | null;
  onCloseExpanded?: () => void;
  isExpanded?: boolean;
  onGroupSelect?: (group: any) => void;
  unreadGroupCounts?: { [chatId: string]: number };
}

interface GroupChat {
  id: string;
  name: string;
  description: string;
  picture?: string;
  member_count: number;
  last_activity?: string;
  unread_count?: number;
  owner_id?: string; // Owner of the group chat
  is_muted?: boolean;
}

const PrivateMessagesSimplified: React.FC<PrivateMessagesSimplifiedProps> = ({
  onExpandMessage,
  expandedMessage,
  onCloseExpanded,
  isExpanded = false,
  onGroupSelect,
  unreadGroupCounts = {},
}) => {
  const { t } = useLanguage();
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{ id: string, username: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string, username: string, email: string, profile_picture?: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [viewingImage, setViewingImage] = useState<{ url: string, filename: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, userId: string, username: string, isMuted: boolean } | null>(null);
  const [userContextMenu, setUserContextMenu] = useState<{ userId: string, username: string, x: number, y: number } | null>(null);
  const [messageContextMenu, setMessageContextMenu] = useState<{ x: number, y: number, messageId: string, content: string, userId: string, username: string, isFromMe: boolean, isMuted?: boolean } | null>(null);
  const [groupChatContextMenu, setGroupChatContextMenu] = useState<{ x: number, y: number, groupId: string, groupName: string, isMuted: boolean } | null>(null);

  const [friends, setFriends] = useState<Array<{ id: string, username: string, email: string, profile_picture?: string }>>([]);
  const [showFriendsDialog, setShowFriendsDialog] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showGroupChatCreate, setShowGroupChatCreate] = useState(false);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [hiddenChats, setHiddenChats] = useState<Set<string>>(new Set());

  const [userToReport, setUserToReport] = useState<{ userId: string, username: string } | null>(null);

  // Resizable Divider State
  const [dividerPosition, setDividerPosition] = useState<number>(() => {
    const saved = localStorage.getItem('messagesDividerPosition');
    return saved ? parseFloat(saved) : 50; // Default to 50% split
  });
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  // Interaction State
  const [bannerState, setBannerState] = useState<{ userId?: string, username: string, x: number, y: number } | null>(null);
  const [tooltipState, setTooltipState] = useState<{ username: string, x: number, y: number } | null>(null);

  // Refs for timers
  const hoverOpenTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Safe Socket State Ref for Stable Listeners
  const selectedConversationRef = useRef<string | null>(null);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation || null;
  }, [selectedConversation]);
  const hoverCloseTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (e: React.MouseEvent, userId: string, username: string) => {
    // If banner is already open, don't show tooltip
    if (bannerState) return;

    // Clear any pending close timer (in case moving between mentions)
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }

    // Set timer to open tooltip after 2 seconds
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);

    // Calculate position immediately or in timeout? 
    // In timeout is safer for fresh position, but event is gone. Use rect now.
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    hoverOpenTimerRef.current = setTimeout(() => {
      setTooltipState({ username, x, y });
    }, 500); // 0.5 second delay
  };

  const handleMouseLeave = () => {
    // Cancel open timer if we leave before 2s
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }

    // Delay closing tooltip to allow moving mouse into it
    if (tooltipState) {
      if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = setTimeout(() => {
        setTooltipState(null);
      }, 300);
    }
  };

  const handleClick = (e: React.MouseEvent, userId: string, username: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear all hover timers and states
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
    if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    setTooltipState(null);

    const rect = e.currentTarget.getBoundingClientRect();
    setBannerState({ userId, username, x: rect.left + rect.width / 2, y: rect.top });
  };

  const handleBannerClose = () => {
    setBannerState(null);
  };

  const handleTooltipClose = () => {
    setTooltipState(null);
  };
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [areFriends, setAreFriends] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [onlineUsersList, setOnlineUsersList] = useState<Set<string>>(new Set());
  const [conversationStatuses, setConversationStatuses] = useState<Map<string, { isOnline: boolean, lastLogin: string | null, areFriends: boolean }>>(new Map());

  // Divider drag handlers - Optimized for smoothness
  const requestRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handleDividerTouchStart = (e: React.TouchEvent) => {
    // Prevent default to avoid scrolling/other actions when starting drag
    setIsDraggingDivider(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const updatePosition = (clientY: number) => {
    const container = document.getElementById('messages-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const y = clientY - rect.top;
    const percentage = (y / rect.height) * 100;

    // Constrain between 20% and 80%
    const newPosition = Math.max(20, Math.min(80, percentage));
    setDividerPosition(newPosition);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDivider) return;

      if (requestRef.current) return; // Skip if a frame is already pending

      requestRef.current = requestAnimationFrame(() => {
        updatePosition(e.clientY);
        requestRef.current = undefined;
      });
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
      localStorage.setItem('messagesDividerPosition', String(dividerPosition));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingDivider) return;
      if (e.cancelable) e.preventDefault();

      if (requestRef.current) return;

      const touch = e.touches[0];
      requestRef.current = requestAnimationFrame(() => {
        updatePosition(touch.clientY);
        requestRef.current = undefined;
      });
    };

    const handleTouchEnd = () => {
      setIsDraggingDivider(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
      localStorage.setItem('messagesDividerPosition', String(dividerPosition));
    };

    if (isDraggingDivider) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
      };
    }
  }, [isDraggingDivider, dividerPosition]);

  // Close context menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setGroupChatContextMenu(null);
    };
    if (contextMenu || groupChatContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu, groupChatContextMenu]);

  // If expanded message is provided, use it
  useEffect(() => {
    if (expandedMessage) {
      setSelectedConversation(expandedMessage.userId);
      setSelectedUser({ id: expandedMessage.userId, username: expandedMessage.username });
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
        loadGroupChats();
      });
      loadHiddenItems();
    }
  }, [user]);

  const loadHiddenItems = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.CONTENT_SETTINGS.HIDDEN_ITEMS);
      if (response.data.success) {
        const hidden = new Set<string>();
        const data = response.data.data;
        // Store chat IDs
        if (data.chats && Array.isArray(data.chats)) {
          data.chats.forEach((c: any) => hidden.add(c.id));
        }
        setHiddenChats(hidden);
      }
    } catch (error) {
      console.error('Failed to load hidden items:', error);
    }
  };


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

  // Real-time updates via socket.io (primary)
  // Fallback polling every 1 minute as safety net
  useEffect(() => {
    if (!user) return;

    const pollInterval = setInterval(() => {
      loadConversations();
    }, 60000); // 1 minute fallback

    return () => clearInterval(pollInterval);
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
        currentSelection: selectedConversationRef.current
      });

      const fromUserId = String(data.from_user_id || '').trim();
      const currentUserId = String(user?.id || '').trim();

      // Use REF for current selection to avoid stale closures
      const activeConversationId = String(selectedConversationRef.current || '').trim();

      // Check if message is for current conversation
      const isForCurrentConversation = activeConversationId && (
        fromUserId === activeConversationId ||
        (String(data.to_user_id).trim() === activeConversationId && fromUserId === currentUserId)
      );

      if (isForCurrentConversation) {
        const newMessage: Message = {
          id: String(data.id || data._id),
          content: data.content,
          message_type: data.message_type || 'text',
          created_at: data.created_at,
          is_from_me: fromUserId === currentUserId,
          sender_username: data.sender_username || t('privateMessages.unknown'),
          gif_url: data.gif_url,
        };

        setMessages(prev => {
          const exists = prev.some(m => m.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });

        if (socket && connected) {
          socket.emit('mark_messages_read', { from_user_id: fromUserId });
        }
      }

      // Optimistic update for conversation list
      setConversations(prev => {
        const fromId = String(data.from_user_id || '').trim();
        const existingConvIndex = prev.findIndex(c => String(c.user_id).trim() === fromId);

        console.log('[PrivateMessages] Updating conversations list:', {
          activeConversationId,
          fromId,
          match: activeConversationId === fromId,
          existingIndex: existingConvIndex
        });

        const newConvList = [...prev];
        if (existingConvIndex >= 0) {
          const conv = newConvList[existingConvIndex];
          const currentUnread = Number(conv.unread_count || 0);
          const newUnread = activeConversationId === fromId ? 0 : currentUnread + 1;

          console.log('[PrivateMessages] Incrementing unread:', {
            prev: currentUnread,
            new: newUnread
          });

          newConvList.splice(existingConvIndex, 1);
          newConvList.unshift({
            ...conv,
            last_message: {
              id: String(data.id || data._id),
              content: data.content,
              created_at: data.created_at,
              is_from_me: false
            },
            unread_count: newUnread
          });
        } else {
          console.log('[PrivateMessages] New conversation detected, reloading...');
          loadConversations();
          return newConvList;
        }
        return newConvList;
      });
    };

    const handlePrivateMessageSent = (data: any) => {
      // Use REF for current selection
      const activeConversationId = String(selectedConversationRef.current || '').trim();
      const toUserId = String(data.to_user_id || '').trim();
      const fromUserId = String(data.from_user_id || '').trim();
      const currentUserId = String(user?.id || '').trim();

      const isForCurrentConversation = activeConversationId && (
        toUserId === activeConversationId ||
        fromUserId === activeConversationId ||
        (fromUserId === currentUserId && toUserId === currentUserId && activeConversationId === currentUserId)
      );

      if (isForCurrentConversation) {
        const newMessage: Message = {
          id: String(data.id || data._id),
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

      // Optimistic update for conversation list (Outgoing)
      setConversations(prev => {
        const toId = String(data.to_user_id || '').trim();
        const existingConvIndex = prev.findIndex(c => String(c.user_id).trim() === toId);

        const newConvList = [...prev];
        if (existingConvIndex >= 0) {
          const conv = newConvList[existingConvIndex];
          // Update existing conversation
          newConvList.splice(existingConvIndex, 1);
          newConvList.unshift({
            ...conv,
            last_message: {
              id: String(data.id),
              content: data.content,
              created_at: data.created_at,
              is_from_me: true
            },
            // Do not change unread count for outgoing messages
          });
        }
        return newConvList;
      });

      // REMOVED: loadConversations() to prevent UI jitter/stale data
    };

    socket.on('new_private_message', handleNewPrivateMessage);
    socket.on('private_message_sent', handlePrivateMessageSent);

    // Listen for new group chat messages via Notifications (Global Check)
    const handleNewNotification = (notification: any) => {
      console.log('[PrivateMessages] Notification received:', notification.type);

      // Handle private message notifications
      if (notification.type === 'message' && notification.data?.from_user_id) {
        console.log('[PrivateMessages] Private message notification - refreshing DM list');
        const fromUserId = String(notification.data.from_user_id);
        const activeConversationId = String(selectedConversationRef.current || '').trim();

        // Reload the conversation list to get updated last_message and unread counts
        loadConversations();

        // If viewing this conversation, also reload messages
        if (activeConversationId === fromUserId) {
          loadMessages(fromUserId);
        }
      }

      // Handle chatroom message notifications
      if (notification.type === 'chatroom_message' && notification.data?.chat_room_id) {
        const chatRoomId = String(notification.data.chat_room_id);
        setGroupChats(prev => prev.map(group => {
          if (group.id === chatRoomId) {
            return {
              ...group,
              unread_count: (group.unread_count || 0) + 1
            };
          }
          return group;
        }));
      }
    };



    // Requested: Sync on connect
    const handleConnect = () => {
      console.log('[PrivateMessages] Reconnected - syncing messages...');
      loadConversations();
      loadGroupChats();
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('connect', handleConnect);

    // Debug: Check who I am according to server
    socket.emit('debug_whoami');
    socket.on('debug_whoami_response', (data: any) => {
      console.log('[PrivateMessages] DEBUG WHOAMI:', data);
    });

    // === WINDOW EVENT LISTENERS (Reliable fallback) ===
    // SocketContext dispatches window events which are more reliable than socket.on
    const handleWindowPrivateMessage = (event: CustomEvent) => {
      console.log('[PrivateMessages] Window event new_private_message received');
      handleNewPrivateMessage(event.detail);
    };

    window.addEventListener('new_private_message', handleWindowPrivateMessage as EventListener);

    return () => {
      socket.off('new_private_message', handleNewPrivateMessage);
      socket.off('private_message_sent', handlePrivateMessageSent);
      socket.off('new_notification', handleNewNotification);
      socket.off('connect', handleConnect);
      socket.off('debug_whoami_response');
      window.removeEventListener('new_private_message', handleWindowPrivateMessage as EventListener);
    };
  }, [socket, connected, user]);

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
        const statusMap = new Map<string, { isOnline: boolean, lastLogin: string | null, areFriends: boolean }>();

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

  const loadGroupChats = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.LIST_GROUP);
      if (response.data.success) {
        let loadedGroups: GroupChat[] = response.data.data || [];

        // Merge with initial unread counts if available
        if (unreadGroupCounts && Object.keys(unreadGroupCounts).length > 0) {
          loadedGroups = loadedGroups.map(group => ({
            ...group,
            unread_count: unreadGroupCounts[group.id] || group.unread_count || 0
          }));
        }

        setGroupChats(loadedGroups);
      }
    } catch (error) {
      console.error('Failed to load group chats:', error);
    }
  };

  // Sync with unreadGroupCounts prop changes
  useEffect(() => {
    if (Object.keys(unreadGroupCounts || {}).length > 0 && groupChats.length > 0) {
      setGroupChats(prev => prev.map(group => {
        const propCount = unreadGroupCounts?.[group.id];
        // Only update if prop has a value and it's different/greater
        if (propCount !== undefined && propCount !== group.unread_count) {
          return { ...group, unread_count: propCount };
        }
        return group;
      }));
    }
  }, [unreadGroupCounts]);

  const handleGroupCreated = (newGroup: any) => {
    setGroupChats(prev => [newGroup, ...prev]);
    // Notify parent to open the new group chat
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openChatRoom', { detail: { chatRoomId: newGroup.id } }));
    }
  };

  const handleDeleteMessage = async (messageId: string, mode: 'soft' | 'hard' = 'soft') => {
    const confirmMessage = mode === 'hard'
      ? (t('privateMessages.unsendMessageConfirm') || 'Are you sure you want to unsend this message? It will be removed for everyone.')
      : (t('privateMessages.deleteMessageConfirm') || 'Are you sure you want to delete this message? It will be removed for you.');

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await api.delete(`${API_ENDPOINTS.MESSAGES.DELETE_PRIVATE(messageId)}?mode=${mode}`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success(mode === 'hard' ? (t('privateMessages.messageUnsent') || 'Message unsent') : (t('settings.itemHidden') || 'Message hidden'));
    } catch (error: any) {
      console.error('Failed to delete message:', error);
      toast.error(error.response?.data?.errors?.[0] || t('privateMessages.failedToDeleteMessage') || 'Failed to delete message');
    }
    setMessageContextMenu(null);
  };

  const handleHideGroupChat = async (groupId: string) => {
    try {
      await api.post(API_ENDPOINTS.CONTENT_SETTINGS.HIDE_CHAT(groupId));
      setGroupChats(prev => prev.filter(g => g.id !== groupId));
      toast.success(t('settings.itemHidden') || 'Chat hidden');
    } catch (error: any) {
      console.error('Failed to hide group chat:', error);
      toast.error(error.response?.data?.errors?.[0] || 'Failed to hide chat');
    }
    setGroupChatContextMenu(null);
  };

  const handleLeaveChat = async (groupId: string, groupName: string) => {
    if (window.confirm(t('chat.confirmLeave', { name: groupName }) || `Are you sure you want to leave "${groupName}"?`)) {
      try {
        await api.post(API_ENDPOINTS.CHAT_ROOMS.LEAVE(groupId));
        toast.success(t('chat.leftChatroom') || 'Left chat room');
        setGroupChats(prev => prev.filter(g => g.id !== groupId));
      } catch (error: any) {
        toast.error(t('chat.failedToLeave') || 'Failed to leave chat room');
      }
    }
    setGroupChatContextMenu(null);
  };

  const handleReportChat = async (groupId: string) => {
    const reason = window.prompt(t('reports.enterReason') || 'Please enter a reason for reporting this chat room:');
    if (!reason) return;

    try {
      await api.post(API_ENDPOINTS.REPORTS.CREATE, {
        reported_id: groupId,
        report_type: 'chatroom',
        reason: reason
      });
      toast.success(t('reports.reportSubmitted') || 'Report submitted successfully');
    } catch (error: any) {
      console.error('Failed to report chat:', error);
      toast.error(error.response?.data?.errors?.[0] || t('reports.reportFailed') || 'Failed to submit report');
    }
    setGroupChatContextMenu(null);
  };

  const handleReportMessage = async (messageId: string) => {
    const reason = window.prompt(t('reports.enterReason') || 'Please enter a reason for reporting this message:');
    if (!reason) return;

    try {
      await api.post(API_ENDPOINTS.MESSAGES.REPORT_PRIVATE(messageId), { reason });
      toast.success(t('reports.reportSubmitted') || 'Report submitted successfully');
    } catch (error: any) {
      console.error('Failed to report message:', error);
      toast.error(error.response?.data?.errors?.[0] || t('reports.reportFailed') || 'Failed to submit report');
    }
    setMessageContextMenu(null);
  };

  const handleGroupChatClick = (group: any) => {
    // If prop is provided, let parent handle it (preferred for split view)
    if (onGroupSelect) {
      onGroupSelect(group);
    } else {
      // Fallback to global event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openChatRoom', { detail: { chatRoomId: group.id } }));
      }
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

  // Mark conversation as read (for context menu)
  const handleMarkConversationAsRead = (userId: string) => {
    if (socket && connected) {
      socket.emit('mark_messages_read', { from_user_id: userId });
    }
    // Optimistically update local state
    setConversations(prev => prev.map(conv =>
      conv.user_id === userId ? { ...conv, unread_count: 0 } : conv
    ));
    setContextMenu(null);
  };

  // Mark group chat as read (for context menu)
  const handleMarkGroupChatAsRead = (groupId: string) => {
    // Update local state
    setGroupChats(prev => prev.map(group =>
      group.id === groupId ? { ...group, unread_count: 0 } : group
    ));
    setGroupChatContextMenu(null);
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
    // Validate userId before making request
    if (!userId || typeof userId !== 'string' || userId.trim() === '' || userId.length < 10) {
      console.warn(`[PrivateMessages] Skipping loadUserInfo for invalid userId: ${userId}`);
      return { lastLogin: null, isOnline: false };
    }

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
    } catch (error: any) {
      // Only log non-404 errors (404 means user doesn't exist, which is fine)
      if (error.response?.status !== 404) {
        console.error('Failed to load user info:', error);
      } else {
        // console.warn(`[PrivateMessages] User not found (404) for userId: ${userId}`);
      }
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
        // Map _id to id to ensure compatibility with Message interface
        const loadedMessages = (response.data.data || []).map((msg: any) => ({
          ...msg,
          id: msg.id || msg._id
        }));
        setMessages(loadedMessages);
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
          id: response.data.data.id || response.data.data._id,
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
  }


  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioStream(null);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error(t('chat.micError') || 'Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    setAudioBlob(null);
    setAudioStream(null);
    setRecordingDuration(0);
  };

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadFiles = async (files: File[]): Promise<Array<{ type: string, data: string, filename: string, size: number, mime_type: string }>> => {
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

    if ((!messageInput.trim() && !selectedGifUrl && selectedFiles.length === 0 && !audioBlob) || !selectedConversation || sendingMessage) {
      return;
    }

    try {
      setUploadingFiles(true);
      setSendingMessage(true);

      // Upload files if any
      let attachments: Array<{ type: string, data: string, filename: string, size: number, mime_type: string }> = [];
      if (selectedFiles.length > 0) {
        attachments = await uploadFiles(selectedFiles);
      }

      // Upload audio if present
      if (audioBlob) {
        const audioDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });

        attachments.push({
          type: 'audio',
          data: audioDataUrl,
          filename: 'voice_message.webm',
          size: audioBlob.size,
          mime_type: 'audio/webm'
        });
      }

      // Determine message type
      let messageType = 'text';
      let gifUrl: string | undefined = undefined;
      const content = messageInput.trim();

      if (selectedGifUrl) {
        messageType = 'gif';
        gifUrl = selectedGifUrl;
      } else if (audioBlob) {
        messageType = 'audio';
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
      const audioPlaceholder = `[${t('chat.audioMessage') || 'Voice Message'}]`;

      const finalContent = content || (messageType === 'gif' ? '[GIF]' : '') || (messageType === 'audio' ? audioPlaceholder : '') || (attachments.length > 0 ? attachmentPlaceholder : '');

      const response = await api.post(API_ENDPOINTS.MESSAGES.SEND_PRIVATE, {
        to_user_id: selectedConversation,
        content: finalContent,
        message_type: messageType,
        gif_url: gifUrl,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      if (response.data.success) {
        // Add message to local state
        const newMessage: Message = {
          id: response.data.data.id || response.data.data._id,
          content: finalContent,
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
        setAudioBlob(null);
        setRecordingDuration(0);

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
    setSelectedUser({ id: userId, username });
    setShowUserSelect(false);
    setMessages([]);
    loadMessages(userId);

    // Mark as read
    api.post(API_ENDPOINTS.USERS.MARK_CONVERSATION_READ(userId)).catch(() => { });
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
    setSelectedUser({ id: userId, username });
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

  // Calculate conversation statuses outside of JSX to avoid hook calls inside map (if any were hidden there)
  // Actually, the main issue might be stable object references or conditionally calling components.
  // We'll move the map logic to a prepared list.

  const preparedConversations = conversations.map(conversation => {
    const status = conversationStatuses.get(conversation.user_id);
    return {
      ...conversation,
      isOnline: status?.isOnline || false,
      lastLogin: status?.lastLogin || null,
      areFriends: status?.areFriends || false,
    };
  });

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
            <div className="flex items-center gap-2">
              {/* VOIP Call Button */}
              <VoipButton
                roomId={user ? [user.id, selectedUser.id].sort().join('_') : selectedUser.id}
                roomType="dm"
                roomName={selectedUser.username}
                variant="bordered"
              />
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
                    className={`flex items-start space-x-3 ${message.is_from_me ? 'justify-end' : ''
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
                    <div className={`w-full max-w-[85%] min-w-0 ${message.is_from_me ? 'order-first' : ''}`}>
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
                        className={`message-bubble ${message.is_from_me ? 'message-bubble-own' : 'message-bubble-other'
                          }`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMessageContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            messageId: message.id,
                            content: message.content,
                            userId: message.user_id || selectedUser?.id || '',
                            username: message.sender_username,
                            isFromMe: message.is_from_me,
                            isMuted: conversations.find(c => c.user_id === (message.user_id || selectedUser?.id))?.is_muted || false
                          });
                        }}
                      >
                        {message.gif_url ? (
                          <div className="mb-2">
                            <img
                              src={message.gif_url}
                              alt="GIF"
                              className="max-w-full h-auto rounded-lg"
                              loading="lazy"
                            />
                          </div>
                        ) : null}
                        {message.attachments && message.attachments.length > 0 ? (
                          <div className="flex flex-col space-y-2 mb-2 items-stretch">
                            {message.attachments.map((attachment, idx) => {
                              const attachmentKey = attachment.url || attachment.filename || `attachment-${idx}`;
                              if (attachment.type === 'image') {
                                return (
                                  <img
                                    key={attachmentKey}
                                    src={attachment.url}
                                    alt={attachment.filename}
                                    className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setViewingImage({ url: attachment.url, filename: attachment.filename })}
                                  />
                                );
                              } else if (attachment.type === 'video') {
                                return (
                                  <VideoPlayer
                                    key={attachmentKey}
                                    src={attachment.url}
                                    filename={attachment.filename}
                                    className="w-full max-w-full"
                                  />
                                );
                              } else if (attachment.type === 'audio') {
                                return (
                                  <div key={attachmentKey} className="w-full max-w-full min-w-[160px]">
                                    <AudioPlayer
                                      src={attachment.url}
                                      className="bg-transparent"
                                      filename={attachment.filename}
                                    />
                                  </div>
                                );
                              } else {
                                return (
                                  <FileCard
                                    key={attachmentKey}
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
                              const partKey = `${message.id}-part-${idx}`;
                              if (part.startsWith('@')) {
                                const username = part.substring(1);
                                return (
                                  <span
                                    key={partKey}
                                    className="font-medium text-white hover:underline cursor-pointer"
                                    onMouseEnter={(e) => handleMouseEnter(e, '', username)}
                                    onMouseLeave={handleMouseLeave}
                                    onClick={(e) => handleClick(e, '', username)}
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
                              return <span key={partKey}>{part}</span>;
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
          <MessageInput
            value={messageInput}
            onChange={setMessageInput}
            onSend={(e) => handleSendMessage(e as any)}
            isLoading={sendingMessage}
            placeholder={t('privateMessages.typeMessage')}
            selectedGifUrl={selectedGifUrl}
            onRemoveGif={() => setSelectedGifUrl(null)}
            selectedFiles={selectedFiles}
            onFileSelect={handleFileSelect}
            onRemoveFile={(idx) => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
            isRecording={isRecording}
            recordingDuration={recordingDuration}
            audioBlob={audioBlob}
            audioStream={audioStream}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onCancelRecording={cancelRecording}
            onRemoveAudio={() => { setAudioBlob(null); setRecordingDuration(0); }}
            onGifClick={() => setShowGifPicker(!showGifPicker)}
            showGifPicker={showGifPicker}
          >
            {showGifPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-50 max-md:-right-12 min-w-[300px]">
                <GifPicker
                  onSelectGif={handleGifSelect}
                  onClose={() => setShowGifPicker(false)}
                  position="right"
                />
              </div>
            )}
          </MessageInput>
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
                  <Users className="w-5 h-5 theme-text-primary" />
                </button>
              </div>
            </div>
          </div>


          <div id="messages-container" className="flex-1 flex flex-col overflow-hidden">
            {/* Private Messages Section */}
            <div
              className="flex flex-col overflow-hidden"
              style={{ height: `${dividerPosition}%` }}
            >
              <div className="px-4 py-2 mt-2 flex items-center justify-between flex-shrink-0">
                <h3 className="text-xs font-semibold theme-text-secondary uppercase tracking-wider">
                  {t('privateMessages.directMessages') || 'Direct Messages'}
                </h3>
                <button
                  onClick={() => setShowAddFriendModal(true)}
                  className="p-1 hover:theme-bg-tertiary rounded-full transition-colors"
                  title={t('privateMessages.startNewConversation')}
                >
                  <svg className="w-4 h-4 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Conversations List */}
              <div id="conversations-list">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8">
                    <svg className="w-16 h-16 theme-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8H19C20.1046 8 21 8.89543 21 10V16C21 17.1046 20.1046 18 19 18H17V22L13 18H9C8.44772 18 7.94772 17.7761 7.58579 17.4142M7.58579 17.4142L11 14H15C16.1046 14 17 13.1046 17 12V6C17 4.89543 16.1046 4 15 4H5C3.89543 4 3 4.89543 3 6V12C3 13.1046 3.89543 14 5 14H7V18L7.58579 17.4142Z" />
                    </svg>
                    <h3 className="text-lg font-medium theme-text-primary mb-2">
                      {t('privateMessages.noConversations')}
                    </h3>
                    <p className="theme-text-secondary text-center mb-6">
                      {t('privateMessages.startConversationHint') || 'Search for users to start a conversation'}
                    </p>
                    <button
                      onClick={() => setShowAddFriendModal(true)}
                      className="px-4 py-2 btn btn-primary"
                    >
                      <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
                          setUserContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            userId: conversation.user_id,
                            username: conversation.username,
                          });
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            userId: conversation.user_id,
                            username: conversation.username,
                            isMuted: conversation.is_muted || false,
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

            {/* Resizable Divider */}
            <div className="relative z-10">
              {/* Invisible Hit Area for easier grabbing */}
              <div
                className="absolute inset-x-0 -top-2 -bottom-2 cursor-row-resize z-20"
                onMouseDown={handleDividerMouseDown}
                onTouchStart={handleDividerTouchStart}
                style={{ touchAction: 'none' }}
              />
              {/* Visible Divider Line */}
              <div
                className={`h-1 border-t theme-border transition-colors ${isDraggingDivider ? 'bg-blue-500 border-transparent' : 'hover:bg-blue-500 hover:border-transparent'}`}
                style={{ touchAction: 'none' }}
              />
            </div>

            {/* Group Chats Section */}
            <div
              className="flex flex-col overflow-hidden"
              style={{ height: `${100 - dividerPosition}%` }}
            >
              <div className="px-4 py-2 flex items-center justify-between flex-shrink-0">

                <h3 className="text-xs font-semibold theme-text-secondary uppercase tracking-wider">
                  {t('chats.groupChats') || 'Group Chats'}
                </h3>
                <button
                  onClick={() => setShowGroupChatCreate(true)}
                  className="p-1 hover:theme-bg-tertiary rounded-full transition-colors"
                  title={t('chats.createGroup') || 'Create Group'}
                >
                  <svg className="w-4 h-4 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {groupChats.length > 0 ? (
                  <div>
                    {groupChats.filter(group => !hiddenChats.has(group.id)).map(group => (
                      <div
                        key={group.id}
                        onClick={() => handleGroupChatClick(group)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setGroupChatContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            groupId: group.id,
                            groupName: group.name,
                            isMuted: group.is_muted || false,
                          });
                        }}
                        className="w-full px-4 py-3 flex items-center space-x-3 hover:theme-bg-tertiary transition-colors cursor-pointer"
                      >
                        <div className="relative">
                          {group.picture ? (
                            <img src={group.picture} alt={group.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold">
                              {group.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <div className="flex items-center gap-2 min-w-0 overflow-hidden mr-2">
                              <h4 className="text-sm font-semibold theme-text-primary truncate">{group.name}</h4>

                              {/* Consolidated Unread Count Bubble */}
                              {(group.unread_count || 0) > 0 && (
                                <div className="relative flex items-center justify-center">
                                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce-in flex-shrink-0 min-w-[18px] text-center shadow-sm">
                                    {(group.unread_count || 0) > 99 ? '99+' : group.unread_count}
                                  </span>
                                </div>
                              )}
                            </div>
                            {group.last_activity && (
                              <span className="text-[10px] theme-text-muted flex-shrink-0">
                                {formatTimestamp(group.last_activity)}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-xs theme-text-secondary truncate mr-2">
                              {group.description || t('chats.noDescription')}
                            </p>
                            <span className="text-[10px] theme-text-muted whitespace-nowrap">
                              {group.member_count} {group.member_count === 1 ? (t('chats.member') || 'Member') : (t('chats.members') || 'Members')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8">
                    <svg className="w-16 h-16 theme-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="text-lg font-medium theme-text-primary mb-2">
                      {t('chats.noGroupChats') || 'No group chats yet'}
                    </h3>
                    <p className="theme-text-secondary text-center mb-6">
                      {t('chats.startGroupHint') || 'Create a new group to start chatting with friends'}
                    </p>
                    <button
                      onClick={() => setShowGroupChatCreate(true)}
                      className="px-4 py-2 btn btn-primary"
                    >
                      <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('chats.createGroup') || 'Create Group'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
      }

      {/* User Select Modal */}
      {
        showUserSelect && (
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
                {preparedConversations.map((conversation) => (
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
                        isMuted: conversation.is_muted || false,
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
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium theme-text-primary">{conversation.username}</h4>
                          {conversation.isOnline && (
                            <span className="w-2 h-2 bg-green-500 rounded-full" title={t('privateMessages.online')}></span>
                          )}
                        </div>
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
        )
      }

      {/* Add Friend Modal */}
      {
        showAddFriendModal && (
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
        )
      }

      {/* Friends Dialog */}
      <FriendsDialog
        isOpen={showFriendsDialog}
        onClose={() => setShowFriendsDialog(false)}
        onSelectFriend={(friendId, username) => handleStartConversation(friendId, username)}
      />

      {/* Context Menu */}
      {
        contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={[
              {
                label: t('privateMessages.markAsRead'),
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ),
                action: () => handleMarkConversationAsRead(contextMenu.userId),
              },
              contextMenu.isMuted ? {
                label: t('mute.unmute') || 'Unmute',
                icon: <Volume2 className="w-4 h-4" />,
                action: () => handleMuteConversation(contextMenu.userId, 0),
              } : {
                label: t('privateMessages.muteConversation'),
                icon: <VolumeX className="w-4 h-4" />,
                action: () => { },
                submenu: [
                  {
                    label: t('mute.15m') || '15 Minutes',
                    action: () => handleMuteConversation(contextMenu.userId, 15),
                  },
                  {
                    label: t('mute.1h') || '1 Hour',
                    action: () => handleMuteConversation(contextMenu.userId, 60),
                  },
                  {
                    label: t('mute.8h') || '8 Hours',
                    action: () => handleMuteConversation(contextMenu.userId, 480),
                  },
                  {
                    label: t('mute.24h') || '24 Hours',
                    action: () => handleMuteConversation(contextMenu.userId, 1440),
                  },
                  {
                    label: t('mute.always') || 'Until I turn it back on',
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
        )
      }

      {/* User Hover Card / Tooltip */}
      {
        tooltipState && (
          <React.Fragment>
            {/* Wrapper to Capture Mouse Enter for Tooltip Persistence is pointless if UserTooltip stops propagation. 
                However, I can pass a custom onClose to UserTooltip that checks timing? 
                Actually, UserTooltip.tsx has onMouseLeave => onClose. 
                If I modify UserTooltip to accept onMouseEnter, I can cancel the timer.
                For now, let's assume I will modify UserTooltip.tsx next. 
            */}
            <UserTooltip
              username={tooltipState.username}
              x={tooltipState.x}
              y={tooltipState.y}
              onClose={() => setTooltipState(null)}
            />
          </React.Fragment>
        )
      }

      {/* User Banner (Click) */}
      {
        bannerState && (
          <UserBanner
            userId={bannerState.userId}
            username={bannerState.username}
            x={bannerState.x - 40}
            y={bannerState.y}
            onClose={handleBannerClose}
            onSendMessage={(userId, username) => {
              window.dispatchEvent(new CustomEvent('openPrivateMessage', {
                detail: { userId, username }
              }));
              setBannerState(null);
            }}
          />
        )
      }

      {/* Message Context Menu */}
      {messageContextMenu && (
        <ContextMenu
          x={messageContextMenu.x}
          y={messageContextMenu.y}
          onClose={() => setMessageContextMenu(null)}
          items={[
            ...(messageContextMenu.isFromMe ? [{
              label: t('privateMessages.unsendMessage') || 'Unsend Message',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              ),
              danger: true,
              action: () => handleDeleteMessage(messageContextMenu.messageId, 'hard'),
            }] : []),
            {
              label: t('settings.hideForMe') || 'Hide for Me',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ),
              action: () => handleDeleteMessage(messageContextMenu.messageId, 'soft'),
            },
            ...(!messageContextMenu.isFromMe ? [
              messageContextMenu.isMuted ? {
                label: t('mute.unmute') || 'Unmute',
                icon: <Volume2 className="w-4 h-4" />,
                action: () => handleMuteConversation(messageContextMenu.userId, 0),
              } : {
                label: t('privateMessages.muteConversation') || 'Mute User',
                icon: <VolumeX className="w-4 h-4" />,
                action: () => { },
                submenu: [
                  {
                    label: t('mute.15m') || '15 Minutes',
                    action: () => handleMuteConversation(messageContextMenu.userId, 15),
                  },
                  {
                    label: t('mute.1h') || '1 Hour',
                    action: () => handleMuteConversation(messageContextMenu.userId, 60),
                  },
                  {
                    label: t('mute.8h') || '8 Hours',
                    action: () => handleMuteConversation(messageContextMenu.userId, 480),
                  },
                  {
                    label: t('mute.24h') || '24 Hours',
                    action: () => handleMuteConversation(messageContextMenu.userId, 1440),
                  },
                  {
                    label: t('mute.always') || 'Until I turn it back on',
                    action: () => handleMuteConversation(messageContextMenu.userId, -1),
                  },
                ],
              },
              {
                label: t('privateMessages.reportMessage') || 'Report Message',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ),
                danger: true,
                action: () => handleReportMessage(messageContextMenu.messageId),
              }
            ] : []),
          ]}
        />
      )}

      {/* User Context Menu */}
      {
        userContextMenu && (
          <UserContextMenu
            userId={userContextMenu.userId}
            username={userContextMenu.username}
            x={userContextMenu.x}
            y={userContextMenu.y}
            areFriends={areFriends}
            onClose={() => setUserContextMenu(null)}
            onMarkAsRead={(userId) => {
              handleMarkConversationAsRead(userId);
              setUserContextMenu(null);
            }}
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
            onSilence={() => {
              // Submenu in UserContextMenu handles mute API calls directly
            }}
          />
        )
      }

      {/* Report User Dialog */}
      {
        showReportDialog && userToReport && (
          <ReportUserDialog
            userId={userToReport.userId}
            username={userToReport.username}
            onClose={() => {
              setShowReportDialog(false);
              setUserToReport(null);
            }}
            includeMessageHistory={true}
          />
        )
      }

      {
        showGroupChatCreate && (
          <GroupChatCreateModal
            onClose={() => setShowGroupChatCreate(false)}
            onGroupCreated={handleGroupCreated}
          />
        )
      }

      {/* Image Viewer Modal */}
      {
        viewingImage && (
          <ImageViewerModal
            imageUrl={viewingImage.url}
            filename={viewingImage.filename}
            onClose={() => setViewingImage(null)}
          />
        )
      }

      {
        groupChatContextMenu && (
          <ChatRoomContextMenu
            chatId={groupChatContextMenu.groupId}
            chatName={groupChatContextMenu.groupName}
            x={groupChatContextMenu.x}
            y={groupChatContextMenu.y}
            isMuted={groupChatContextMenu.isMuted}
            onClose={() => setGroupChatContextMenu(null)}
            onHide={() => handleHideGroupChat(groupChatContextMenu.groupId)}
            onMute={async (chatId: string, minutes: number) => {
              try {
                if (minutes === 0) {
                  await api.post(API_ENDPOINTS.MUTE.UNMUTE_CHAT_ROOM(chatId));
                  toast.success(t('mute.unmuted') || 'Unmuted');
                } else {
                  await api.post(API_ENDPOINTS.MUTE.MUTE_CHAT_ROOM(chatId), { minutes });
                  const duration = minutes === -1 ? (t('mute.forever') || 'forever') : `${minutes} ${t('common.minutes') || 'minutes'}`;
                  toast.success(t('mute.success', { name: groupChatContextMenu.groupName, duration }) || `${groupChatContextMenu.groupName} muted for ${duration}`);
                }
              } catch (error) {
                console.error('Failed to mute chat:', error);
                toast.error(t('mute.error') || 'Failed to mute');
              }
              setGroupChatContextMenu(null);
            }}
            onFollow={async (chatId: string) => {
              try {
                await api.post(API_ENDPOINTS.CHAT_ROOMS.JOIN(chatId));
                toast.success(t('chat.joinedChatroom') || 'Joined chat room');
                // Optmistically update or reload group chats? 
                // For now, reload to get correct state
                loadGroupChats();
              } catch (error) {
                toast.error(t('chat.failedToJoin') || 'Failed to join chat room');
              }
              setGroupChatContextMenu(null);
            }}
            onUnfollow={async (chatId: string) => {
              // Unfollow is same as Leave for chat rooms in this UI
              if (window.confirm(t('chat.confirmLeave', { name: groupChatContextMenu.groupName }) || `Are you sure you want to leave "${groupChatContextMenu.groupName}"?`)) {
                try {
                  await api.post(API_ENDPOINTS.CHAT_ROOMS.LEAVE(chatId));
                  toast.success(t('chat.leftChatroom') || 'Left chat room');
                  setGroupChats(prev => prev.filter(g => g.id !== chatId));
                } catch (error) {
                  toast.error(t('chat.failedToLeave') || 'Failed to leave chat room');
                }
              }
              setGroupChatContextMenu(null);
            }}
            onDelete={groupChats.find(g => g.id === groupChatContextMenu.groupId)?.owner_id === user?.id ? async (chatId: string) => {
              if (window.confirm(t('chats.confirmDeleteChatroom', { name: groupChatContextMenu.groupName }) || `Are you sure you want to delete "${groupChatContextMenu.groupName}"?`)) {
                try {
                  await api.delete(API_ENDPOINTS.CHAT_ROOMS.DELETE(chatId));
                  toast.success(t('chat.chatRoomDeleted') || 'Chat room deleted');
                  setGroupChats(prev => prev.filter(g => g.id !== chatId));
                } catch (error) {
                  toast.error(t('chat.failedToDelete') || 'Failed to delete chat room');
                }
              }
              setGroupChatContextMenu(null);
            } : undefined}
            isOwner={groupChats.find(g => g.id === groupChatContextMenu.groupId)?.owner_id === user?.id}
            onReport={() => handleReportChat(groupChatContextMenu.groupId)}
            onLeave={() => handleLeaveChat(groupChatContextMenu.groupId, groupChatContextMenu.groupName)}
          />
        )
      }

      {/* VOIP Control Bar is now rendered globally in _app.tsx */}
    </div >
  );
};

export default PrivateMessagesSimplified;
