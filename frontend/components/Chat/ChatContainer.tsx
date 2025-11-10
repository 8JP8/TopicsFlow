import React, { useState, useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

interface Message {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  display_name: string;
  is_anonymous: boolean;
  can_delete: boolean;
  gif_url?: string;
}

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

interface ChatContainerProps {
  topic: Topic;
  messages: Message[];
  onMessageReceived: (message: Message) => void;
  onBackToTopics: () => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  topic,
  messages,
  onMessageReceived,
  onBackToTopics,
}) => {
  const { user } = useAuth();
  const { joinTopic, leaveTopic, sendMessage, typingStart, typingStop, connected } = useSocket();
  const [messageInput, setMessageInput] = useState('');
  const [useAnonymous, setUseAnonymous] = useState(false);
  const [anonymousName, setAnonymousName] = useState('');
  const [showAnonymousSettings, setShowAnonymousSettings] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Join topic when component mounts
  useEffect(() => {
    if (topic && user) {
      setLoading(true);
      joinTopic(topic.id, useAnonymous, anonymousName || undefined);

      // Simulate loading messages (in real app, this would come from API)
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }

    return () => {
      if (topic) {
        leaveTopic(topic.id);
      }
    };
  }, [topic, user, joinTopic, leaveTopic]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() || !connected) {
      return;
    }

    sendMessage(topic.id, messageInput.trim(), 'text', useAnonymous);
    setMessageInput('');
    setIsTyping(false);
  };

  const handleTypingStart = () => {
    if (!isTyping) {
      setIsTyping(true);
      typingStart(topic.id);
    }
  };

  const handleTypingStop = () => {
    if (isTyping) {
      setIsTyping(false);
      typingStop(topic.id);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);

    if (e.target.value.trim()) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-16 border-b theme-border flex items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToTopics}
            className="lg:hidden p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
          >
            <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div>
            <h2 className="text-lg font-semibold theme-text-primary">{topic.title}</h2>
            <p className="text-sm theme-text-secondary">
              {topic.member_count} members • {connected ? 'Connected' : 'Connecting...'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Anonymous toggle */}
          {topic.settings.allow_anonymous && (
            <button
              onClick={() => setShowAnonymousSettings(!showAnonymousSettings)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                useAnonymous
                  ? 'theme-blue-primary text-white'
                  : 'theme-bg-tertiary theme-text-primary hover:theme-bg-secondary'
              }`}
            >
              {useAnonymous ? 'Anonymous' : 'Real Name'}
            </button>
          )}

          {/* Connection status */}
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm ${
            connected ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
          }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span>{connected ? 'Online' : 'Reconnecting...'}</span>
          </div>
        </div>
      </div>

      {/* Anonymous Settings Panel */}
      {showAnonymousSettings && (
        <div className="p-4 border-b theme-border theme-bg-tertiary">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-1">
                Anonymous Name
              </label>
              <input
                type="text"
                value={anonymousName}
                onChange={(e) => setAnonymousName(e.target.value)}
                placeholder="Leave empty for random name"
                className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useAnonymous"
                checked={useAnonymous}
                onChange={(e) => setUseAnonymous(e.target.checked)}
                className="w-4 h-4 theme-blue-primary rounded"
              />
              <label htmlFor="useAnonymous" className="ml-2 text-sm theme-text-primary">
                Send messages anonymously in this topic
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 theme-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="theme-text-secondary">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full theme-bg-tertiary flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium theme-text-primary">
                    {message.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium theme-text-primary">
                      {message.display_name}
                    </span>
                    {message.is_anonymous && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs theme-bg-tertiary theme-text-secondary">
                        Anonymous
                      </span>
                    )}
                    <span className="text-xs theme-text-muted">
                      {formatTimestamp(message.created_at)}
                    </span>
                  </div>
                  <div className="message-bubble-other">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2">
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
            <span className="text-sm theme-text-secondary">
              {typingUsers.length === 1 ? 'Someone is typing...' : `${typingUsers.length} people are typing...`}
            </span>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t theme-border p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <div className="flex-1">
            <input
              type="text"
              value={messageInput}
              onChange={handleMessageInputChange}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(e)}
              placeholder={`Message as ${useAnonymous && anonymousName ? anonymousName : user?.username}...`}
              className="w-full px-4 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
              disabled={!connected}
            />
          </div>

          <button
            type="submit"
            disabled={!messageInput.trim() || !connected}
            className="px-4 py-2 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatContainer;