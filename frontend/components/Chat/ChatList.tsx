import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
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
}

interface ChatListProps {
  topicId: string;
  onChatSelect?: (chat: ChatRoom) => void;
}

const ChatList: React.FC<ChatListProps> = ({ topicId, onChatSelect }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [contextMenu, setContextMenu] = useState<{chatId: string, chatName: string, x: number, y: number} | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportChat, setReportChat] = useState<{chatId: string, reportType: 'chatroom' | 'chatroom_background' | 'chatroom_picture'} | null>(null);
  const [hiddenChats, setHiddenChats] = useState<Set<string>>(new Set());
  const [silencedChats, setSilencedChats] = useState<Set<string>>(new Set());

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

  if (loading && chats.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Search and Filters */}
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
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    selectedTags.includes(tag)
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

      {/* Chats List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {chats.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>{t('chats.noChats') || 'No chats found'}</p>
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
                    <div className="w-16 h-16 rounded-lg theme-bg-secondary flex items-center justify-center flex-shrink-0 border-2 theme-border">
                      <span className="text-2xl font-semibold theme-text-primary">
                        {chat.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {chat.name}
                    </h3>
                  {chat.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {chat.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>{chat.member_count} {t('chats.members') || 'members'}</span>
                    <span>{chat.message_count} {t('chats.messages') || 'messages'}</span>
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
                  {chat.user_is_member && (
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
                  // Refresh chat list
                  window.location.reload();
                } else {
                  toast.error(response.data.errors?.[0] || t('errors.generic'));
                }
              } catch (error: any) {
                toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
              }
            }}
            onHide={async (chatId) => {
              try {
                // TODO: Add API endpoint for hiding chats
                toast.error('Chat hiding not yet implemented');
              } catch (error: any) {
                toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
              }
              setContextMenu(null);
            }}
            isSilenced={silencedChats.has(contextMenu.chatId)}
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

