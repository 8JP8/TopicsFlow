import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '../UI/LoadingSpinner';
import toast from 'react-hot-toast';
import useEscapeKey from '@/hooks/useEscapeKey';

interface HiddenPrivateMessage {
  id: string;
  other_user_id?: string;
  other_username?: string;
  content: string;
  created_at?: string;
}

interface HiddenItems {
  topics: string[];
  posts: string[];
  chats: string[];
  private_messages?: HiddenPrivateMessage[];
}

interface HiddenItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HiddenItemsModal: React.FC<HiddenItemsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  useEscapeKey(() => {
    if (isOpen) onClose();
  });
  const [hiddenItems, setHiddenItems] = useState<HiddenItems>({ topics: [], posts: [], chats: [], private_messages: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHiddenItems();
    }
  }, [isOpen]);

  const loadHiddenItems = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.CONTENT_SETTINGS.HIDDEN_ITEMS);
      if (response.data.success) {
        setHiddenItems(response.data.data || { topics: [], posts: [], chats: [], private_messages: [] });
      }
    } catch (error) {
      console.error('Failed to load hidden items:', error);
      toast.error(t('errors.generic') || 'Failed to load hidden items');
    } finally {
      setLoading(false);
    }
  };

  const handleUnhideItem = async (type: 'topic' | 'post' | 'chat' | 'private_message', id: string) => {
    try {
      let endpoint = '';
      if (type === 'topic') {
        endpoint = API_ENDPOINTS.TOPICS.UNHIDE(id);
      } else if (type === 'post') {
        endpoint = API_ENDPOINTS.POSTS.UNHIDE(id);
      } else if (type === 'private_message') {
        endpoint = API_ENDPOINTS.USERS.RESTORE_MESSAGE_FOR_ME(id);
      }

      if (endpoint) {
        const response = await api.post(endpoint);
        if (response.data.success) {
          toast.success(t('settings.itemUnhidden') || 'Item unhidden');
          loadHiddenItems();
        } else {
          toast.error(response.data.errors?.[0] || t('errors.generic'));
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
  };

  if (!isOpen) return null;

  const totalItems = hiddenItems.topics.length + hiddenItems.posts.length + hiddenItems.chats.length + (hiddenItems.private_messages?.length || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold theme-text-primary">{t('settings.hiddenItems') || 'Hidden Items'}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm theme-text-secondary mt-2">{t('settings.hiddenItemsDesc') || 'Manage topics, posts, and chats you have hidden'}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : totalItems === 0 ? (
            <div className="text-center py-8">
              <p className="theme-text-secondary">{t('settings.noHiddenItems') || 'No hidden items'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Hidden Private Messages */}
              {hiddenItems.private_messages && hiddenItems.private_messages.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold theme-text-primary mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                    {t('settings.hiddenPrivateMessages') || 'Hidden Private Messages'} ({hiddenItems.private_messages.length})
                  </h3>
                  <div className="space-y-2">
                    {hiddenItems.private_messages.map(msg => (
                      <div
                        key={msg.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex-1">
                          <div className="theme-text-primary text-sm font-medium">
                            {msg.other_username ? `With ${msg.other_username}` : 'Private Message'}
                          </div>
                          <div className="theme-text-secondary text-xs mt-1 truncate max-w-md">
                            {msg.content}
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnhideItem('private_message', msg.id)}
                          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors ml-4"
                        >
                          {t('settings.restore') || 'Restore'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hidden Publications */}
              {hiddenItems.posts.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold theme-text-primary mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                    {t('settings.hiddenPublications') || 'Hidden Publications'} ({hiddenItems.posts.length})
                  </h3>
                  <div className="space-y-2">
                    {hiddenItems.posts.map(postId => (
                      <div
                        key={postId}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <span className="theme-text-primary font-mono text-sm">Post: {postId}</span>
                        <button
                          onClick={() => handleUnhideItem('post', postId)}
                          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                          {t('settings.unhide') || 'Unhide'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hidden Chatrooms */}
              {hiddenItems.chats.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold theme-text-primary mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                    {t('settings.hiddenChatrooms') || 'Hidden Chatrooms'} ({hiddenItems.chats.length})
                  </h3>
                  <div className="space-y-2">
                    {hiddenItems.chats.map(chatId => (
                      <div
                        key={chatId}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <span className="theme-text-primary font-mono text-sm">Chat: {chatId}</span>
                        <button
                          onClick={() => handleUnhideItem('chat', chatId)}
                          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                          {t('settings.unhide') || 'Unhide'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hidden Topics */}
              {hiddenItems.topics.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold theme-text-primary mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                    {t('settings.hiddenTopics') || 'Hidden Topics'} ({hiddenItems.topics.length})
                  </h3>
                  <div className="space-y-2">
                    {hiddenItems.topics.map(topicId => (
                      <div
                        key={topicId}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <span className="theme-text-primary font-mono text-sm">Topic: {topicId}</span>
                        <button
                          onClick={() => handleUnhideItem('topic', topicId)}
                          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                          {t('settings.unhide') || 'Unhide'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HiddenItemsModal;

