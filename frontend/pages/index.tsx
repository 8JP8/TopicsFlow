import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Layout from '@/components/Layout/Layout';
import TopicList from '@/components/Topic/TopicList';
import TopicCreate from '@/components/Topic/TopicCreate';
import ChatContainer from '@/components/Chat/ChatContainer';
import PrivateMessages from '@/components/PrivateMessages/PrivateMessages';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

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
}

interface Message {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  display_name: string;
  is_anonymous: boolean;
  can_delete: boolean;
  topic_id?: string;
  gif_url?: string;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { connected, onlineUsers } = useSocket();
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [activeTab, setActiveTab] = useState<'topics' | 'chat' | 'messages'>('topics');

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
    setActiveTab('chat');
    setMessages([]); // Clear messages when switching topics
  };

  const handleTopicCreated = (newTopic: Topic) => {
    setTopics(prev => [newTopic, ...prev]);
    setShowCreateTopic(false);
    handleTopicSelect(newTopic);
  };

  const handleMessageReceived = (message: Message) => {
    if (selectedTopic && message.topic_id === selectedTopic.id) {
      setMessages(prev => [...prev, message]);
    }
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
    <Layout>
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-80 border-r theme-border flex flex-col">
          {/* Header */}
          <div className="p-4 border-b theme-border">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold theme-text-primary">ChatHub</h1>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm theme-text-secondary">
                    {onlineUsers} online
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
                Topics
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'messages'
                    ? 'theme-bg-primary theme-text-primary shadow-sm'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                Messages
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
                        Create New Topic
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
                <PrivateMessages />
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {selectedTopic ? (
            <ChatContainer
              topic={selectedTopic}
              messages={messages}
              onMessageReceived={handleMessageReceived}
              onBackToTopics={handleBackToTopics}
            />
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
                  Welcome to ChatHub
                </h2>
                <p className="theme-text-secondary mb-6 max-w-md">
                  Select a topic from the sidebar to start chatting, or create a new topic to begin a conversation.
                </p>
                <button
                  onClick={() => setActiveTab('topics')}
                  className="btn btn-primary"
                >
                  Browse Topics
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}