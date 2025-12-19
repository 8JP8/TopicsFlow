import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import GifPicker from '../Chat/GifPicker';
import MentionList from '@/components/UI/MentionList';
import UserTooltip from '@/components/UI/UserTooltip';
import UserBanner from '@/components/UI/UserBanner';
import UserContextMenu from '@/components/UI/UserContextMenu';
import Avatar from '@/components/UI/Avatar';
import UserBadges from '@/components/UI/UserBadges';
import { getUserProfilePicture } from '@/hooks/useUserProfile';
import ReportUserDialog from '@/components/Reports/ReportUserDialog';
import ChatRoomMembersModal from './ChatRoomMembersModal';
import VideoPlayer from '@/components/UI/VideoPlayer';
import FileCard from '@/components/UI/FileCard';
import ImageViewerModal from '@/components/UI/ImageViewerModal';
import MessageDeleteDialog from '@/components/UI/MessageDeleteDialog';
import MessageContextMenu from '@/components/UI/MessageContextMenu';
import ChatIcon from '@/components/UI/ChatIcon';
import ChatRoomContextMenu from '@/components/UI/ChatRoomContextMenu';
import { VoipButton, VoipControlBar } from '@/components/Voip';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { getAnonymousModeState, saveAnonymousModeState, getLastAnonymousName } from '@/utils/anonymousStorage';

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
  chat_room_id?: string;
  gif_url?: string;
  is_admin?: boolean;
  is_owner?: boolean;
  is_moderator?: boolean;
  attachments?: Array<{
    type: string;
    url: string;
    filename: string;
    size?: number;
    mime_type?: string;
  }>;
}

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  theme_id?: string;
  topic_id?: string;
  owner_id: string;
  owner_username?: string;
  member_count: number;
  message_count: number;
  is_public: boolean;
  picture?: string;
  background_picture?: string;
}

interface ChatRoomContainerProps {
  room: ChatRoom;
  themeId?: string;
  onBack?: () => void;
}

const ChatRoomContainer: React.FC<ChatRoomContainerProps> = ({
  room,
  themeId,
  onBack,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  // Load anonymous mode state from localStorage if room has a topic_id
  const savedState = room.topic_id ? getAnonymousModeState(room.topic_id) : { isAnonymous: false, name: '' };
  const [useAnonymous, setUseAnonymous] = useState(savedState.isAnonymous);
  const [loading, setLoading] = useState(true);
  const [roomJoined, setRoomJoined] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

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
      // If search is too short, just reset to all members
      if (mentionSearch.length < 2) {
        setMentionUsers(roomMembers);
        return;
      }

      // If room is NOT public, only filter local members
      if (!room.is_public) {
        // Simple client-side filtering
        const localMatches = roomMembers.filter(m =>
          m.username.toLowerCase().includes(mentionSearch.toLowerCase()) ||
          (m as any).display_name?.toLowerCase().includes(mentionSearch.toLowerCase())
        );
        setMentionUsers(localMatches.length > 0 ? localMatches : roomMembers);
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
  }, [mentionSearch, roomMembers, room.is_public]);

  // User interaction state
  const [showUserBanner, setShowUserBanner] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string, username: string, x?: number, y?: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ userId: string, username: string, x: number, y: number } | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [userToReport, setUserToReport] = useState<{ userId: string, username: string } | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersModalMode, setMembersModalMode] = useState<'view' | 'manage'>('view');
  const [roomData, setRoomData] = useState<any>(null);
  const [chatContextMenu, setChatContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [reportType, setReportType] = useState<'chatroom' | 'chatroom_background' | 'chatroom_picture' | null>(null);
  const [viewingImage, setViewingImage] = useState<{ url: string, filename: string } | null>(null);


  // Interaction State
  const [tooltipState, setTooltipState] = useState<{ username: string, x: number, y: number } | null>(null);
  const hoverOpenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (e: React.MouseEvent, userId: string, username: string) => {
    // If banner is already open, don't show tooltip
    if (showUserBanner) return;

    // Clear any pending close timer (in case moving between mentions)
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }

    // Set timer to open tooltip after 2 seconds
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);

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
    setSelectedUser({ userId, username, x: rect.left + rect.width / 2, y: rect.top });
    setShowUserBanner(true);
  };

  // Message context menu state
  const [messageContextMenu, setMessageContextMenu] = useState<{ messageId: string, userId?: string, username?: string, x: number, y: number } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<{ messageId: string, isOwnerDeletion: boolean } | null>(null);
  const [showReportUserDialog, setShowReportUserDialog] = useState(false);
  const [userToReportFromMessage, setUserToReportFromMessage] = useState<{ userId: string, username: string, messageId: string } | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(true); // Default to true

  const isOwner = user?.id === room.owner_id;

  // Load follow status
  useEffect(() => {
    if (user && room.id) {
      api.get(API_ENDPOINTS.NOTIFICATION_SETTINGS.CHATROOM_STATUS(room.id))
        .then(response => {
          if (response.data.success) {
            setIsFollowing(response.data.data?.following !== false);
          }
        })
        .catch(() => {
          // Default to following on error
          setIsFollowing(true);
        });
    }
  }, [user, room.id]);

  // Check if user is moderator
  const isModerator = Array.isArray(roomData?.moderators) && roomData.moderators.includes(user?.id);
  const canManage = isOwner || isModerator;

  // Load room data to get moderators
  useEffect(() => {
    if (room?.id) {
      loadRoomData();
    }
  }, [room?.id]);

  // Load messages
  useEffect(() => {
    if (room?.id) {
      loadMessages();
    }
  }, [room?.id]);

  // Join room via Socket.IO
  useEffect(() => {
    if (socket && room?.id && connected) {
      socket.emit('join_chat_room', { room_id: room.id });

      socket.on('chat_room_joined', (data: any) => {
        if (data.room_id === room.id) {
          setRoomJoined(true);
        }
      });

      socket.on('new_chat_room_message', (message: Message) => {
        if (message.chat_room_id === room.id) {
          setMessages(prev => [...prev, message]);
          scrollToBottom();
        }
      });

      return () => {
        socket.off('chat_room_joined');
        socket.off('new_chat_room_message');
        if (room?.id) {
          socket.emit('leave_chat_room', { room_id: room.id });
        }
      };
    }
  }, [socket, room?.id, connected]);

  const loadRoomData = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET(room.id));
      if (response.data.success) {
        setRoomData(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to load room data:', error);
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.MESSAGES(room.id), {
        limit: 50,
      });

      if (response.data.success) {
        setMessages(response.data.data || []);
        scrollToBottom();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('chat.failedToLoadMessages'));
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch room members for @ mention autocomplete
  const fetchRoomMembers = async () => {
    if (!room?.id) return;

    try {
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_MEMBERS(room.id));

      if (response.data.success && response.data.data) {
        let members = response.data.data.map((member: any) => ({
          id: member.id,
          username: member.username,
          display_name: member.display_name,
          profile_picture: member.profile_picture,
          role: member.is_admin ? 'admin' : undefined,
          is_owner: member.is_owner,
          is_moderator: member.is_moderator
        }));

        // Filter for DMs (private, 2 members) - though we already have the list, no need to filter further if backend returns correct members.
        // But user said "conversas" might include more people. If it's a DM, backend returns 2 people.

        // Add @todos if owner
        if (isOwner) {
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
  };

  // Fetch members when room is joined
  useEffect(() => {
    if (roomJoined) {
      fetchRoomMembers();
    }
  }, [roomJoined, room?.id]);

  // Load anonymous mode state from localStorage when room changes
  useEffect(() => {
    if (room.topic_id) {
      const saved = getAnonymousModeState(room.topic_id);
      setUseAnonymous(saved.isAnonymous);
    } else {
      setUseAnonymous(false);
    }
  }, [room.topic_id]);

  // Save anonymous mode state to localStorage when it changes
  useEffect(() => {
    if (room.topic_id) {
      saveAnonymousModeState(room.topic_id, useAnonymous);
    }
  }, [room.topic_id, useAnonymous]);

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
  };

  const handleSelectMention = (username: string) => {
    const before = messageInput.substring(0, mentionCursorPosition);
    const after = messageInput.substring(mentionCursorPosition + mentionSearch.length + 1);
    const newValue = `${before} @${username} ${after} `;
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const uploadFiles = async (files: File[]): Promise<Array<{ type: string, data: string, filename: string, size: number, mime_type: string }>> => {
    const uploadPromises = files.map(async (file) => {
      // Convert file to base64 data URL for backend processing
      // The backend will process this and store the file, returning a file_id reference
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

    if (!messageInput.trim() && !selectedGifUrl && selectedFiles.length === 0) {
      return;
    }

    try {
      setUploadingFiles(true);

      // Upload files if any
      let attachments: Array<{ type: string, data: string, filename: string, size: number, mime_type: string }> = [];
      if (selectedFiles.length > 0) {
        attachments = await uploadFiles(selectedFiles);
      }

      // Determine message type
      let messageType = 'text';
      if (selectedGifUrl) {
        messageType = 'gif';
      } else if (attachments.length > 0) {
        if (attachments.some(a => a.type === 'image')) {
          messageType = 'image';
        } else if (attachments.some(a => a.type === 'video')) {
          messageType = 'video';
        } else {
          messageType = 'file';
        }
      }

      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.SEND_MESSAGE(room.id), {
        content: messageInput.trim() || (selectedGifUrl ? '[GIF]' : '') || (attachments.length > 0 ? '[Attachment]' : ''),
        message_type: messageType,
        gif_url: selectedGifUrl,
        attachments: attachments.length > 0 ? attachments : undefined,
        use_anonymous: useAnonymous,
      });

      if (response.data.success) {
        setMessageInput('');
        setSelectedGifUrl(null);
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Message will be added via Socket.IO event
      } else {
        toast.error(response.data.errors?.[0] || t('chat.failedToSendMessage'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('chat.failedToSendMessage'));
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleGifSelect = (gifUrl: string) => {
    setSelectedGifUrl(gifUrl);
    setShowGifPicker(false);
  };

  const handleDeleteMessage = async (messageId: string, reason?: string) => {
    try {
      const response = await api.delete(API_ENDPOINTS.CHAT_ROOMS.DELETE_MESSAGE(room.id, messageId), {
        data: reason ? { reason } : undefined
      });
      if (response.data.success) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        toast.success(t('chat.messageDeleted') || 'Message deleted');
        setShowDeleteDialog(false);
        setMessageToDelete(null);
      } else {
        toast.error(response.data.errors?.[0] || t('chat.failedToDeleteMessage') || 'Failed to delete message');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('chat.failedToDeleteMessage') || 'Failed to delete message');
    }
  };

  const handleReportUserFromMessage = (messageId: string, userId: string, username: string) => {
    setUserToReportFromMessage({ userId, username, messageId });
    setShowReportUserDialog(true);
    setMessageContextMenu(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Background Container - Contained within chat room */}
      {roomData?.background_picture && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${roomData.background_picture.startsWith('data:') ? roomData.background_picture : `data:image/jpeg;base64,${roomData.background_picture}`})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
            zIndex: 0,
          }}
        />
      )}
      {roomData?.background_picture && (
        <div
          className="absolute inset-0 pointer-events-none bg-black bg-opacity-40 dark:bg-opacity-50"
          style={{
            zIndex: 1,
          }}
        />
      )}

      {/* Chat Content Wrapper */}
      <div className="h-full flex relative" style={{ zIndex: 10, backgroundColor: 'transparent' }}>

        {/* Main Chat Column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between theme-bg-primary bg-opacity-90 dark:bg-opacity-90 backdrop-blur-sm">
            <div className="flex-1 flex items-center gap-3">
              {/* Chat Room Picture */}
              {roomData?.picture ? (
                <img
                  src={roomData.picture.startsWith('data:') ? roomData.picture : `data:image/jpeg;base64,${roomData.picture}`}
                  alt={room.name}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border-2 theme-border"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg theme-bg-secondary flex items-center justify-center flex-shrink-0 border-2 theme-border">
                  <span className="text-xl font-semibold theme-text-primary">
                    {room.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div
                className="flex-1"
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setChatContextMenu({ x: e.clientX, y: e.clientY });
                }}
              >
                <h2 className="text-xl font-bold theme-text-primary">
                  {room.name}
                </h2>
                {room.description && (
                  <p className="text-sm theme-text-secondary mt-1">
                    {room.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs theme-text-muted">
                  <button
                    onClick={() => {
                      if (!room.is_public) {
                        setMembersModalMode('view');
                        setShowMembersModal(true);
                      }
                    }}
                    className={`flex items-center gap-1 transition-colors ${!room.is_public ? 'hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer' : 'cursor-default'}`}
                    title={!room.is_public ? (t('chat.viewMembers') || 'View Members') : ''}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {room.is_public ? (t('chatRooms.public') || 'Public') : `${room.member_count} ${t('chat.members')} `}
                  </button>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    {room.message_count} {room.message_count === 1 ? t('chat.message') : t('chat.messages')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* VOIP Button for voice calls */}
              <VoipButton
                roomId={room.id}
                roomType="group"
                roomName={room.name}
              />
              {isOwner && (
                <button
                  onClick={() => {
                    setMembersModalMode('manage');
                    setShowMembersModal(true);
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                  title={t('chat.manageChat') || 'Manage Chat'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t('chat.manageChat') || 'Manage Chat'}
                </button>
              )}
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  {t('common.back')}
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto relative" style={{ backgroundColor: 'transparent' }}>
            <div className="p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p>{t('chat.noMessages')}</p>
                </div>
              ) : (
                messages.map(message => (
                  <div
                    key={message.id}
                    className="flex gap-3"
                  >
                    {/* Avatar */}
                    {message.is_anonymous ? (
                      <div
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          setSelectedUser({
                            userId: message.user_id || '',
                            username: message.display_name
                          });
                          setShowUserBanner(true);
                        }}
                      >
                        {message.display_name?.charAt(0).toUpperCase() || 'A'}
                      </div>
                    ) : message.user_id ? (
                      <Avatar
                        userId={message.user_id}
                        username={message.display_name}
                        profilePicture={getUserProfilePicture(message.user_id)}
                        size="md"
                        onClick={() => {
                          setSelectedUser({
                            userId: message.user_id!,
                            username: message.display_name
                          });
                          setShowUserBanner(true);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            userId: message.user_id!,
                            username: message.display_name,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      />
                    ) : null}

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:underline"
                          onClick={(e) => {
                            if (message.user_id) {
                              const rect = e?.currentTarget?.getBoundingClientRect();
                              setSelectedUser({
                                userId: message.user_id,
                                username: message.display_name,
                                x: rect ? rect.right + 10 : undefined,
                                y: rect ? rect.top : undefined
                              });
                              setShowUserBanner(true);
                            }
                          }}
                          onContextMenu={(e) => {
                            if (message.user_id && !message.is_anonymous) {
                              e.preventDefault();
                              setContextMenu({
                                userId: message.user_id,
                                username: message.display_name,
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }
                          }}
                        >
                          {message.display_name}
                        </span>
                        <UserBadges
                          isFromMe={user?.id === message.user_id}
                          isAdmin={message.is_admin}
                          isOwner={message.is_owner}
                          isModerator={message.is_moderator}
                          isAnonymous={message.is_anonymous}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div
                        className="relative"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMessageContextMenu({
                            messageId: message.id,
                            userId: message.user_id,
                            username: message.display_name,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      >
                        {message.gif_url ? (
                          <img
                            src={message.gif_url}
                            alt="GIF"
                            className="max-w-md rounded-lg"
                          />
                        ) : message.attachments && message.attachments.length > 0 ? (
                          <div className="space-y-2">
                            {message.attachments.map((attachment, idx) => {
                              if (attachment.type === 'image') {
                                return (
                                  <img
                                    key={idx}
                                    src={attachment.url}
                                    alt={attachment.filename}
                                    className="max-w-md rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setViewingImage({ url: attachment.url, filename: attachment.filename })}
                                  />
                                );
                              } else if (attachment.type === 'video') {
                                return (
                                  <VideoPlayer
                                    key={idx}
                                    src={attachment.url}
                                    filename={attachment.filename}
                                    className="max-w-md h-64"
                                    onShare={(url) => {
                                      navigator.clipboard.writeText(url).then(() => {
                                        toast.success(t('common.share') || 'Link copied to clipboard');
                                      });
                                    }}
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
                            {message.content && message.content !== '[Attachment]' && (
                              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {message.content.split(/(@\w+)/g).map((part, idx) => {
                                  if (part.startsWith('@')) {
                                    const username = part.substring(1);
                                    return (
                                      <span
                                        key={idx}
                                        className="font-medium text-white hover:underline cursor-pointer"
                                        onMouseEnter={(e) => handleMouseEnter(e, '', username)}
                                        onMouseLeave={handleMouseLeave}
                                        onClick={(e) => handleClick(e, '', username)}
                                      >
                                        {part}
                                      </span>
                                    );

                                  }
                                  return <span key={idx}>{part}</span>;
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {message.content.split(/(@\w+)/g).map((part, idx) => {
                              if (part.startsWith('@')) {
                                const username = part.substring(1);
                                return (
                                  <span
                                    key={idx}
                                    className="font-medium text-white hover:underline cursor-pointer"
                                    onMouseEnter={(e) => handleMouseEnter(e, '', username)}
                                    onMouseLeave={handleMouseLeave}
                                    onClick={(e) => handleClick(e, '', username)}
                                  >
                                    {part}
                                  </span>
                                );
                              }
                              return <span key={idx}>{part}</span>;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            {selectedGifUrl && (
              <div className="mb-2 relative">
                <img
                  src={selectedGifUrl}
                  alt="Selected GIF"
                  className="max-w-xs rounded-lg"
                />
                <button
                  onClick={() => setSelectedGifUrl(null)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}

            {selectedFiles.length > 0 && (
              <div className="mb-2 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowGifPicker(!showGifPicker)}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  title={t('chat.addGif')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>

                {showGifPicker && (
                  <div className="absolute bottom-full left-0 mb-2">
                    <GifPicker
                      onSelectGif={handleGifSelect}
                      onClose={() => setShowGifPicker(false)}
                      position="left"
                    />
                  </div>
                )}
              </div>

              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  title={t('chat.attachFile') || 'Attach file'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={messageInput}
                  onChange={handleMessageInputChange}
                  onKeyDown={handleMentionKeyDown}
                  placeholder={t('chat.sendMessage')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* Mention Dropdown */}
                {showMentionDropdown && mentionUsers.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-1 z-50">
                    <MentionList
                      users={mentionUsers.filter(u => u.username.toLowerCase().includes(mentionSearch.toLowerCase()))}
                      selectedIndex={selectedMentionIndex}
                      onSelect={handleSelectMention}
                    />
                  </div>

                )}
              </div>
              <button
                type="submit"
                disabled={(!messageInput.trim() && !selectedGifUrl && selectedFiles.length === 0) || uploadingFiles}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {uploadingFiles ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {t('common.uploading') || 'Uploading...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    {t('chat.send')}
                  </>
                )}
              </button>
            </form>
          </div>
        </div >




        {/* User Context Menu */}
        {
          contextMenu && (
            <UserContextMenu
              userId={contextMenu.userId}
              username={contextMenu.username}
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onSendMessage={async (userId, username) => {
                setContextMenu(null);
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
              onReportUser={(userId, username) => {
                setUserToReport({ userId, username });
                setShowReportDialog(true);
                setContextMenu(null);
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
              canManage={canManage && !room.is_public}
              isOwner={isOwner}
              isModerator={roomData?.moderators?.includes(contextMenu.userId) || false}
              onPromoteToModerator={async (userId, username) => {
                if (!confirm(t('chat.confirmPromote', { username }) || `Are you sure you want to promote ${username} to moderator?`)) {
                  return;
                }
                try {
                  const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.ADD_MODERATOR(room.id), {
                    user_id: userId
                  });
                  if (response.data.success) {
                    toast.success(t('chat.moderatorPromoted') || 'User promoted to moderator');
                    await loadRoomData();
                    setContextMenu(null);
                  } else {
                    toast.error(response.data.errors?.[0] || t('chat.failedToPromote') || 'Failed to promote user');
                  }
                } catch (error: any) {
                  toast.error(error.response?.data?.errors?.[0] || t('chat.failedToPromote') || 'Failed to promote user');
                }
              }}
              onKickUser={async (userId, username) => {
                if (!confirm(t('chat.confirmKick', { username }) || `Are you sure you want to kick ${username}?`)) {
                  return;
                }
                try {
                  const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.KICK_USER(room.id, userId));
                  if (response.data.success) {
                    toast.success(t('chat.userKicked') || 'User kicked successfully');
                    await loadRoomData();
                    setContextMenu(null);
                  } else {
                    toast.error(response.data.errors?.[0] || t('chat.failedToKick') || 'Failed to kick user');
                  }
                } catch (error: any) {
                  toast.error(error.response?.data?.errors?.[0] || t('chat.failedToKick') || 'Failed to kick user');
                }
              }}
            />
          )
        }

        {/* Report Dialog */}
        {
          showReportDialog && userToReport && (
            <ReportUserDialog
              userId={userToReport.userId}
              username={userToReport.username}
              contentId={roomData?.background_picture ? room.id : undefined}
              contentType={roomData?.background_picture ? 'chatroom_background' : undefined}
              onClose={() => {
                setShowReportDialog(false);
                setUserToReport(null);
              }}
              includeMessageHistory={true}
              chatRoomId={room.id}
              ownerId={room.owner_id}
              ownerUsername={room.owner_username}
              moderators={roomData?.moderators ? roomData.moderators.map((modId: string) => {
                // Get moderator username from members if available
                const member = roomData.members?.find((m: any) => m.id === modId);
                return { id: modId, username: member?.username || 'Unknown' };
              }) : []}
            />
          )
        }




      </div>

      {
        tooltipState && (
          <UserTooltip
            username={tooltipState.username}
            x={tooltipState.x}
            y={tooltipState.y}
            onClose={() => setTooltipState(null)}
          />
        )
      }

      {/* User Banner Popover */}
      {
        showUserBanner && selectedUser && (
          <UserBanner
            username={selectedUser.username}
            x={selectedUser.x}
            y={selectedUser.y}
            onClose={() => {
              setShowUserBanner(false);
              setSelectedUser(null);
            }}
            onSendMessage={(userId, username) => {
              // Open private conversation
              window.dispatchEvent(new CustomEvent('openPrivateMessage', {
                detail: { userId, username }
              }));
              setShowUserBanner(false);
            }}
          />
        )
      }

      {/* Message Context Menu */}
      {
        messageContextMenu && (
          <MessageContextMenu
            messageId={messageContextMenu.messageId}
            userId={messageContextMenu.userId}
            username={messageContextMenu.username}
            x={messageContextMenu.x}
            y={messageContextMenu.y}
            onClose={() => setMessageContextMenu(null)}
            onReportMessage={(messageId, userId, username) => {
              if (userId && username) {
                handleReportUserFromMessage(messageId, userId, username);
              }
            }}
            onDeleteMessage={(messageId) => {
              const message = messages.find(m => m.id === messageId);
              if (message) {
                const isOwnerDeletion = message.user_id === user?.id;
                setMessageToDelete({ messageId, isOwnerDeletion });
                setShowDeleteDialog(true);
              }
              setMessageContextMenu(null);
            }}
            canDelete={messageContextMenu.userId === user?.id || canManage}
          />
        )
      }

      {/* Message Delete Dialog */}
      {
        showDeleteDialog && messageToDelete && (
          <MessageDeleteDialog
            isOpen={showDeleteDialog}
            onClose={() => {
              setShowDeleteDialog(false);
              setMessageToDelete(null);
            }}
            onConfirm={(reason) => handleDeleteMessage(messageToDelete.messageId, reason)}
            isOwnerDeletion={messageToDelete.isOwnerDeletion}
          />
        )
      }

      {/* Report User Dialog (from message) */}
      {
        showReportUserDialog && userToReportFromMessage && (
          <ReportUserDialog
            userId={userToReportFromMessage.userId}
            username={userToReportFromMessage.username}
            onClose={() => {
              setShowReportUserDialog(false);
              setUserToReportFromMessage(null);
            }}
            includeMessageHistory={true}
            messageId={userToReportFromMessage.messageId}
          />
        )
      }

      {/* Chat Context Menu */}
      {
        chatContextMenu && (
          <ChatRoomContextMenu
            chatId={room.id}
            chatName={room.name}
            x={chatContextMenu.x}
            y={chatContextMenu.y}
            onClose={() => setChatContextMenu(null)}
            onReport={(chatId, reportType) => {
              setReportType(reportType);
              setShowReportDialog(true);
              setChatContextMenu(null);
            }}
            onDelete={async (chatId) => {
              if (!confirm(t('chat.confirmDeleteChatroom') || `Are you sure you want to delete "${room.name}"? It will be permanently deleted in 7 days pending admin approval.`)) {
                return;
              }

              try {
                const response = await api.delete(API_ENDPOINTS.CHAT_ROOMS.DELETE(chatId));
                if (response.data.success) {
                  toast.success(response.data.message || t('chat.deletionRequested') || 'Chatroom deletion requested. It will be permanently deleted in 7 days pending admin approval.');
                  if (onBack) {
                    onBack();
                  }
                } else {
                  toast.error(response.data.errors?.[0] || t('errors.generic'));
                }
              } catch (error: any) {
                toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
              }
            }}
            hasBackground={!!roomData?.background_picture}
            hasPicture={!!roomData?.picture}
            isOwner={isOwner}
            isFollowing={isFollowing}
            onFollow={async (chatId) => {
              try {
                const response = await api.post(API_ENDPOINTS.NOTIFICATION_SETTINGS.FOLLOW_CHATROOM(chatId));
                if (response.data.success) {
                  setIsFollowing(true);
                  toast.success(t('mute.followed', { name: room.name }) || `Following ${room.name}`);
                } else {
                  toast.error(response.data.errors?.[0] || t('errors.generic'));
                }
              } catch (error: any) {
                toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
              }
            }}
            onUnfollow={async (chatId) => {
              try {
                const response = await api.post(API_ENDPOINTS.NOTIFICATION_SETTINGS.UNFOLLOW_CHATROOM(chatId));
                if (response.data.success) {
                  setIsFollowing(false);
                  toast.success(t('mute.unfollowed', { name: room.name }) || `Unfollowed ${room.name}`);
                } else {
                  toast.error(response.data.errors?.[0] || t('errors.generic'));
                }
              } catch (error: any) {
                toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
              }
            }}
          />
        )
      }

      {/* Report Chatroom Dialog */}
      {
        showReportDialog && reportType && (
          <ReportUserDialog
            contentId={room.id}
            contentType={reportType}
            userId={undefined}
            username={undefined}
            onClose={() => {
              setShowReportDialog(false);
              setReportType(null);
            }}
            ownerId={room.owner_id}
            ownerUsername={room.owner_username}
            moderators={roomData?.moderators ? roomData.moderators.map((modId: string) => {
              const member = roomData.members?.find((m: any) => m.id === modId);
              return { id: modId, username: member?.username || 'Unknown' };
            }) : []}
            topicId={room.topic_id}
          />
        )
      }

      {/* Members Modal */}
      {
        showMembersModal && (
          <ChatRoomMembersModal
            isOpen={showMembersModal}
            onClose={() => setShowMembersModal(false)}
            roomId={room.id}
            ownerId={room.owner_id}
            isOwner={isOwner}
            isPublic={room.is_public}
            mode={membersModalMode}
            onMemberUpdate={() => {
              // Reload room data if needed
            }}
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
    </div >
  );
};

export default ChatRoomContainer;

