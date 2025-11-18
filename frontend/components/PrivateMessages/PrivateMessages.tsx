import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

interface Conversation {
  id: string;
  user_id: string;
  username: string;
  last_message: {
    id: string;
    content: string;
    created_at: string;
    is_from_me: boolean;
  };
  unread_count: number;
}

interface Message {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  is_from_me: boolean;
  sender_username: string;
  gif_url?: string;
}

const PrivateMessages: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{id: string, username: string, email: string}>>([]);
  const [searching, setSearching] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.PRIVATE_CONVERSATIONS, {
        limit: 20,
      });

      if (response.data.success) {
        setConversations(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (userId: string) => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.PRIVATE_CONVERSATION(userId));

      if (response.data.success) {
        setMessages(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() || !selectedConversation || sendingMessage) {
      return;
    }

    setSendingMessage(true);

    try {
      const response = await api.post(API_ENDPOINTS.MESSAGES.SEND_PRIVATE, {
        to_user_id: selectedConversation,
        content: messageInput.trim(),
        message_type: 'text',
      });

      if (response.data.success) {
        // Add message to local state
        const newMessage: Message = {
          id: response.data.data.id,
          content: messageInput.trim(),
          message_type: 'text',
          created_at: new Date().toISOString(),
          is_from_me: true,
          sender_username: 'You',
        };

        setMessages(prev => [...prev, newMessage]);
        setMessageInput('');

        // Update conversation list
        loadConversations();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60 * 1000) {
      return 'Just now';
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}m ago`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleConversationClick = (userId: string) => {
    setSelectedConversation(userId);
    setMessages([]);
  };

  const handleMarkAsRead = async (userId: string) => {
    try {
      await api.post(API_ENDPOINTS.USERS.MARK_CONVERSATION_READ(userId));
      // Update conversations list to clear unread count
      loadConversations();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return;
    }

    setSearching(true);

    try {
      const response = await api.get(API_ENDPOINTS.USERS.SEARCH, {
        q: searchQuery,
        limit: 10,
      });

      if (response.data.success) {
        setSearchResults(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleStartConversation = (userId: string) => {
    setSelectedConversation(userId);
    setShowAddFriendModal(false);
    setSearchQuery('');
    setSearchResults([]);
    loadMessages(userId);
    loadConversations();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Conversations List */}
      <div className="w-80 border-r theme-border flex flex-col">
        <div className="p-4 border-b theme-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold theme-text-primary">Messages</h3>
            <button
              onClick={() => setShowAddFriendModal(true)}
              className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
              title="Start new conversation"
            >
              <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 theme-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="theme-text-secondary">No conversations yet</p>
              <p className="text-sm theme-text-muted mt-1">
                Start a conversation from a topic or user profile
              </p>
            </div>
          ) : (
            <div className="divide-y theme-border">
              {conversations.map((conversation) => (
                <div
                  key={conversation.user_id}
                  onClick={() => {
                    handleConversationClick(conversation.user_id);
                    if (conversation.unread_count > 0) {
                      handleMarkAsRead(conversation.user_id);
                    }
                  }}
                  className={`p-4 cursor-pointer hover:theme-bg-tertiary transition-colors ${
                    selectedConversation === conversation.user_id ? 'theme-bg-tertiary' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium theme-text-primary truncate">
                      {conversation.username}
                    </h4>
                    <span className="text-xs theme-text-muted">
                      {formatTimestamp(conversation.last_message.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm theme-text-secondary truncate">
                      {conversation.last_message.is_from_me ? 'You: ' : ''}
                      {conversation.last_message.content}
                    </p>
                    {conversation.unread_count > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs rounded-full">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="h-16 border-b theme-border flex items-center justify-between px-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full theme-blue-primary flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {conversations.find(c => c.user_id === selectedConversation)?.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium theme-text-primary">
                    {conversations.find(c => c.user_id === selectedConversation)?.username}
                  </h3>
                  <p className="text-sm theme-text-secondary">Private conversation</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="theme-text-secondary">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-start space-x-3 ${
                        message.is_from_me ? 'justify-end' : ''
                      }`}
                    >
                      {!message.is_from_me && (
                        <div className="w-8 h-8 rounded-full theme-bg-tertiary flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium theme-text-primary">
                            {message.sender_username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className={`max-w-xs lg:max-w-md ${
                        message.is_from_me ? 'order-first' : ''
                      }`}>
                        <div
                          className={`message-bubble ${
                            message.is_from_me ? 'message-bubble-own' : 'message-bubble-other'
                          }`}
                        >
                          {message.content}
                        </div>
                        <p className="text-xs theme-text-muted mt-1 px-1">
                          {formatMessageTime(message.created_at)}
                        </p>
                      </div>
                      {message.is_from_me && (
                        <div className="w-8 h-8 rounded-full theme-blue-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-semibold">You</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <div className="border-t theme-border p-4">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(e)}
                    placeholder="Type a message..."
                    className="w-full px-4 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                    disabled={sendingMessage}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!messageInput.trim() || sendingMessage}
                  className="px-4 py-2 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMessage ? <LoadingSpinner size="sm" /> : 'Send'}
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 theme-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-lg font-medium theme-text-primary mb-2">
                Select a conversation
              </h3>
              <p className="theme-text-secondary">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddFriendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="theme-bg-secondary rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold theme-text-primary">Start New Conversation</h3>
              <button
                onClick={() => {
                  setShowAddFriendModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
              >
                <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm theme-text-secondary mb-4">
              Search for users by username or email to start a private conversation.
            </p>

            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter username or email..."
                className="flex-1 px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                autoFocus
              />
              <button
                onClick={handleSearch}
                disabled={searching || searchQuery.length < 2}
                className="px-4 py-2 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searching ? <LoadingSpinner size="sm" /> : 'Search'}
              </button>
            </div>

            {/* Search Results */}
            <div className="max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full theme-blue-primary flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium theme-text-primary">{user.username}</h4>
                          <p className="text-xs theme-text-secondary">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleStartConversation(user.id)}
                        className="px-3 py-1 btn btn-primary text-sm"
                      >
                        Message
                      </button>
                    </div>
                  ))}
                </div>
              ) : searchQuery.length >= 2 && !searching ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 theme-text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="theme-text-secondary">No users found</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 theme-text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="theme-text-secondary text-sm">Search for users to start chatting</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivateMessages;