import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '../UI/LoadingSpinner';
import toast from 'react-hot-toast';
import useEscapeKey from '@/hooks/useEscapeKey';

interface HiddenItemMetadata {
  id: string;
  title?: string;
  description?: string;
  content?: string;
  content_snippet?: string;
  author_username?: string;
  owner_username?: string;
  target_username?: string;
  topic_title?: string;
  chat_room_title?: string;
  created_at?: string;
  is_group_chat?: boolean;
  type?: 'topic' | 'group';
}

interface HiddenItems {
  hidden_topics: HiddenItemMetadata[];
  hidden_posts: HiddenItemMetadata[];
  hidden_chats: HiddenItemMetadata[];
  hidden_comments: HiddenItemMetadata[];
  hidden_chat_messages: HiddenItemMetadata[];
  hidden_private_messages: HiddenItemMetadata[];
}

interface HiddenItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MainTab = 'messages' | 'comments' | 'publications' | 'chatrooms' | 'groups';
type MessageSubTab = 'private' | 'group' | 'topic';

const HiddenItemsModal: React.FC<HiddenItemsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  useEscapeKey(() => {
    if (isOpen) onClose();
  });

  const [hiddenItems, setHiddenItems] = useState<HiddenItems>({
    hidden_topics: [],
    hidden_posts: [],
    hidden_chats: [],
    hidden_comments: [],
    hidden_chat_messages: [],
    hidden_private_messages: []
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('messages');
  const [messageSubTab, setMessageSubTab] = useState<MessageSubTab>('private');

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
        setHiddenItems(response.data.data || {
          hidden_topics: [],
          hidden_posts: [],
          hidden_chats: [],
          hidden_comments: [],
          hidden_chat_messages: [],
          hidden_private_messages: []
        });
      }
    } catch (error) {
      console.error('Failed to load hidden items:', error);
      toast.error(t('errors.generic') || 'Failed to load hidden items');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (type: string, id: string) => {
    try {
      let endpoint = '';
      if (type === 'topic') endpoint = API_ENDPOINTS.TOPICS.UNHIDE(id);
      else if (type === 'post') endpoint = API_ENDPOINTS.POSTS.UNHIDE(id);
      else if (type === 'comment') endpoint = `/api/content-settings/comments/${id}/unhide`;
      else if (type === 'chat_message') endpoint = `/api/content-settings/chat-messages/${id}/unhide`;
      else if (type === 'private_message') endpoint = API_ENDPOINTS.USERS.RESTORE_MESSAGE_FOR_ME(id);
      else if (type === 'chat') endpoint = `/api/content-settings/chats/${id}/unhide`;
      else if (type === 'topic') endpoint = API_ENDPOINTS.TOPICS.UNHIDE(id);

      if (endpoint) {
        const response = await api.post(endpoint);
        if (response.data.success) {
          toast.success(t('settings.itemRestored') || 'Item restored');
          loadHiddenItems();
        } else {
          toast.error(response.data.errors?.[0] || t('errors.generic'));
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
  };

  const handlePermanentDelete = async (type: string, id: string) => {
    if (!window.confirm(t('settings.confirmPermanentDelete') || 'Are you sure you want to permanently delete this item? This action cannot be undone.')) {
      return;
    }

    try {
      let endpoint = '';
      if (type === 'private_message') endpoint = `${API_ENDPOINTS.MESSAGES.DELETE_PRIVATE(id)}?mode=hard`;
      else if (type === 'chat_message' || type === 'topic_message') endpoint = `/api/messages/${id}?mode=hard`;
      else if (type === 'comment') endpoint = `/api/comments/${id}?mode=hard`;
      else if (type === 'post') endpoint = `/api/posts/${id}?mode=hard`;

      if (endpoint) {
        const response = await api.delete(endpoint);
        if (response.data.success) {
          toast.success(t('settings.itemPermanentlyDeleted') || 'Item permanently deleted');
          loadHiddenItems();
        } else {
          toast.error(response.data.errors?.[0] || t('errors.generic'));
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
  };

  const filteredItems = useMemo(() => {
    if (!hiddenItems) return [];

    if (activeTab === 'messages') {
      if (messageSubTab === 'private') return hiddenItems.hidden_private_messages || [];
      if (messageSubTab === 'group') return (hiddenItems.hidden_chat_messages || []).filter(m => m.type === 'group');
      if (messageSubTab === 'topic') return (hiddenItems.hidden_chat_messages || []).filter(m => m.type === 'topic');
    }
    if (activeTab === 'comments') return hiddenItems.hidden_comments || [];
    if (activeTab === 'publications') return hiddenItems.hidden_posts || [];
    if (activeTab === 'chatrooms') return (hiddenItems.hidden_chats || []).filter(c => !c.is_group_chat);
    if (activeTab === 'groups') return (hiddenItems.hidden_chats || []).filter(c => c.is_group_chat);
    return [];
  }, [activeTab, messageSubTab, hiddenItems]);

  const tabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: 'messages', label: t('settings.messages') || 'Messages', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> },
    { id: 'comments', label: t('settings.comments') || 'Comments', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg> },
    { id: 'publications', label: t('settings.publications') || 'Publications', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg> },
    { id: 'chatrooms', label: t('settings.chatrooms') || 'Chatrooms', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { id: 'groups', label: t('settings.groups') || 'Groups', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
  ];

  const subTabs: { id: MessageSubTab; label: string }[] = [
    { id: 'private', label: t('settings.private') || 'Private' },
    { id: 'group', label: t('settings.group') || 'Group' },
    { id: 'topic', label: t('settings.topic') || 'Topic' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold theme-text-primary flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              {t('settings.hiddenItems') || 'Hidden Items'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm theme-text-secondary">{t('settings.hiddenItemsDesc') || 'Manage content you have hidden for yourself'}</p>
        </div>

        {/* Categories Tabs */}
        <div className="px-6 pt-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex relative w-full overflow-x-auto no-scrollbar">
            <div
              className="absolute bottom-0 h-0.5 bg-blue-500 transition-all duration-300 ease-out z-10"
              style={{
                width: `${100 / tabs.length}%`,
                left: `${(tabs.findIndex(t => t.id === activeTab) * 100) / tabs.length}%`
              }}
            />
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 text-sm font-semibold transition-colors duration-200 text-center flex items-center justify-center gap-2 whitespace-nowrap min-w-[100px] ${activeTab === tab.id ? 'theme-text-primary' : 'theme-text-secondary hover:theme-text-primary'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Sub-Tabs */}
        {activeTab === 'messages' && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 flex gap-2 overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-gray-800">
            {subTabs.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setMessageSubTab(sub.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${messageSubTab === sub.id ? 'bg-blue-600 text-white shadow-sm' : 'theme-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-900/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <LoadingSpinner />
              <p className="text-sm theme-text-secondary animate-pulse">{t('common.loading') || 'Loading...'}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium theme-text-primary">{t('settings.allClear') || 'All clear!'}</p>
              <p className="text-sm theme-text-secondary mt-1">{t('settings.noHiddenItemsByType') || 'No hidden items found in this category'}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex items-start justify-between"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        {item.author_username || item.owner_username || item.target_username || (activeTab === 'chatrooms' ? 'Topic' : activeTab === 'groups' ? 'Group' : 'Item')}
                      </span>
                      {item.created_at && (
                        <span className="text-[10px] text-gray-400">
                          • {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {item.title && (
                      <h4 className="text-sm font-semibold theme-text-primary mb-1 line-clamp-1">{item.title}</h4>
                    )}
                    <p className="text-sm theme-text-secondary line-clamp-2 italic">
                      "{item.content_snippet || item.content || item.description || (t('settings.noContent') || 'No content')}"
                    </p>
                    {(item.topic_title || item.chat_room_title) && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-medium theme-text-secondary">
                          {item.topic_title || item.chat_room_title}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleRestore(
                        activeTab === 'messages' ? (messageSubTab === 'private' ? 'private_message' : 'chat_message') :
                          activeTab === 'comments' ? 'comment' :
                            activeTab === 'publications' ? 'post' :
                              (activeTab === 'chatrooms' || activeTab === 'groups') ? 'chat' : 'topic',
                        item.id
                      )}
                      className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 rounded-lg font-semibold transition-all border border-blue-200 dark:border-blue-800"
                    >
                      {t('settings.restore') || 'Restore'}
                    </button>
                    {(activeTab === 'messages' || activeTab === 'comments' || activeTab === 'publications') && (
                      <button
                        onClick={() => handlePermanentDelete(
                          activeTab === 'messages' ? (messageSubTab === 'private' ? 'private_message' : 'chat_message') :
                            activeTab === 'comments' ? 'comment' :
                              'post',
                          item.id
                        )}
                        className="px-3 py-1.5 text-xs text-red-500 hover:theme-text-error-hover bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg font-semibold transition-all"
                      >
                        {t('settings.delete') || 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HiddenItemsModal;

