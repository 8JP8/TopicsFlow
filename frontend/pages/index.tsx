import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Layout from '@/components/Layout/Layout';
import TopicList from '@/components/Topic/TopicList';
import TopicCreate from '@/components/Topic/TopicCreate';
import ChatContainer from '@/components/Chat/ChatContainer';
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [activeTab, setActiveTab] = useState<'topics' | 'chat' | 'messages'>('topics');
  const [sidebarHighlight, setSidebarHighlight] = useState(false);
  const [expandedPrivateMessage, setExpandedPrivateMessage] = useState<{userId: string, username: string} | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);

  // Check if notification permission dialog should be shown
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const permissionRequested = localStorage.getItem('notificationPermissionRequested');
    const hasNotificationSupport = 'Notification' in window;
    
    // Show dialog if:
    // 1. Browser supports notifications
    // 2. User is logged in
    // 3. Permission hasn't been requested yet
    // 4. Permission is not already granted
    if (hasNotificationSupport && !permissionRequested) {
      const currentPermission = Notification.permission;
      if (currentPermission === 'default') {
        // Wait a bit before showing to not interrupt initial load
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
      setActiveTab('messages');
    };

    window.addEventListener('openPrivateMessage', handleOpenPrivateMessage as EventListener);
    return () => window.removeEventListener('openPrivateMessage', handleOpenPrivateMessage as EventListener);
  }, []);

  const handleMessageReceived = (message: Message) => {
    if (selectedTopic && message.topic_id === selectedTopic.id) {
      // Check if message already exists to avoid duplicates
      setMessages(prev => {
        // Remove any temp messages with the same content (optimistic updates)
        const filtered = prev.filter(m => {
          // If this is a temp message and we got a real one, remove the temp
          if (m.id.startsWith('temp-') && m.content === message.content && !message.id.startsWith('temp-')) {
            console.log('Removing temp message, replacing with real one:', m.id);
            return false;
          }
          return true;
        });
        
        // Check if message already exists
        const exists = filtered.some(m => m.id === message.id);
        if (exists) {
          console.log('Message already exists, skipping:', message.id);
          return filtered;
        }
        console.log('Adding new message to state:', message);
        return [...filtered, message];
      });
    }
  };

  // Set up socket listeners for new messages
  useEffect(() => {
    if (!socket || !connected) return;

    const handleNewMessage = (data: any) => {
      console.log('New message received in index:', data);
      // Compare topic IDs as strings to handle ObjectId conversion
      const receivedTopicId = String(data.topic_id || '');
      const currentTopicId = String(selectedTopic?.id || '');
      
      console.log('Comparing topic IDs for new message:', { 
        receivedTopicId, 
        currentTopicId, 
        match: receivedTopicId === currentTopicId,
        hasSelectedTopic: !!selectedTopic
      });
      
      if (receivedTopicId && selectedTopic && receivedTopicId === currentTopicId) {
        const message: Message = {
          id: String(data.id),
          content: data.content,
          message_type: data.message_type || 'text',
          created_at: data.created_at,
          display_name: data.display_name || 'Unknown',
          sender_username: data.sender_username,
          user_id: data.user_id,
          is_anonymous: data.is_anonymous || false,
          can_delete: data.can_delete || false,
          topic_id: receivedTopicId,
          gif_url: data.gif_url,
        };
        console.log('Adding message to state:', message);
        handleMessageReceived(message);
      } else {
        console.log('Message not for current topic, ignoring');
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, connected, selectedTopic, handleMessageReceived]);

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
      const response = await api.get(API_ENDPOINTS.TOPICS.LIST, {
        limit: 50,
        sort_by: 'last_activity',
      });

      if (response.data.success) {
        setTopics(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSelect = (topic: Topic) => {
    setSelectedTopic(topic);
    // Keep the activeTab as 'topics' to maintain sidebar visibility
    // Don't change to 'chat' - the chat will show in the main area
    setMessages([]); // Clear messages when switching topics
  };

  const handleTopicCreated = (newTopic: Topic) => {
    setTopics(prev => [newTopic, ...prev]);
    setShowCreateTopic(false);
    handleTopicSelect(newTopic);
  };

  const handleBackToTopics = () => {
    setSelectedTopic(null);
    setActiveTab('topics');
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
              <h1 className="text-xl font-bold theme-text-primary">ChatHub</h1>
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
                onClick={() => setActiveTab('topics')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'topics'
                    ? 'theme-bg-primary theme-text-primary shadow-sm'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                {t('home.topics')}
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'messages'
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
            {activeTab === 'topics' && (
              <div className="h-full flex flex-col">
                {showCreateTopic ? (
                  <div className="p-4">
                    <TopicCreate
                      onClose={() => setShowCreateTopic(false)}
                      onTopicCreated={handleTopicCreated}
                    />
                  </div>
                ) : (
                  <>
                    <div className="p-4">
                      <button
                        onClick={() => setShowCreateTopic(true)}
                        className="w-full btn btn-primary"
                      >
                        {t('home.createNewTopic')}
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

            {activeTab === 'messages' && (
              <div className="h-full">
                <PrivateMessagesSimplified 
                  onExpandMessage={(userId, username) => {
                    setExpandedPrivateMessage({userId, username});
                    setActiveTab('messages');
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
                setActiveTab('messages');
              }}
              isExpanded={true}
            />
          ) : selectedTopic ? (
            <ChatContainer
              topic={selectedTopic}
              messages={messages}
              onMessageReceived={handleMessageReceived}
              onBackToTopics={handleBackToTopics}
            />
          ) : expandedPrivateMessage ? null : (
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
                <button
                  onClick={() => {
                    setActiveTab('topics');
                    setSidebarHighlight(true);
                    // Scroll sidebar into view if needed
                    if (sidebarRef.current) {
                      sidebarRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                    // Remove highlight after animation
                    setTimeout(() => setSidebarHighlight(false), 2000);
                  }}
                  className="btn btn-primary"
                >
                  {t('home.browseTopics')}
                </button>
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