import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Layout from '@/components/Layout/Layout';
import TopicList from '@/components/Topic/TopicList';
import PostList from '@/components/Post/PostList';
import PostCard from '@/components/Post/PostCard';
import PostDetailContainer from '@/components/Post/PostDetailContainer';
import ChatList from '@/components/Chat/ChatList';
import ChatRoomContainer from '@/components/ChatRoom/ChatRoomContainer';
import TopicCreate from '@/components/Topic/TopicCreate';
import PrivateMessagesSimplified from '@/components/PrivateMessages/PrivateMessagesSimplified';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ResizableSidebar from '@/components/UI/ResizableSidebar';
import NotificationPermissionDialog from '@/components/UI/NotificationPermissionDialog';
import AnonymousModeDialog from '@/components/UI/AnonymousModeDialog';
import { getAnonymousModeState, saveAnonymousModeState, getLastAnonymousName } from '@/utils/anonymousStorage';

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

// Message interface removed - not used in this file

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { socket, connected, onlineUsers } = useSocket();
  const { t } = useLanguage();
  const router = useRouter();
  interface Post {
    id: string;
    title: string;
    content: string;
    topic_id: string;
    user_id: string;
    author_username?: string;
    display_name?: string;
    is_anonymous?: boolean;
    upvote_count: number;
    downvote_count?: number;
    score?: number;
    comment_count: number;
    user_has_upvoted?: boolean;
    user_has_downvoted?: boolean;
    created_at: string;
    gif_url?: string;
  }

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
    background_picture?: string;
  }

  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [topicPosts, setTopicPosts] = useState<Post[]>([]); // Store posts for navigation
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'topics' | 'messages'>('topics');
  const [activeContentTab, setActiveContentTab] = useState<'posts' | 'chats'>('posts');
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [sidebarHighlight, setSidebarHighlight] = useState(false);
  const [expandedPrivateMessage, setExpandedPrivateMessage] = useState<{userId: string, username: string} | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);

  // Badge counts for unread items
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadPostsCount, setUnreadPostsCount] = useState(0);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  // Track unread messages per topic
  const [unreadTopicMessages, setUnreadTopicMessages] = useState<{[topicId: string]: number}>({});

  // Anonymous mode state
  const [showAnonymousModeDialog, setShowAnonymousModeDialog] = useState(false);
  const [topicAnonymousMode, setTopicAnonymousMode] = useState<{[topicId: string]: {isAnonymous: boolean, name?: string}}>({});

  // Load anonymous mode state when topic is selected
  useEffect(() => {
    if (!selectedTopic) {
      // Clear current topic anonymous state when no topic selected
      if (typeof window !== 'undefined') {
        localStorage.removeItem('current_topic_anonymous_state');
        window.dispatchEvent(new Event('anonymousStateChanged'));
      }
      return;
    }

    const loadAnonymousState = async () => {
      const topicId = selectedTopic.id;
      const savedState = getAnonymousModeState(topicId);
      const lastName = getLastAnonymousName(topicId);

      // Try to load from API first
      try {
        const response = await api.get(API_ENDPOINTS.TOPICS.ANONYMOUS_IDENTITY(topicId));
        if (response.data.success && response.data.data?.anonymous_name) {
          const apiName = response.data.data.anonymous_name;
          setTopicAnonymousMode(prev => ({
            ...prev,
            [topicId]: { isAnonymous: true, name: apiName }
          }));
          saveAnonymousModeState(topicId, true, apiName);
          saveLastAnonymousName(topicId, apiName);
          // Store current topic anonymous state for UserMenu
          if (typeof window !== 'undefined') {
            localStorage.setItem('current_topic_anonymous_state', JSON.stringify({
              topicId,
              isAnonymous: true,
              name: apiName
            }));
            window.dispatchEvent(new Event('anonymousStateChanged'));
          }
        } else {
          // Check localStorage for saved state
          if (savedState.isAnonymous) {
            const name = savedState.name || lastName || '';
            setTopicAnonymousMode(prev => ({
              ...prev,
              [topicId]: { isAnonymous: true, name }
            }));
            if (typeof window !== 'undefined') {
              localStorage.setItem('current_topic_anonymous_state', JSON.stringify({
                topicId,
                isAnonymous: true,
                name
              }));
            }
          } else {
            setTopicAnonymousMode(prev => ({
              ...prev,
              [topicId]: { isAnonymous: false, name: lastName || undefined }
            }));
            if (typeof window !== 'undefined') {
              localStorage.setItem('current_topic_anonymous_state', JSON.stringify({
                topicId,
                isAnonymous: false,
                name: lastName || undefined
              }));
              window.dispatchEvent(new Event('anonymousStateChanged'));
            }
          }
        }
      } catch (error: any) {
        // API call failed (404 or other error)
        if (error.response?.status === 404 || !error.response) {
          // No identity in database, check localStorage
          if (savedState.isAnonymous) {
            const name = savedState.name || lastName || '';
            setTopicAnonymousMode(prev => ({
              ...prev,
              [topicId]: { isAnonymous: true, name }
            }));
            if (typeof window !== 'undefined') {
              localStorage.setItem('current_topic_anonymous_state', JSON.stringify({
                topicId,
                isAnonymous: true,
                name
              }));
            }
          } else {
            setTopicAnonymousMode(prev => ({
              ...prev,
              [topicId]: { isAnonymous: false, name: lastName || undefined }
            }));
            if (typeof window !== 'undefined') {
              localStorage.setItem('current_topic_anonymous_state', JSON.stringify({
                topicId,
                isAnonymous: false,
                name: lastName || undefined
              }));
              window.dispatchEvent(new Event('anonymousStateChanged'));
            }
          }
        }
      }
    };

    loadAnonymousState();
  }, [selectedTopic?.id]);

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

  // Socket listeners for badge counts
  useEffect(() => {
    if (!socket || !connected) return;

    const handleNewPrivateMessage = (_data: { userId?: string; username?: string }) => {
      // Only increment if we're not currently viewing the messages tab
      if (activeSidebarTab !== 'messages') {
        setUnreadMessagesCount(prev => prev + 1);
      }
    };

    const handleNewPost = (data: { topic_id?: string }) => {
      // Only increment if we're not currently viewing the posts tab or not viewing this topic
      if (activeContentTab !== 'posts' || selectedTopic?.id !== data.topic_id) {
        setUnreadPostsCount(prev => prev + 1);
      }
    };

    const handleNewChatMessage = (data: { topic_id?: string }) => {
      // Only increment if we're not currently viewing the chats tab or not viewing this topic
      if (activeContentTab !== 'chats' || selectedTopic?.id !== data.topic_id) {
        setUnreadChatsCount(prev => prev + 1);
        // Also track per topic
        if (data.topic_id) {
          setUnreadTopicMessages(prev => ({
            ...prev,
            [data.topic_id!]: (prev[data.topic_id!] || 0) + 1
          }));
        }
      }
    };

    const handleNewTopicMessage = (data: { topic_id?: string }) => {
      // Handle new_message events (topic messages, not chat room messages)
      if (data.topic_id) {
        const topicId = String(data.topic_id);
        // Only increment if we're not currently viewing this topic or not in chats tab
        if (activeContentTab !== 'chats' || selectedTopic?.id !== topicId) {
          setUnreadTopicMessages(prev => ({
            ...prev,
            [topicId]: (prev[topicId] || 0) + 1
          }));
        }
      }
    };

    const handleTopicUpdated = (data: { topic_id?: string; topic?: any }) => {
      // Reload topics when a topic is created or updated
      if (data.topic_id || data.topic) {
        loadTopics();
      }
    };

    socket.on('new_private_message', handleNewPrivateMessage);
    socket.on('new_post', handleNewPost);
    socket.on('new_chat_room_message', handleNewChatMessage);
    socket.on('new_message', handleNewTopicMessage);
    socket.on('topic_created', handleTopicUpdated);
    socket.on('topic_updated', handleTopicUpdated);

    return () => {
      socket.off('new_private_message', handleNewPrivateMessage);
      socket.off('new_post', handleNewPost);
      socket.off('new_chat_room_message', handleNewChatMessage);
      socket.off('new_message', handleNewTopicMessage);
      socket.off('topic_created', handleTopicUpdated);
      socket.off('topic_updated', handleTopicUpdated);
    };
  }, [socket, connected, activeSidebarTab, activeContentTab, selectedTopic?.id]);

  // Clear badge counts when switching tabs
  useEffect(() => {
    if (activeSidebarTab === 'messages') {
      setUnreadMessagesCount(0);
    }
  }, [activeSidebarTab]);

  useEffect(() => {
    if (activeContentTab === 'posts') {
      setUnreadPostsCount(0);
    } else if (activeContentTab === 'chats') {
      setUnreadChatsCount(0);
      // Clear unread count for selected topic when viewing chats
      if (selectedTopic?.id) {
        setUnreadTopicMessages(prev => {
          const updated = { ...prev };
          delete updated[selectedTopic.id];
          return updated;
        });
      }
    }
  }, [activeContentTab, selectedTopic?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadTopics();
      loadRecentPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]);

  const loadRecentPosts = async () => {
    try {
      setLoadingPosts(true);
      const response = await api.get(API_ENDPOINTS.POSTS.RECENT, {
        params: {
          limit: 20,
          offset: 0,
        },
      });

      if (response.data.success) {
        setAllPosts(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load recent posts:', error);
      setAllPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

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
    setSelectedChat(null);
    setActiveContentTab('posts'); // Default to posts tab
  };

  const handleTopicCreated = (newTopic: Topic) => {
    setTopics(prev => [newTopic, ...prev]);
    setShowCreateTopic(false);
    setSelectedTopic(newTopic);
    setSelectedChat(null);
    setSelectedPost(null);
    setActiveContentTab('posts');
  };

  const loadTopicPosts = async (topicId: string) => {
    try {
      const response = await api.get(API_ENDPOINTS.POSTS.LIST_BY_TOPIC(topicId), {
        params: {
          sort_by: 'new',
          limit: 100, // Load more posts for navigation
          offset: 0,
        },
      });

      if (response.data.success) {
        setTopicPosts(response.data.data || []);
      }
    } catch (error: unknown) {
      console.error('Failed to load topic posts:', error);
    }
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
        {/* Left Sidebar */}
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
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium theme-text-primary">
                  {connected ? (t('home.connected') || 'Connected') : (t('home.connecting') || 'Connecting...')}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-sm theme-text-secondary">
                  {onlineUsers} {t('home.online')}
                </span>
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
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                  activeSidebarTab === 'messages'
                    ? 'theme-bg-primary theme-text-primary shadow-sm'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                {t('home.messages')}
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
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
                        unreadCounts={unreadTopicMessages}
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
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold theme-text-primary mb-2">{selectedTopic.title}</h2>
                    <p className="theme-text-secondary text-sm mb-4">{selectedTopic.description}</p>
                  </div>

                  {/* Anonymous Mode Selector - Top Right */}
                  {selectedTopic.settings?.allow_anonymous && (
                    <div className="ml-4">
                      <button
                        onClick={() => setShowAnonymousModeDialog(true)}
                        className="flex items-center gap-2 px-3 py-2 theme-bg-secondary rounded-lg border theme-border hover:theme-bg-tertiary transition-colors cursor-pointer"
                        title={t('topics.configureAnonymousMode') || 'Configurar Modo Anónimo'}
                      >
                        <svg className="w-4 h-4 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-xs theme-text-primary font-medium whitespace-nowrap">
                          {topicAnonymousMode[selectedTopic.id]?.isAnonymous
                            ? `${t('topics.anonymousMode') || 'Modo Anónimo'}: ${topicAnonymousMode[selectedTopic.id]?.name}`
                            : t('topics.anonymousMode') || 'Modo Anónimo'
                          }
                        </span>
                        {topicAnonymousMode[selectedTopic.id]?.isAnonymous && (
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Tabs: Posts / Chats */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => {
                      setActiveContentTab('posts');
                      setSelectedPost(null); // Go back to list if a post is open
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
                      activeContentTab === 'posts'
                        ? 'theme-bg-primary theme-text-primary shadow-sm'
                        : 'theme-text-secondary hover:theme-text-primary'
                    }`}
                  >
                    {t('posts.title') || 'Posts'}
                    {unreadPostsCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadPostsCount > 9 ? '9+' : unreadPostsCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveContentTab('chats');
                      setSelectedChat(null); // Go back to list if a chatroom is open
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
                      activeContentTab === 'chats'
                        ? 'theme-bg-primary theme-text-primary shadow-sm'
                        : 'theme-text-secondary hover:theme-text-primary'
                    }`}
                  >
                    {t('chats.title') || 'Chats'}
                    {unreadChatsCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadChatsCount > 9 ? '9+' : unreadChatsCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Content based on active tab */}
              <div className="flex-1 overflow-hidden">
                {activeContentTab === 'posts' && (
                  selectedPost ? (
                    <PostDetailContainer
                      post={selectedPost}
                      topicId={selectedTopic.id}
                      posts={topicPosts}
                      onBack={() => setSelectedPost(null)}
                      onPostChange={(post) => {
                        setSelectedPost(post);
                        // Reload post data
                      }}
                    />
                  ) : (
                    <PostList 
                      topicId={selectedTopic.id}
                      onPostSelect={(post) => {
                        setSelectedPost(post);
                        // Load all posts for navigation
                        loadTopicPosts(selectedTopic.id);
                      }}
                    />
                  )
                )}
                {activeContentTab === 'chats' && (
                  selectedChat ? (
                    <ChatRoomContainer
                      room={selectedChat}
                      onBack={() => setSelectedChat(null)}
                    />
                  ) : (
                    <ChatList
                      topicId={selectedTopic.id}
                      onChatSelect={(chat) => setSelectedChat(chat)}
                    />
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex">
              {/* Main Content - Welcome Message */}
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

              {/* Right Column - Recent Posts */}
              <div className="w-80 border-l theme-border theme-bg-primary overflow-y-auto">
                <div className="p-4 border-b theme-border">
                  <h3 className="text-lg font-semibold theme-text-primary">
                    {t('posts.recentPosts') || 'Recent Posts'}
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  {loadingPosts ? (
                    <div className="flex justify-center items-center h-24">
                      <LoadingSpinner />
                    </div>
                  ) : allPosts.length === 0 ? (
                    <p className="text-center theme-text-secondary text-sm py-8">
                      {t('posts.noPosts') || 'No posts yet'}
                    </p>
                  ) : (
                    allPosts.map(post => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onVoteChange={(upvoted, downvoted, upCount, downCount, score) => {
                          setAllPosts(prev =>
                            prev.map(p =>
                              p.id === post.id
                                ? { ...p, upvote_count: upCount, downvote_count: downCount, score, user_has_upvoted: upvoted, user_has_downvoted: downvoted }
                                : p
                            )
                          );
                        }}
                      />
                    ))
                  )}
                </div>
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

    {/* Anonymous Mode Dialog */}
    {showAnonymousModeDialog && selectedTopic && (
      <AnonymousModeDialog
        isOpen={showAnonymousModeDialog}
        onClose={() => setShowAnonymousModeDialog(false)}
        topicId={selectedTopic.id}
        topicTitle={selectedTopic.title}
        currentAnonymousName={topicAnonymousMode[selectedTopic.id]?.name}
        isAnonymous={topicAnonymousMode[selectedTopic.id]?.isAnonymous || false}
        onUpdate={(isAnonymous, anonymousName) => {
          setTopicAnonymousMode(prev => ({
            ...prev,
            [selectedTopic.id]: { isAnonymous, name: anonymousName }
          }));
          // Update current topic anonymous state for UserMenu
          if (typeof window !== 'undefined') {
            localStorage.setItem('current_topic_anonymous_state', JSON.stringify({
              topicId: selectedTopic.id,
              isAnonymous,
              name: anonymousName
            }));
            // Dispatch custom event to notify UserMenu
            window.dispatchEvent(new Event('anonymousStateChanged'));
          }
        }}
      />
    )}
    </>
  );
}
