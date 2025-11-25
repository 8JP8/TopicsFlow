import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '../UI/LoadingSpinner';
import ChatCreate from './ChatCreate';
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
}

interface ChatListProps {
  topicId: string;
  onChatSelect?: (chat: ChatRoom) => void;
}

const ChatList: React.FC<ChatListProps> = ({ topicId, onChatSelect }) => {
  const { t } = useLanguage();
  const router = useRouter();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCreateChat, setShowCreateChat] = useState(false);

  const loadChats = async () => {
    if (!topicId) return;

    try {
      setLoading(true);
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedTags.length > 0) params.tags = selectedTags;

      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.LIST_BY_TOPIC(topicId), params);

      if (response.data.success) {
        setChats(response.data.data || []);
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

  // Get unique tags from chats
  const allTags = Array.from(new Set(chats.flatMap(chat => chat.tags))).sort();

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
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder={t('common.search') || 'Search chats...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tags Filter */}
        {allTags.length > 0 && (
          <div>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create Chat Button */}
        <button
          onClick={() => setShowCreateChat(true)}
          className="w-full btn btn-primary"
        >
          {t('chats.createChat') || 'Criar Chat'}
        </button>
      </div>

      {/* Chats List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {chats.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>{t('chats.noChats') || 'No chats found'}</p>
          </div>
        ) : (
          chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => handleChatClick(chat)}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
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
                  {chat.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {chat.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
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
    </div>
  );
};

export default ChatList;

