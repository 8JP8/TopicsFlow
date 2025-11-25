import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Layout from '@/components/Layout/Layout';
import TopicList from '@/components/Topic/TopicList';
import PostList from '@/components/Post/PostList';
import ChatList from '@/components/Chat/ChatList';
import TopicCreate from '@/components/Topic/TopicCreate';
import PrivateMessagesSimplified from '@/components/PrivateMessages/PrivateMessagesSimplified';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ResizableSidebar from '@/components/UI/ResizableSidebar';
import NotificationPermissionDialog from '@/components/UI/NotificationPermissionDialog';

interface Topic {
  id: string;
  title: string;
  description: string;
  tags: string[];
  member_count: number;
  post_count?: number;
  conversation_count?: number;
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
  gif_url?: string;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { socket, connected, onlineUsers } = useSocket();
  const { t } = useLanguage();
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'topics' | 'messages'>('topics');
  const [activeContentTab, setActiveContentTab] = useState<'posts' | 'chats'>('posts');
  const [sidebarHighlight, setSidebarHighlight] = useState(false);
  const [expandedPrivateMessage, setExpandedPrivateMessage] = useState<{userId: string, username: string} | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);

  // Check if notification permission dialog should be shown
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const permissionRequested = localStorage.getItem('notificationPermissionRequested');
    const hasNotificationSupport = 'Notification' in window;
    
    if (hasNotificationSupport && !permissionRequested) {
      const currentPermission = Notification.permission;
      if (currentPermission === 'default') {
        const timer = setTimeout(() => {
          setShowNotificationDialog(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  // Listen for openPrivateMessage events from context menus
  useEffect(() => {
    const handleOpenPrivateMessage = (event: CustomEvent) => {
      const { userId, username } = event.detail;
      setExpandedPrivateMessage({ userId, username });
      setActiveSidebarTab('messages');
    };

    window.addEventListener('openPrivateMessage', handleOpenPrivateMessage as EventListener);
    return () => window.removeEventListener('openPrivateMessage', handleOpenPrivateMessage as EventListener);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadTopics();
    }
  }, [user, authLoading, router]);

  const loadTopics = async () => {
    try {
      setLoading(true);
      const topicsResponse = await api.get(API_ENDPOINTS.TOPICS.LIST, {
        limit: 50,
        sort_by: 'last_activity',
      });

      if (topicsResponse.data.success) {
        const loadedTopics = topicsResponse.data.data || [];
        setTopics(loadedTopics);
        // Auto-select first topic if available
        if (loadedTopics.length > 0 && !selectedTopic) {
          setSelectedTopic(loadedTopics[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load topics:', error);
      setTopics([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSelect = (topic: Topic) => {
    setSelectedTopic(topic);
    setActiveContentTab('posts'); // Default to posts tab
  };

  const handleTopicCreated = (newTopic: Topic) => {
    setTopics(prev => [newTopic, ...prev]);
    setShowCreateTopic(false);
    setSelectedTopic(newTopic);
    setActiveContentTab('posts');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <>
    <Layout>
      <div className="flex h-full">
        {/* Sidebar */}
        <ResizableSidebar
          defaultWidth={400}
          minWidth={250}
          maxWidth={600}
        >
          <div 
            ref={sidebarRef}
            className={`h-full border-r theme-border flex flex-col transition-all duration-500 ${
              sidebarHighlight ? 'ring-4 ring-blue-500 ring-opacity-50 shadow-lg' : ''
            }`}
          >
          {/* Header */}
          <div className="p-4 border-b theme-border">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold theme-text-primary">TopicsFlow</h1>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm theme-text-secondary">
                    {onlineUsers} {t('home.online')}
                  </span>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 p-1 theme-bg-secondary rounded-lg">
              <button
                onClick={() => setActiveSidebarTab('topics')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeSidebarTab === 'topics'
                    ? 'theme-bg-primary theme-text-primary shadow-sm'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                {t('topics.title') || 'Topics'}
              </button>
              <button
                onClick={() => setActiveSidebarTab('messages')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeSidebarTab === 'messages'
                    ? 'theme-bg-primary theme-text-primary shadow-sm'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                {t('home.messages')}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeSidebarTab === 'topics' && (
              <div className="h-full flex flex-col">
                {showCreateTopic ? (
                  <div className="p-4 overflow-y-auto">
                    <TopicCreate
                      onTopicCreated={handleTopicCreated}
                      onCancel={() => setShowCreateTopic(false)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="p-4">
                      <button
                        onClick={() => setShowCreateTopic(true)}
                        className="w-full btn btn-primary"
                      >
                        {t('topics.createTopic') || 'Criar Tópico'}
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <TopicList
                        topics={topics}
                        loading={loading}
                        onTopicSelect={handleTopicSelect}
                        onRefresh={loadTopics}
                        selectedTopicId={selectedTopic?.id}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeSidebarTab === 'messages' && (
              <div className="h-full">
                <PrivateMessagesSimplified 
                  onExpandMessage={(userId, username) => {
                    setExpandedPrivateMessage({userId, username});
                    setActiveSidebarTab('messages');
                  }}
                  expandedMessage={expandedPrivateMessage}
                />
              </div>
            )}
          </div>
          </div>
        </ResizableSidebar>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {expandedPrivateMessage ? (
            <PrivateMessagesSimplified 
              expandedMessage={expandedPrivateMessage}
              onCloseExpanded={() => {
                setExpandedPrivateMessage(null);
                setActiveSidebarTab('messages');
              }}
              isExpanded={true}
            />
          ) : selectedTopic ? (
            <div className="h-full flex flex-col">
              {/* Topic Header */}
              <div className="p-4 border-b theme-border">
                <h2 className="text-2xl font-bold theme-text-primary mb-2">{selectedTopic.title}</h2>
                <p className="theme-text-secondary text-sm mb-4">{selectedTopic.description}</p>
                
                {/* Tabs: Posts / Chats */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => setActiveContentTab('posts')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeContentTab === 'posts'
                        ? 'theme-bg-primary theme-text-primary shadow-sm'
                        : 'theme-text-secondary hover:theme-text-primary'
                    }`}
                  >
                    {t('posts.title') || 'Posts'}
                  </button>
                  <button
                    onClick={() => setActiveContentTab('chats')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeContentTab === 'chats'
                        ? 'theme-bg-primary theme-text-primary shadow-sm'
                        : 'theme-text-secondary hover:theme-text-primary'
                    }`}
                  >
                    {t('chats.title') || 'Chats'}
                  </button>
                </div>
              </div>

              {/* Content based on active tab */}
              <div className="flex-1 overflow-hidden">
                {activeContentTab === 'posts' && (
                  <PostList topicId={selectedTopic.id} />
                )}
                {activeContentTab === 'chats' && (
                  <ChatList topicId={selectedTopic.id} />
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center theme-bg-primary">
              <div className="text-center">
                <div className="mb-4">
                  <div className="w-24 h-24 mx-auto theme-bg-secondary rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold theme-text-primary mb-2">
                  {t('home.title')}
                </h2>
                <p className="theme-text-secondary mb-6 max-w-md">
                  {t('home.subtitle')}
                </p>
                <p className="theme-text-muted text-sm">
                  {t('topics.selectTopic') || 'Selecione um tópico da lista para começar'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>

    {/* Notification Permission Dialog */}
    {showNotificationDialog && (
      <NotificationPermissionDialog
        onClose={() => setShowNotificationDialog(false)}
      />
    )}
    </>
  );
}
