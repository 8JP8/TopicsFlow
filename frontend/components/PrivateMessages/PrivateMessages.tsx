import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import Avatar from '@/components/UI/Avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';

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
  const { t } = useLanguage();
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
  const [contextMenu, setContextMenu] = useState<{messageId: string, x: number, y: number} | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [areFriends, setAreFriends] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [onlineUsersList, setOnlineUsersList] = useState<Set<string>>(new Set());
  const [conversationStatuses, setConversationStatuses] = useState<Map<string, {isOnline: boolean, lastLogin: string | null, areFriends: boolean}>>(new Map());
  const [friends, setFriends] = useState<Array<{id: string, username: string, email: string, profile_picture?: string}>>([]);
  
  useEffect(() => {
    loadConversations();
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const friendsResponse = await api.get(API_ENDPOINTS.USERS.FRIENDS);
      if (friendsResponse.data.success) {
        const friendsList = friendsResponse.data.data || [];
        setFriends(friendsList);
        
        // Update areFriends for selected conversation
        if (selectedConversation) {
          const isFriend = friendsList.some((friend: any) => friend.id === selectedConversation);
          setAreFriends(isFriend);
        }
        
        // Update conversation statuses with friendship info
        setConversationStatuses(prev => {
          const newMap = new Map(prev);
          conversations.forEach((conv: Conversation) => {
            const isFriend = friendsList.some((friend: any) => friend.id === conv.user_id);
            const existingStatus = newMap.get(conv.user_id);
            if (existingStatus) {
              newMap.set(conv.user_id, { ...existingStatus, areFriends: isFriend });
            } else {
              newMap.set(conv.user_id, { isOnline: false, lastLogin: null, areFriends: isFriend });
            }
          });
          return newMap;
        });
      }
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  // Helper function to check if a user is in the friends list
  const isUserFriend = (userId: string): boolean => {
    return friends.some(friend => friend.id === userId);
  };

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
      // Check friendship from loaded friends list
      const isFriend = isUserFriend(selectedConversation);
      setAreFriends(isFriend);
      
      // Load user info and online status
      const loadUserData = async () => {
        const [userInfo, onlineUsersSet] = await Promise.all([
          loadUserInfo(selectedConversation),
          loadOnlineUsers(),
        ]);
        // Use onlineUsersSet as primary source, but also check userInfo.isOnline from backend
        const userIsOnline = onlineUsersSet.has(selectedConversation) || userInfo.isOnline;
        setIsOnline(userIsOnline);
        // Only set lastLogin if user is offline (if online, lastLogin should be null)
        setLastLogin(userIsOnline ? null : userInfo.lastLogin);
      };
      loadUserData();
    }
  }, [selectedConversation, friends]);

  // Load online users periodically and on mount
  useEffect(() => {
    loadOnlineUsers();
    const interval = setInterval(() => {
      loadOnlineUsers();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu]);

  const loadConversations = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.PRIVATE_CONVERSATIONS, {
        limit: 20,
      });

      if (response.data.success) {
        const conversationsData = response.data.data || [];
        setConversations(conversationsData);
        
        // Load status for all conversations
        const onlineUsersSet = await loadOnlineUsers();
        const statusMap = new Map<string, {isOnline: boolean, lastLogin: string | null, areFriends: boolean}>();
        
        // Create a Set of friend IDs for faster lookup
        const friendIdsSet = new Set(friends.map(f => f.id));
        
        await Promise.all(conversationsData.map(async (conv: Conversation) => {
          try {
            const userInfo = await loadUserInfo(conv.user_id);
            // Check friendship from loaded friends list instead of API call
            const areFriendsResult = friendIdsSet.has(conv.user_id);
            const convIsOnline = onlineUsersSet.has(conv.user_id) || userInfo.isOnline;
            statusMap.set(conv.user_id, {
              isOnline: convIsOnline,
              // Only set lastLogin if user is offline (if online, lastLogin should be null)
              lastLogin: convIsOnline ? null : userInfo.lastLogin,
              areFriends: areFriendsResult,
            });
          } catch (error) {
            console.error(`Failed to load status for user ${conv.user_id}:`, error);
          }
        }));
        
        setConversationStatuses(statusMap);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkFriendship = async (userId: string) => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.CHECK_FRIENDSHIP(userId));
      if (response.data.success) {
        return response.data.are_friends || false;
      }
      return false;
    } catch (error) {
      console.error('Failed to check friendship:', error);
      return false;
    }
  };

  const loadOnlineUsers = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.ONLINE_USERS);
      if (response.data.success) {
        const onlineUserIds = new Set<string>((response.data.data || []).map((u: any) => String(u.id || u.user_id)));
        setOnlineUsersList(onlineUserIds);
        return onlineUserIds;
      }
      return new Set<string>();
    } catch (error) {
      console.error('Failed to load online users:', error);
      return new Set<string>();
    }
  };

  const loadUserInfo = async (userId: string) => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.GET(userId));
      if (response.data.success) {
        // Use last_seen (WebSocket disconnect time) if available, fallback to last_login
        return {
          lastLogin: response.data.data?.last_seen || response.data.data?.last_login || null,
          isOnline: response.data.data?.is_online || false,
        };
      }
      return { lastLogin: null, isOnline: false };
    } catch (error) {
      console.error('Failed to load user info:', error);
      return { lastLogin: null, isOnline: false };
    }
  };

  const formatLastSeen = (lastLogin: string | null) => {
    if (!lastLogin) return null;
    try {
      const date = new Date(lastLogin);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (seconds < 60) return t('privateMessages.justNow') || 'Just now';
      // Show minutes for anything less than 60 minutes, then switch to hours
      if (minutes < 60) return `${t('privateMessages.lastSeenAgo') || 'Last seen'} ${minutes} ${t('privateMessages.minutesAgo') || 'minutes ago'}`;
      if (hours < 24) return `${t('privateMessages.lastSeenAgo') || 'Last seen'} ${hours} ${t('privateMessages.hoursAgo') || 'hours ago'}`;
      if (days < 7) return `${t('privateMessages.lastSeenAgo') || 'Last seen'} ${days} ${t('privateMessages.daysAgo') || 'days ago'}`;
      return `${t('privateMessages.lastSeen') || 'Last seen'} ${date.toLocaleDateString()}`;
    } catch {
      return null;
    }
  };

  const handleSendFriendRequest = async (userId: string, username?: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.USERS.SEND_FRIEND_REQUEST, {
        to_user_id: userId,
      });
      if (response.data.success) {
        toast.success(t('privateMessages.friendRequestSent') || (username ? `Friend request sent to ${username}` : 'Friend request sent'));
        // Refresh friendship status
        if (selectedConversation === userId) {
          const isFriend = await checkFriendship(userId);
          setAreFriends(isFriend);
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || error.response?.data?.error || '';
      toast.error(errorMessage || t('privateMessages.failedToSendFriendRequest') || 'Failed to send friend request');
    }
  };

  const handleRemoveFriend = async (userId: string, username?: string) => {
    try {
      const response = await api.delete(API_ENDPOINTS.USERS.REMOVE_FRIEND(userId));
      if (response.data.success) {
        toast.success(t('privateMessages.friendRemoved') || (username ? `Removed ${username} from friends` : 'Friend removed'));
        // Refresh friendship status
        if (selectedConversation === userId) {
          const isFriend = await checkFriendship(userId);
          setAreFriends(isFriend);
        }
        // Update conversation statuses
        setConversationStatuses(prev => {
          const newMap = new Map(prev);
          const status = newMap.get(userId);
          if (status) {
            newMap.set(userId, { ...status, areFriends: false });
          }
          return newMap;
        });
        // Reload conversations to update status
        loadConversations();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || error.response?.data?.error || '';
      toast.error(errorMessage || t('privateMessages.failedToRemoveFriend') || 'Failed to remove friend');
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

  const handleDeleteForMe = async (messageId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.USERS.DELETE_MESSAGE_FOR_ME(messageId));
      if (response.data.success) {
        toast.success(t('settings.messageRemoved') || 'Message removed for you');
        if (selectedConversation) {
          loadMessages(selectedConversation);
        }
      } else {
        toast.error(response.data.errors?.[0] || t('errors.generic'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    } finally {
      setContextMenu(null);
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
          created_at: response.data.data.created_at || new Date().toISOString(),
          is_from_me: true,
          sender_username: t('common.you') || 'You',
        };

        setMessages(prev => [...prev, newMessage]);
        setMessageInput('');

        // Update conversation list
        loadConversations();
      } else {
        const errorMessage = response.data.errors?.[0] || t('toast.failedToSendMessage') || 'Failed to send message';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errorMessage = error.response?.data?.errors?.[0] || error.response?.data?.message || t('toast.failedToSendMessage') || 'Failed to send message';
      toast.error(errorMessage);
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
              title={t('privateMessages.startNewConversation') || 'Start new conversation'}
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
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <h4 className="font-medium theme-text-primary truncate">
                        {conversation.username}
                      </h4>
                      {(() => {
                        const status = conversationStatuses.get(conversation.user_id);
                        if (!status) return null;
                        const { isOnline, lastLogin, areFriends } = status;
                        if (!areFriends) return null;
                        if (isOnline) {
                          return (
                            <span className="text-xs text-green-500 flex items-center gap-1 flex-shrink-0">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              {t('privateMessages.online') || 'Online'}
                            </span>
                          );
                        }
                        if (lastLogin && formatLastSeen(lastLogin)) {
                          return (
                            <span className="text-xs theme-text-muted flex-shrink-0">
                              {formatLastSeen(lastLogin)}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <p className="text-sm theme-text-secondary truncate flex-1 min-w-0">
                      {conversation.last_message.is_from_me ? `${t('common.you') || 'You'}: ` : ''}
                      {conversation.last_message.content}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {conversation.last_message.created_at && (
                        <span className="text-xs theme-text-muted whitespace-nowrap">
                          {formatTimestamp(conversation.last_message.created_at)}
                        </span>
                      )}
                      {conversation.unread_count > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs rounded-full">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
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
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium theme-text-primary">
                      {conversations.find(c => c.user_id === selectedConversation)?.username}
                    </h3>
                    {areFriends && (
                      <>
                        {isOnline ? (
                          <span className="text-xs text-green-500 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            {t('privateMessages.online') || 'Online'}
                          </span>
                        ) : lastLogin && formatLastSeen(lastLogin) ? (
                          <span className="text-xs theme-text-muted">
                            {formatLastSeen(lastLogin)}
                          </span>
                        ) : null}
                      </>
                    )}
                    {!areFriends && selectedConversation && (
                      <button
                        onClick={() => handleSendFriendRequest(selectedConversation, conversations.find(c => c.user_id === selectedConversation)?.username)}
                        className="p-1 rounded-md theme-bg-tertiary theme-text-secondary hover:theme-bg-hover transition-colors"
                        title={t('privateMessages.sendFriendRequest') || 'Send friend request'}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-sm theme-text-secondary">{t('privateMessages.privateConversation') || 'Private conversation'}</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="theme-text-secondary">{t('privateMessages.noMessages') || 'No messages yet. Start the conversation!'}</p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-start space-x-3 ${
                        message.is_from_me ? 'justify-end' : ''
                      }`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          messageId: message.id,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                    >
                      {!message.is_from_me && (
                        <Avatar
                          userId={message.user_id}
                          username={message.sender_username}
                          size="sm"
                        />
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
                          <span className="text-white text-sm font-semibold">{t('common.you') || 'You'}</span>
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
                    placeholder={t('privateMessages.typeMessage') || 'Type a message...'}
                    className="w-full px-4 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                    disabled={sendingMessage}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!messageInput.trim() || sendingMessage}
                  className="px-4 py-2 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMessage ? <LoadingSpinner size="sm" /> : t('common.send') || 'Send'}
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
                {t('privateMessages.selectConversation') || 'Select a conversation'}
              </h3>
              <p className="theme-text-secondary">
                {t('privateMessages.chooseConversation') || 'Choose a conversation from the list to start messaging'}
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