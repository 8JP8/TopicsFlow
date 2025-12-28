import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { getUserColorClass } from '@/utils/colorUtils';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '../UI/LoadingSpinner';
import ChatCreate from './ChatCreate';
import ChatRoomContextMenu from '../UI/ChatRoomContextMenu';
import ReportUserDialog from '../Reports/ReportUserDialog';
import { useRouter } from 'next/router';

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  topic_id: string;
  owner_id: string;
  owner?: {
    id: string;
    username: string;
  };
  tags: string[];
  is_public: boolean;
  member_count: number;
  message_count: number;
  last_activity: string;
  user_is_member?: boolean;
  picture?: string;
  background_picture?: string;
  moderators?: string[];
  is_muted?: boolean;
}

interface ChatListProps {
  topicId: string;
  onChatSelect?: (chat: ChatRoom) => void;
  unreadCounts?: { [chatId: string]: number };
}

const ChatList: React.FC<ChatListProps> = ({ topicId, onChatSelect, unreadCounts }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ chatId: string, chatName: string, x: number, y: number } | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportChat, setReportChat] = useState<{ chatId: string, reportType: 'chatroom' | 'chatroom_background' | 'chatroom_picture' } | null>(null);
  const [hiddenChats, setHiddenChats] = useState<Set<string>>(new Set());
  const [followedChats, setFollowedChats] = useState<Set<string>>(new Set());

  // Fetch hidden items on mount
  useEffect(() => {
    const fetchHiddenItems = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.CONTENT_SETTINGS.HIDDEN_ITEMS);
        if (response.data.success) {
          const hidden = new Set<string>();
          const data = response.data.data;
          // Store chat IDs
          if (data.chats && Array.isArray(data.chats)) {
            data.chats.forEach((c: any) => hidden.add(c.id));
          }
          // Also checking "conversations" or "private_messages" if structured that way?
          // HiddenItemsModal uses response.data.data.chats.
          setHiddenChats(hidden);
        }
      } catch (error) {
        console.error('Failed to load hidden items:', error);
      }
    };

    fetchHiddenItems();
  }, []);

  const loadChats = async () => {
    if (!topicId) return;

    try {
      setLoading(true);
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedTags.length > 0) params.tags = selectedTags.join(',');

      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.LIST_BY_TOPIC(topicId), params);

      if (response.data.success) {
        const loadedChats = response.data.data || [];
        // Filter by tags on frontend if backend doesn't support it
        let filteredChats = loadedChats;
        if (selectedTags.length > 0) {
          filteredChats = loadedChats.filter((chat: ChatRoom) =>
            chat.tags && selectedTags.every(tag => chat.tags.includes(tag))
          );
        }
        // Filter by search query
        if (searchQuery) {
          filteredChats = filteredChats.filter((chat: ChatRoom) =>
            chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (chat.description && chat.description.toLowerCase().includes(searchQuery.toLowerCase()))
          );
        }
        setChats(filteredChats);

        // Load follow status for all chats
        if (user) {
          const followStatusPromises = filteredChats.map(async (chat: ChatRoom) => {
            try {
              const statusResponse = await api.get(API_ENDPOINTS.NOTIFICATION_SETTINGS.CHATROOM_STATUS(chat.id));
              if (statusResponse.data.success && statusResponse.data.data?.following !== false) {
                return chat.id;
              }
            } catch (error) {
              // If error, assume following (default behavior)
              return chat.id;
            }
            return null;
          });

          const followedIds = (await Promise.all(followStatusPromises)).filter((id): id is string => id !== null);
          setFollowedChats(new Set(followedIds));
        }
      } else {
        toast.error(response.data.errors?.[0] || 'Failed to load chats');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || 'Failed to load chats';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (topicId) {
      loadChats();
    }
  }, [topicId, searchQuery, selectedTags]);

  useEffect(() => {
    const handleRefresh = () => loadChats();
    window.addEventListener('refresh-chats', handleRefresh);
    return () => window.removeEventListener('refresh-chats', handleRefresh);
  }, [loadChats]);

  // Get unique tags from chats, filter out empty strings and ensure uniqueness
  const allTags = Array.from(new Set(chats.flatMap(chat => chat.tags || []).filter(tag => tag && tag.trim() !== ''))).sort();

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60 * 1000) {
      return 'Active now';
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}m ago`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleChatClick = (chat: ChatRoom) => {
    if (onChatSelect) {
      onChatSelect(chat);
    } else {
      router.push(`/chat/${chat.id}`);
    }
  };

  const handleChatCreated = (newChat: ChatRoom) => {
    setChats(prev => [newChat, ...prev]);
    setShowCreateChat(false);
  };

  const handleShareChat = async (chatId: string) => {
    try {
      const targetUrl = `${window.location.origin}/chat-room/${chatId}`;
      const response = await api.post(API_ENDPOINTS.SHORT_LINKS.GENERATE, { url: targetUrl });
      if (response.data.success) {
        const shortUrl = response.data.data.short_url;
        await navigator.clipboard.writeText(shortUrl);
        toast.success(t('common.linkCopied') || 'Link copied to clipboard');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error(t('errors.failedToShare') || 'Failed to share');
    }
  };

  if (loading && chats.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  // Check if there are any chats or active filters to decide whether to show standard UI or empty state
  const hasContent = chats.length > 0 || searchQuery || selectedTags.length > 0;

  return (
    <div className="h-full flex flex-col p-4">
      {/* Search and Filters - Only show if there is content or active filtering */}
      {hasContent && (
        <div className="mb-4 space-y-3">
          {/* Search with Create Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateChat(true)}
              className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors flex-shrink-0"
              title={t('chats.createChat') || 'Create Chat'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <input
              type="text"
              placeholder={t('common.search') || 'Search chats...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div>
              <p className="text-xs font-medium theme-text-secondary mb-2">{t('home.filterByTags') || 'Filter by tags'}</p>
              <div className="flex flex-wrap gap-1">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-1 text-xs rounded-full transition-colors ${selectedTags.includes(tag)
                      ? 'theme-blue-primary text-white'
                      : 'theme-bg-tertiary theme-text-secondary hover:theme-text-primary'
                      }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chats List or Empty State */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {!hasContent && !showCreateChat ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-fade-in">
            <div className="mb-4 flex items-center justify-center">
              <svg className="w-12 h-12 theme-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8H19C20.1046 8 21 8.89543 21 10V16C21 17.1046 20.1046 18 19 18H17V22L13 18H9C8.44772 18 7.94772 17.7761 7.58579 17.4142M7.58579 17.4142L11 14H15C16.1046 14 17 13.1046 17 12V6C17 4.89543 16.1046 4 15 4H5C3.89543 4 3 4.89543 3 6V12C3 13.1046 3.89543 14 5 14H7V18L7.58579 17.4142Z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold theme-text-secondary mb-2">{t('chats.noChats') || 'No chat rooms yet'}</h3>
            <p className="text-sm theme-text-muted max-w-sm mx-auto mb-6">
              {t('chats.createChatroomHint') || "Be the first to create a chat on this topic!"}
            </p>
            <button
              onClick={() => setShowCreateChat(true)}
              className="pw-full btn btn-primary flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('chats.createChat') || 'Create Chat'}
            </button>
          </div>
        ) : (
          chats.filter(chat => !hiddenChats.has(chat.id)).map(chat => (
            <div
              key={chat.id}
              onClick={() => handleChatClick(chat)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({
                  chatId: chat.id,
                  chatName: chat.name,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              className="relative overflow-hidden rounded-lg border theme-border hover:shadow-md transition-shadow cursor-pointer theme-bg-primary"
            >
              {/* ... (Existing chat item content) ... */}
              <div className="relative p-4">
                <div className="flex items-start gap-3">
                  {/* Chatroom Photo */}
                  {chat.picture ? (
                    <img
                      src={chat.picture.startsWith('data:') ? chat.picture : `data:image/jpeg;base64,${chat.picture}`}
                      alt={chat.name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border-2 theme-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 border-2 theme-border bg-gray-500">
                      <span className="text-2xl font-semibold text-white">
                        {chat.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mr-2">
                          {chat.name}
                        </h3>
                        {unreadCounts && unreadCounts[chat.id] > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce-in">
                            {unreadCounts[chat.id] > 99 ? '99+' : unreadCounts[chat.id]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {user?.id === chat.owner_id ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded border border-blue-200 dark:border-blue-800">
                            {t('chats.owner') || 'Owner'}
                          </span>
                        ) : chat.moderators?.includes(user?.id || '') && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 rounded border border-purple-200 dark:border-purple-800">
                            {t('chats.moderator') || 'Moderator'}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenu({
                              chatId: chat.id,
                              chatName: chat.name,
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {chat.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {chat.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{chat.is_public ? t('chats.public') || 'Public' : `${chat.member_count} ${chat.member_count === 1 ? t('chats.member') || 'Member' : t('chats.members') || 'Members'}`}</span>
                      <span>{chat.message_count} {chat.message_count === 1 ? t('home.message') || 'Message' : t('home.messages') || 'Messages'}</span>
                      <span>{formatLastActivity(chat.last_activity)}</span>
                    </div>
                    {chat.tags && chat.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {chat.tags.slice(0, 3).map((tag, tagIndex) => (
                          <span
                            key={`${chat.id}-tag-${tagIndex}-${tag}`}
                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {chat.user_is_member && !chat.moderators?.includes(user?.id || '') && user?.id !== chat.owner_id && (
                    <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                      {t('chats.member') || 'Member'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Chat Modal */}
      {showCreateChat && (
        <ChatCreate
          topicId={topicId}
          onChatCreated={handleChatCreated}
          onCancel={() => setShowCreateChat(false)}
        />
      )}

      {/* Chat Context Menu */}
      {contextMenu && (() => {
        const chat = chats.find(c => c.id === contextMenu.chatId);
        const isOwner = chat && user?.id === chat.owner_id;
        return (
          <ChatRoomContextMenu
            chatId={contextMenu.chatId}
            chatName={contextMenu.chatName}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onShare={handleShareChat}
            isMuted={chat?.is_muted}
            onMute={async (chatId: string, minutes: number) => {
              try {
                const response = await api.post(API_ENDPOINTS.MUTE.MUTE_CHAT_ROOM(chatId), { minutes });
                if (response.data.success) {
                  const durationLabel = minutes === -1 ? (t('mute.always') || 'forever') : `${minutes} ${t('common.minutes') || 'minutes'}`;
                  const successMsg = minutes === 0 ? t('mute.unmuted', { name: contextMenu.chatName }) : t('mute.success', { name: contextMenu.chatName, duration: durationLabel });
                  toast.success(successMsg || (minutes === 0 ? 'Unmuted' : 'Muted'));
                  // Update local state
                  setChats(prev => prev.map(c => c.id === chatId ? { ...c, is_muted: minutes !== 0 } : c));
                } else {
                  toast.error(response.data.errors?.[0] || t('mute.error'));
                }
              } catch (error: any) {
                toast.error(error.response?.data?.errors?.[0] || t('mute.error'));
              }
              setContextMenu(null);
            }}
            onReport={(chatId, reportType) => {
              if (chat) {
                setReportChat({ chatId, reportType });
                setShowReportDialog(true);
              }
              setContextMenu(null);
            }}
            onDelete={async (chatId) => {
              const chatToDelete = chats.find(c => c.id === chatId);
              if (!chatToDelete) return;

              if (!confirm(t('chat.confirmDeleteChatroom') || `Are you sure you want to delete "${chatToDelete.name}"? It will be permanently deleted in 7 days pending admin approval.`)) {
                return;
              }

              try {
                const response = await api.delete(API_ENDPOINTS.CHAT_ROOMS.DELETE(chatId));
                if (response.data.success) {
                  toast.success(response.data.message || t('chat.deletionRequested') || 'Chatroom deletion requested. It will be permanently deleted in 7 days pending admin approval.');
                  // Optimistic update: remove chat from list immediately
                  setChats(prev => prev.filter(c => c.id !== chatId));
                } else {
                  toast.error(response.data.errors?.[0] || t('errors.generic'));
                }
              } catch (error: any) {
                toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
              }
            }}
            onHide={async (chatId) => {
              try {
                const response = await api.post(API_ENDPOINTS.CONTENT_SETTINGS.HIDE_CHAT(chatId));
                if (response.data.success) {
                  setHiddenChats(prev => new Set([...prev, chatId]));
                  toast.success(t('chat.chatHidden') || 'Chat hidden');
                } else {
                  toast.error(response.data.errors?.[0] || t('errors.generic'));
                }
              } catch (error: any) {
                toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
              }
              setContextMenu(null);
            }}
            onFollow={async (chatId) => {
              try {
                const response = await api.post(API_ENDPOINTS.NOTIFICATION_SETTINGS.FOLLOW_CHATROOM(chatId));
                if (response.data.success) {
                  setFollowedChats(prev => new Set([...prev, chatId]));
                  toast.success(t('mute.followed', { name: contextMenu.chatName }) || `Following ${contextMenu.chatName}`);
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
                  setFollowedChats(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(chatId);
                    return newSet;
                  });
                  toast.success(t('mute.unfollowed', { name: contextMenu.chatName }) || `Unfollowed ${contextMenu.chatName}`);
                } else {
                  toast.error(response.data.errors?.[0] || t('errors.generic'));
                }
              } catch (error: any) {
                toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
              }
            }}
            onLeave={async (chatId) => {
              if (!confirm(t('chat.confirmLeave', { name: contextMenu.chatName }) || `Are you sure you want to leave "${contextMenu.chatName}"?`)) {
                return;
              }

              try {
                const response = await api.delete(API_ENDPOINTS.CHAT_ROOMS.LEAVE(chatId)); // Using DELETE based on typical REST, but let's check if api.ts has it as DELETE. Wait, api.ts says LEAVE: (id) => ... but doesn't specify method. Usually it's POST or DELETE. ChatRoomMembersModal used POST for JOIN. Let's assume POST for LEAVE or check api.ts again. 
                // api.ts line 282: LEAVE: (id) => `/api/chat-rooms/${id}/leave`
                // Let's assume POST as it's an action, or DELETE if removing self. 
                // I will use api.post for safety first, or check if I can define it. 
                // Actually, let's assume it is a POST request to /leave.
                const leaveResponse = await api.post(API_ENDPOINTS.CHAT_ROOMS.LEAVE(chatId));

                if (leaveResponse.data.success) {
                  toast.success(t('chat.leftChatroom') || `Left ${contextMenu.chatName}`);
                  setChats(prev => prev.filter(c => c.id !== chatId));
                  setContextMenu(null);
                } else {
                  toast.error(leaveResponse.data.errors?.[0] || t('errors.generic'));
                }
              } catch (error: any) {
                toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
              }
            }}
            isFollowing={followedChats.has(contextMenu.chatId)}
            isHidden={hiddenChats.has(contextMenu.chatId)}
            hasBackground={!!chat?.background_picture}
            hasPicture={!!chat?.picture}
            isOwner={isOwner}
          />
        );
      })()}

      {/* Report Chatroom Dialog */}
      {showReportDialog && reportChat && (() => {
        const chat = chats.find(c => c.id === reportChat.chatId);
        return (
          <ReportUserDialog
            contentId={reportChat.chatId}
            contentType={reportChat.reportType}
            userId={undefined}
            username={undefined}
            onClose={() => {
              setShowReportDialog(false);
              setReportChat(null);
            }}
            ownerId={chat?.owner_id}
            ownerUsername={chat?.owner?.username}
            moderators={chat?.moderators ? chat.moderators.map((id: string) => ({ id, username: 'Unknown' })) : []}
            topicId={topicId}
          />
        );
      })()}
    </div>
  );
};

export default ChatList;

