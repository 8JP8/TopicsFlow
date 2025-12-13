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
import { getAnonymousModeState, saveAnonymousModeState, getLastAnonymousName, saveLastAnonymousName } from '@/utils/anonymousStorage';

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
  const [expandedPrivateMessage, setExpandedPrivateMessage] = useState<{ userId: string, username: string } | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);


  // Listen for tour events
  useEffect(() => {
    const handleSwitchTab = (e: CustomEvent) => {
      if (e.detail === 'messages') {
        setActiveSidebarTab('messages');
      } else if (e.detail === 'topics') {
        setActiveSidebarTab('topics');
      }
    };

    window.addEventListener('tour:switch-tab', handleSwitchTab as EventListener);

    return () => {
      window.removeEventListener('tour:switch-tab', handleSwitchTab as EventListener);
    };
  }, []);

  // Badge counts for unread items
  // Badge counts for unread items
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadPostsCount, setUnreadPostsCount] = useState(0);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  // Track unread messages per topic
  const [unreadTopicMessages, setUnreadTopicMessages] = useState<{ [topicId: string]: number }>({});

  // Anonymous mode state
  const [showAnonymousModeDialog, setShowAnonymousModeDialog] = useState(false);
  const [topicAnonymousMode, setTopicAnonymousMode] = useState<{ [topicId: string]: { isAnonymous: boolean, name?: string } }>({});

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

    const handleOpenChatRoom = async (event: CustomEvent) => {
      const { chatRoomId } = event.detail;
      try {
        const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET(chatRoomId));
        if (response.data.success && response.data.data) {
          const chatRoom = response.data.data;
          const associatedTopic = topics.find(t => t.id === chatRoom.topic_id);

          if (associatedTopic) {
            setSelectedTopic(associatedTopic);
            setSelectedChat(chatRoom);
            setActiveContentTab('chats');
            setSelectedPost(null);
          } else {
            // If topic not in current list (rare but possible), maybe fetch topic details?
            // For now, let's try just setting the chat room if we can find topic ID from room data
            // In the future: fetch topic if missing
            if (chatRoom.topic_id) {
              // Fallback: try to find topic in full list not just loaded ones? 
              // Or trigger a topic load.
              // For now, assume topic list is loaded or room has enough data
              // If we can't find the topic locally, we might have issues displaying "Back" correctly or sidebar highlight
            }
          }
        }
      } catch (error) {
        console.error("Failed to open chat room from notification", error);
      }
    };

    const handleOpenPost = async (event: CustomEvent) => {
      const { postId } = event.detail;
      try {
        // We need to fetch the post to know its topic
        const response = await api.get(API_ENDPOINTS.POSTS.GET(postId));
        if (response.data.success && response.data.data) {
          const post = response.data.data;
          const associatedTopic = topics.find(t => t.id === post.topic_id);

          if (associatedTopic) {
            setSelectedTopic(associatedTopic);
            setSelectedPost(post);
            setActiveContentTab('posts');
            setSelectedChat(null);
          }
        }
      } catch (error) {
        console.error("Failed to open post from notification", error);
      }
    };

    window.addEventListener('openPrivateMessage', handleOpenPrivateMessage as EventListener);
    window.addEventListener('openChatRoom', handleOpenChatRoom as unknown as EventListener);
    window.addEventListener('openPost', handleOpenPost as unknown as EventListener);

    return () => {
      window.removeEventListener('openPrivateMessage', handleOpenPrivateMessage as EventListener);
      window.removeEventListener('openChatRoom', handleOpenChatRoom as unknown as EventListener);
      window.removeEventListener('openPost', handleOpenPost as unknown as EventListener);
    };
  }, [topics]); // Add topics dependency to find associated topic

  // Handle deep linking via query params
  useEffect(() => {
    if (!router.isReady || topics.length === 0) return;

    const { chatRoomId, postId } = router.query;

    if (chatRoomId) {
      // Remove query param to clean URL
      router.replace('/', undefined, { shallow: true });

      const event = new CustomEvent('openChatRoom', { detail: { chatRoomId } });
      // Small delay to ensure listeners are ready/state is settled
      setTimeout(() => window.dispatchEvent(event), 100);
    } else if (postId) {
      // Remove query param
      router.replace('/', undefined, { shallow: true });

      const event = new CustomEvent('openPost', { detail: { postId } });
      setTimeout(() => window.dispatchEvent(event), 100);
    }
  }, [router.isReady, router.query, topics]);


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
    setSelectedPost(null);
    setSelectedChat(null);
    // Do not reset activeContentTab; preserve whether user was in 'posts' or 'chats'
    // This allows "keeping the user on the chat separator" if they were in chats
    // and "showing the publication list" if they were in posts (by clearing selectedPost).
  };

  const handleTopicCreated = (newTopic: Topic) => {
    // Manually set permission level to Owner (3) so the invite button appears immediately
    const topicWithOwnerPermission = { ...newTopic, user_permission_level: 3 };
    setTopics(prev => [topicWithOwnerPermission, ...prev]);
    setShowCreateTopic(false);
    setSelectedTopic(topicWithOwnerPermission);
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
              className={`h-full border-r theme-border flex flex-col transition-all duration-500 ${sidebarHighlight ? 'ring-4 ring-blue-500 ring-opacity-50 shadow-lg' : ''
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

                <div className="relative flex p-1 theme-bg-secondary rounded-lg space-x-1">
                  <div
                    className={`absolute top-1 bottom-1 w-[calc(50%-0.375rem)] bg-white dark:bg-neutral-700 rounded-md shadow-sm transition-all duration-300 ease-in-out ${activeSidebarTab === 'topics' ? 'left-1' : 'left-[calc(50%+0.125rem)]'
                      }`}
                  />
                  <button
                    onClick={() => setActiveSidebarTab('topics')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors relative z-10 flex items-center justify-center gap-2 ${activeSidebarTab === 'topics'
                      ? 'theme-text-primary'
                      : 'theme-text-secondary hover:theme-text-primary'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    {t('topics.title') || 'Topics'}
                  </button>
                  <button
                    onClick={() => setActiveSidebarTab('messages')}
                    id="messages-tab-btn"
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors relative z-10 flex items-center justify-center gap-2 ${activeSidebarTab === 'messages'
                      ? 'theme-text-primary'
                      : 'theme-text-secondary hover:theme-text-primary'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    {t('home.messages')}
                    {unreadMessagesCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 animate-bounce-in border-2 theme-bg-secondary">
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
                            id="create-topic-btn"
                            className="w-full btn btn-primary flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
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
                        setExpandedPrivateMessage({ userId, username });
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
                <div className="pt-4 px-4 pb-0 border-b theme-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold theme-text-primary mb-2">{selectedTopic.title}</h2>
                      <p className="theme-text-secondary text-sm mb-4">{selectedTopic.description}</p>
                    </div>

                    {/* Anonymous Mode Selector - Top Right */}
                    {selectedTopic.settings?.allow_anonymous && (
                      <div className="ml-4">
                        <button
                          id="anonymous-mode-toggle"
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
                  <div className="mt-4">
                    <div className="flex relative w-full">
                      {/* Sliding Underline - Blue line only, no full gray border */}
                      <div
                        className={`absolute bottom-0 h-[2px] bg-blue-500 transition-all duration-300 ease-out z-10 ${activeContentTab === 'posts' ? 'left-0 w-1/2' : 'left-1/2 w-1/2'
                          }`}
                      />

                      <button
                        onClick={() => {
                          setActiveContentTab('posts');
                          setSelectedPost(null);
                        }}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors duration-200 text-center select-none outline-none flex items-center justify-center gap-2 ${activeContentTab === 'posts'
                          ? 'theme-text-primary'
                          : 'theme-text-secondary hover:theme-text-primary'
                          }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                        {t('posts.title') || 'Posts'}
                        {unreadPostsCount > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                            {unreadPostsCount > 9 ? '9+' : unreadPostsCount}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setActiveContentTab('chats');
                          setSelectedChat(null);
                        }}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors duration-200 text-center select-none outline-none flex items-center justify-center gap-2 ${activeContentTab === 'chats'
                          ? 'theme-text-primary'
                          : 'theme-text-secondary hover:theme-text-primary'
                          }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 002-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                        </svg>
                        {t('chats.title') || 'Chats'}
                        {unreadChatsCount > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                            {unreadChatsCount > 9 ? '9+' : unreadChatsCount}
                          </span>
                        )}
                      </button>
                    </div>
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
        </div >
      </Layout >

      {/* Notification Permission Dialog */}
      {
        showNotificationDialog && (
          <NotificationPermissionDialog
            onClose={() => setShowNotificationDialog(false)}
          />
        )
      }

      {/* Anonymous Mode Dialog */}
      {
        showAnonymousModeDialog && selectedTopic && (
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
        )
      }
    </>
  );
}
