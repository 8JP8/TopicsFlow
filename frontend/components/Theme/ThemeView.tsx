import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { translate } from '@/utils/translations';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import PostList from '../Post/PostList';
import PostCreate from '../Post/PostCreate';
import ChatRoomList from '../ChatRoom/ChatRoomList';
import ChatRoomContainer from '../ChatRoom/ChatRoomContainer';
import LoadingSpinner from '../UI/LoadingSpinner';
import Link from 'next/link';

interface Theme {
  id: string;
  title: string;
  description: string;
  tags: string[];
  topic_id?: string; // Add topic_id for compatibility with new structure
  member_count: number;
  post_count?: number;
  owner: {
    id: string;
    username: string;
  };
  user_permission_level?: number;
  settings: {
    allow_anonymous: boolean;
    require_approval: boolean;
  };
}

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  theme_id: string;
  owner_id: string;
  owner_username?: string;
  member_count: number;
  message_count: number;
  is_public: boolean;
}

interface ThemeViewProps {
  themeId: string;
}

const ThemeView: React.FC<ThemeViewProps> = ({ themeId }) => {
  const { t } = useLanguage();
  const [theme, setTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'chat'>('posts');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedChatRoom, setSelectedChatRoom] = useState<ChatRoom | null>(null);

  useEffect(() => {
    loadTheme();
  }, [themeId]);

  const loadTheme = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.THEMES.GET(themeId));

      if (response.data.success) {
        setTheme(response.data.data);
      } else {
        toast.error(response.data.errors?.[0] || translate('themes.failedToCreateTheme'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || translate('themes.failedToCreateTheme');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = () => {
    setShowCreatePost(false);
    // PostList will refresh automatically
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>{t('themes.noThemes')}</p>
      </div>
    );
  }

  if (selectedChatRoom) {
    return (
      <ChatRoomContainer
        room={selectedChatRoom}
        themeId={themeId}
        onBack={() => setSelectedChatRoom(null)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Theme Header */}
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {theme.title}
            </h1>
            {theme.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                {theme.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>{theme.member_count} {t('themes.members')}</span>
              {theme.post_count !== undefined && (
                <span>{theme.post_count} {t('themes.posts')}</span>
              )}
            </div>
            {theme.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {theme.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('posts')}
            className={`
              px-4 py-2 font-medium text-sm transition-colors
              ${activeTab === 'posts'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }
            `}
          >
            {t('themes.posts')}
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`
              px-4 py-2 font-medium text-sm transition-colors
              ${activeTab === 'chat'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }
            `}
          >
            {t('themes.chatRooms')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'posts' ? (
          <div className="space-y-6">
            {/* Create Post Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('posts.title')}
              </h2>
              <button
                onClick={() => setShowCreatePost(!showCreatePost)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                {showCreatePost ? t('common.cancel') : t('posts.createPost')}
              </button>
            </div>

            {/* Create Post Form */}
            {showCreatePost && theme?.topic_id && (
              <PostCreate
                topicId={theme.topic_id}
                onPostCreated={handlePostCreated}
                onCancel={() => setShowCreatePost(false)}
              />
            )}

            {/* Posts List */}
            {theme?.topic_id && <PostList topicId={theme.topic_id} />}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('chatRooms.title')}
            </h2>
            <ChatRoomList
              themeId={themeId}
              onRoomSelect={setSelectedChatRoom}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeView;

