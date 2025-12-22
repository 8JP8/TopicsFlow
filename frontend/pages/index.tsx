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
import VoipControlBar from '../components/Voip/VoipControlBar';
import MobileCallWidget from '../components/Voip/MobileCallWidget';
import { getAnonymousModeState, saveAnonymousModeState, getLastAnonymousName, saveLastAnonymousName } from '@/utils/anonymousStorage';
import { Menu, MessageSquare, Hash, User, ArrowLeft, LayoutList } from 'lucide-react';
import UserMenu from '@/components/UI/UserMenu';

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
  // Track unread messages per chat room
  const [unreadChatRoomMessages, setUnreadChatRoomMessages] = useState<{ [chatId: string]: number }>({});
  const [activeSidebarTab, setActiveSidebarTab] = useState<'topics' | 'messages'>('topics');
  const [activeContentTab, setActiveContentTab] = useState<'posts' | 'chats'>('posts');
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [sidebarHighlight, setSidebarHighlight] = useState(false);
  const [expandedPrivateMessage, setExpandedPrivateMessage] = useState<{ userId: string, username: string } | null>(null);
  const [expandedChatRoom, setExpandedChatRoom] = useState<ChatRoom | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [mobileView, setMobileView] = useState<'sidebar' | 'content'>('sidebar');


  // Listen for tour events
  useEffect(() => {
    const handleSwitchTab = (e: CustomEvent) => {
      if (e.detail === 'messages') {
        setActiveSidebarTab('messages');
      } else if (e.detail === 'topics') {
        setActiveSidebarTab('topics');
      }
    };

    const handleSwitchMobileView = (e: CustomEvent) => {
      if (e.detail === 'sidebar' || e.detail === 'content') {
        setMobileView(e.detail);
      }
    };

    window.addEventListener('tour:switch-tab', handleSwitchTab as EventListener);
    window.addEventListener('tour:switch-mobile-view', handleSwitchMobileView as EventListener);

    return () => {
      window.removeEventListener('tour:switch-tab', handleSwitchTab as EventListener);
      window.removeEventListener('tour:switch-mobile-view', handleSwitchMobileView as EventListener);
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
      setMobileView('content');
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
            setExpandedChatRoom(chatRoom); // Open in full view
            setSelectedPost(null);
            setExpandedPrivateMessage(null); // Close private messages if open
          } else {
            // Even if topic is not loaded/selected, we can still show the chat room if we have the data
            // This is actually better for "global" group chats that might not tightly bind to the current topic list view
            setExpandedChatRoom(chatRoom);
            setExpandedPrivateMessage(null);
          }
          setMobileView('content');
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
            setMobileView('content');
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



    const handleNewChatMessage = (data: { topic_id?: string, chat_room_id?: string }) => {
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

      // Track per chat room - always increment unless we are INSIDE that specific chat room
      // But we can't easily know if we are inside a specific chat room here with just 'selectedChat'
      // effectively, if we are viewing the chat list, we want to see badges.
      // If we are in the chat room, we probably don't want to increment.
      if (data.chat_room_id) {
        setUnreadChatRoomMessages(prev => {
          // If we are currently viewing this specific chat, don't increment
          if (expandedChatRoom?.id === data.chat_room_id) {
            return prev;
          }
          return {
            ...prev,
            [data.chat_room_id!]: (prev[data.chat_room_id!] || 0) + 1
          };
        });
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
  }, [socket, connected, activeSidebarTab, activeContentTab, selectedTopic?.id, expandedChatRoom]);

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
    setExpandedChatRoom(null);
    setExpandedPrivateMessage(null);
    setMobileView('content');
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
    setExpandedChatRoom(null);
    setExpandedPrivateMessage(null);
    setActiveContentTab('posts');
    setMobileView('content');
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
        <div className="flex h-full md:pb-0 pb-16">
          {/* Left Sidebar */}
          <div className={`${mobileView === 'sidebar' ? 'block w-full' : 'hidden'} md:block h-full md:w-auto`}>
            <ResizableSidebar
              defaultWidth={350}
              minWidth={280}
              maxWidth={500}
              onWidthChange={(w) => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('sidebar-width', w.toString());
                }
              }}
              className={`border-r theme-border transition-all duration-300 h-full ${mobileView === 'sidebar' ? 'block w-full' : 'hidden'} md:block scrollbar-hide`}
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
                          setExpandedChatRoom(null);
                          setActiveSidebarTab('messages');
                          setMobileView('content');
                        }}
                        expandedMessage={expandedPrivateMessage}
                        onGroupSelect={(group) => {
                          setExpandedChatRoom(group);
                          setExpandedPrivateMessage(null);
                          setActiveSidebarTab('messages');
                          setMobileView('content');
                        }}
                        unreadGroupCounts={unreadChatRoomMessages}
                      />
                    </div>
                  )}
                </div>

                {/* VOIP Control Bar - At bottom of left sidebar (Desktop only) */}
                <div className="hidden md:block">
                  <VoipControlBar />
                </div>
              </div>
            </ResizableSidebar>
          </div>

          {/* Main Content */}
          <div className={`flex-1 flex flex-col ${mobileView === 'content' ? 'block w-full' : 'hidden'} md:flex`}>
            {expandedPrivateMessage ? (
              <PrivateMessagesSimplified
                expandedMessage={expandedPrivateMessage}
                onCloseExpanded={() => {
                  setExpandedPrivateMessage(null);
                  setActiveSidebarTab('messages');
                }}
                isExpanded={true}
                onGroupSelect={(group) => {
                  setExpandedChatRoom(group);
                  setExpandedPrivateMessage(null);
                }}
                unreadGroupCounts={unreadChatRoomMessages}
              />
            ) : expandedChatRoom ? (
              <ChatRoomContainer
                room={expandedChatRoom}
                onBack={() => setExpandedChatRoom(null)}
              />
            ) : selectedTopic ? (
              <div className="h-full flex flex-col">
                {/* Topic Header */}
                <div className="pt-4 px-4 pb-0 border-b theme-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setMobileView('sidebar')} className="md:hidden p-1 -ml-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                          <ArrowLeft size={20} className="theme-text-primary" />
                        </button>
                        <h2 className="text-2xl font-bold theme-text-primary">{selectedTopic.title}</h2>
                      </div>
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8H19C20.1046 8 21 8.89543 21 10V16C21 17.1046 20.1046 18 19 18H17V22L13 18H9C8.44772 18 7.94772 17.7761 7.58579 17.4142M7.58579 17.4142L11 14H15C16.1046 14 17 13.1046 17 12V6C17 4.89543 16.1046 4 15 4H5C3.89543 4 3 4.89543 3 6V12C3 13.1046 3.89543 14 5 14H7V18L7.58579 17.4142Z" />
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
                        unreadCounts={unreadChatRoomMessages}
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
                      <svg className="w-24 h-24 mx-auto theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 800 800">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={28} d="M114.000 40.695 C 105.031 41.701,87.033 49.222,77.474 55.958 C 67.950 62.671,63.958 66.377,58.124 73.927 C 48.682 86.145,42.952 98.516,39.980 113.100 C 38.014 122.747,37.987 126.442,38.242 354.698 L 38.500 586.500 41.000 590.911 C 45.827 599.428,54.311 603.634,64.708 602.663 C 71.680 602.012,73.659 600.941,83.500 592.495 C 91.794 585.377,93.497 583.950,101.605 577.314 C 105.513 574.116,111.138 569.442,114.105 566.928 C 125.182 557.539,155.502 532.313,161.885 527.174 C 165.523 524.245,169.840 520.645,171.477 519.174 C 173.114 517.703,178.570 513.125,183.601 509.000 C 188.632 504.875,195.528 499.137,198.926 496.250 L 205.104 491.000 374.302 491.013 C 528.058 491.024,544.185 490.875,551.000 489.371 C 565.378 486.200,576.862 480.822,589.744 471.227 C 597.835 465.201,601.990 460.696,608.345 451.057 C 615.334 440.458,615.831 439.426,621.596 423.500 C 623.306 418.776,623.424 410.368,623.734 271.373 C 623.937 180.444,623.695 121.620,623.099 117.373 C 621.546 106.305,619.910 101.098,614.720 90.709 C 603.376 68.003,585.020 52.255,559.500 43.335 L 551.500 40.539 334.500 40.421 C 215.150 40.356,115.925 40.479,114.000 40.695 M559.000 47.799 C 564.225 49.614,571.425 52.701,575.000 54.660 C 582.374 58.700,595.632 69.146,598.551 73.216 C 611.847 91.752,616.623 102.173,619.052 117.948 C 620.566 127.780,619.878 414.529,618.331 418.500 C 617.689 420.150,616.376 424.200,615.414 427.500 C 608.520 451.157,586.978 473.200,562.607 481.536 C 545.824 487.276,555.434 487.000,372.162 487.000 L 203.456 487.000 199.478 490.224 C 197.290 491.997,168.781 515.735,136.124 542.974 C 103.467 570.213,74.995 593.825,72.853 595.444 C 69.462 598.007,68.086 598.395,62.229 598.438 C 57.238 598.475,54.655 597.978,52.227 596.515 C 47.962 593.944,44.359 588.622,43.076 583.000 C 41.611 576.582,41.611 135.406,43.076 122.272 C 44.367 110.697,47.903 98.842,52.703 90.000 C 57.217 81.684,68.214 67.573,72.412 64.711 C 89.532 53.035,91.356 52.052,102.255 48.616 C 108.440 46.667,114.850 44.895,116.500 44.678 C 118.150 44.461,216.250 44.333,334.500 44.392 L 549.500 44.500 559.000 47.799 M188.500 172.328 C 180.431 175.492,175.786 179.502,172.102 186.485 C 170.505 189.513,170.000 192.279,170.000 198.000 C 170.000 208.928,174.062 215.843,183.969 221.783 L 188.500 224.500 330.676 224.500 L 472.851 224.500 478.613 221.500 C 491.657 214.709,496.532 199.893,490.131 186.500 C 486.708 179.338,484.301 176.970,477.000 173.576 L 471.500 171.020 331.500 171.086 C 226.685 171.135,190.746 171.448,188.500 172.328 M478.733 179.788 C 485.658 185.273,487.500 189.204,487.500 198.500 C 487.500 205.849,487.256 206.819,484.500 210.428 C 482.850 212.588,479.499 215.625,477.054 217.178 L 472.608 220.000 331.554 219.977 L 190.500 219.953 185.534 217.227 C 175.664 211.807,171.438 199.581,175.927 189.433 C 178.764 183.018,180.521 181.178,186.500 178.359 L 191.500 176.001 333.041 176.251 L 474.581 176.500 478.733 179.788 M667.667 220.667 C 667.300 221.033,666.983 260.521,666.963 308.417 C 666.942 356.313,666.533 401.125,666.054 408.000 C 662.956 452.422,637.444 492.455,597.335 515.837 C 580.657 525.559,562.941 530.905,540.500 532.986 C 534.884 533.506,461.999 533.932,374.250 533.956 L 218.000 534.000 218.000 570.912 C 218.000 614.312,218.513 618.450,225.694 632.986 C 229.566 640.824,231.857 643.953,238.702 650.750 C 243.271 655.288,247.415 659.000,247.909 659.000 C 248.403 659.000,251.439 660.481,254.654 662.291 C 257.869 664.101,263.875 666.578,268.000 667.794 L 275.500 670.006 444.779 670.003 L 614.057 670.000 623.279 677.191 C 628.350 681.145,633.274 685.162,634.221 686.117 C 635.167 687.072,637.642 689.124,639.721 690.676 C 645.398 694.916,663.629 709.439,671.000 715.593 C 674.575 718.578,684.385 726.528,692.801 733.260 C 726.170 759.954,727.417 760.679,738.248 759.706 C 745.937 759.016,752.434 754.469,756.260 747.101 L 759.021 741.786 758.760 508.143 C 758.511 284.057,758.425 274.295,756.659 269.500 C 747.611 244.929,732.068 229.226,710.000 222.363 C 703.389 220.306,700.476 220.028,685.417 220.015 C 676.021 220.007,668.033 220.300,667.667 220.667 M708.954 226.502 C 719.778 229.704,726.391 233.735,735.510 242.687 C 743.758 250.783,748.696 258.882,752.162 270.000 L 754.500 277.500 754.500 510.152 L 754.500 742.803 751.352 747.149 C 745.911 754.660,737.833 757.497,729.000 754.999 C 727.075 754.455,719.875 749.453,713.000 743.885 C 689.486 724.840,681.586 718.499,678.884 716.500 C 677.397 715.400,663.799 704.521,648.667 692.324 C 633.535 680.127,619.902 669.327,618.372 668.324 C 615.714 666.582,607.885 666.477,444.044 665.980 L 272.500 665.459 266.500 663.309 C 246.057 655.985,231.972 641.602,224.784 620.713 C 222.777 614.882,222.622 612.153,222.259 576.287 L 221.872 538.074 383.686 537.745 C 554.093 537.399,547.579 537.573,566.500 532.872 C 576.955 530.274,583.130 527.755,596.493 520.637 C 611.635 512.572,618.989 507.211,629.500 496.579 C 640.392 485.562,646.278 477.466,654.135 462.694 C 661.016 449.760,665.081 438.894,668.162 425.199 C 670.306 415.669,670.350 413.848,670.701 320.500 C 670.898 268.250,671.283 224.868,671.557 224.096 C 672.408 221.698,698.365 223.369,708.954 226.502 M185.500 263.387 C 179.853 266.061,175.193 270.617,172.100 276.485 C 170.523 279.479,170.000 282.286,170.000 287.768 C 170.000 299.153,174.709 306.810,185.000 312.160 L 189.500 314.500 283.495 314.770 C 345.815 314.949,379.180 314.689,382.506 313.999 C 389.362 312.575,396.530 306.932,400.144 300.112 C 407.175 286.846,401.352 269.932,387.500 263.383 L 382.500 261.020 286.500 261.020 L 190.500 261.020 185.500 263.387 M385.500 267.165 C 389.376 269.316,394.317 274.590,396.490 278.897 C 397.767 281.428,398.112 284.119,397.842 289.450 C 397.524 295.746,397.088 297.101,394.202 300.744 C 392.399 303.021,389.253 305.923,387.212 307.192 L 383.500 309.500 288.000 309.779 C 182.357 310.088,187.535 310.382,180.871 303.717 C 173.778 296.624,172.248 287.052,176.761 278.020 C 180.095 271.349,185.999 266.882,192.775 265.905 C 195.374 265.530,239.125 265.286,290.000 265.362 C 374.261 265.488,382.767 265.648,385.500 267.165" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold theme-text-primary mb-2">
                      {t('home.title')}
                    </h2>
                    <p className="theme-text-secondary mb-6 max-w-md">
                      {t('home.description')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div >
        {/* Mobile Bottom Navigation Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 theme-bg-secondary border-t theme-border flex items-center z-50 pb-safe">
          <button
            onClick={() => setMobileView('sidebar')}
            className={`flex-1 flex flex-col items-center justify-center h-full space-y-1 ${mobileView === 'sidebar' ? 'theme-text-primary' : 'theme-text-secondary'}`}
          >
            <LayoutList size={24} />
            <span className="text-[10px] font-medium">{t('common.menu') || 'Menu'}</span>
          </button>

          <button
            onClick={() => setMobileView('content')}
            className={`flex-1 flex flex-col items-center justify-center h-full space-y-1 ${mobileView === 'content' ? 'theme-text-primary' : 'theme-text-secondary'}`}
          >
            <div className="relative">
              <MessageSquare size={24} />
              {(unreadPostsCount + unreadChatsCount > 0) && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 theme-border box-content"></span>
              )}
            </div>
            <span className="text-[10px] font-medium">{t('common.content') || 'View'}</span>
          </button>

          <div className="flex-1 h-full">
            <UserMenu placement="mobile-bottom" />
          </div>
        </div>
      </Layout >

      {/* Mobile VoIP Widget - Floating/Dockable */}
      <MobileCallWidget />

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
