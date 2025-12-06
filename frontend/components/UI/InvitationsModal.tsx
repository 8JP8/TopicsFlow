import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import Avatar from './Avatar';
import useEscapeKey from '@/hooks/useEscapeKey';

interface ChatInvitation {
  id: string;
  room_id: string;
  room_name: string;
  room_description?: string;
  topic_id?: string;
  background_picture?: string;
  invited_by: {
    id: string;
    username: string;
  };
  created_at: string;
}

interface TopicInvitation {
  id: string;
  topic_id: string;
  topic: {
    id: string;
    title: string;
    description: string;
    member_count: number;
  };
  inviter: {
    id: string;
    username: string;
    profile_picture?: string;
  };
  created_at: string;
}

interface InvitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvitationHandled?: () => void;
}

const InvitationsModal: React.FC<InvitationsModalProps> = ({
  isOpen,
  onClose,
  onInvitationHandled,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'chats' | 'topics'>('chats');
  const [chatInvitations, setChatInvitations] = useState<ChatInvitation[]>([]);
  const [topicInvitations, setTopicInvitations] = useState<TopicInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);



  // Selected topic filter for chat invitations
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  useEscapeKey(onClose);

  useEffect(() => {
    if (isOpen) {
      fetchInvitations();
    }
  }, [isOpen]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const [chatRes, topicRes] = await Promise.all([
        api.get(API_ENDPOINTS.CHAT_ROOMS.GET_INVITATIONS),
        api.get(API_ENDPOINTS.TOPICS.GET_INVITATIONS)
      ]);

      if (chatRes.data.success) {
        const pending = (chatRes.data.data || []).filter((inv: any) => !inv.status || inv.status === 'pending');
        setChatInvitations(pending);
      }

      if (topicRes.data.success) {
        const pending = (topicRes.data.data || []);
        setTopicInvitations(pending);
      }

    } catch (error: any) {
      console.error('Failed to fetch invitations:', error);
      toast.error(error.response?.data?.errors?.[0] || t('invitations.failedToLoad') || 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptChat = async (invitationId: string, roomId: string) => {
    try {
      setProcessing(invitationId);
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.ACCEPT_INVITATION(invitationId));
      if (response.data.success) {
        toast.success(t('invitations.accepted') || 'Invitation accepted');
        setChatInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        onInvitationHandled?.();
      } else {
        toast.error(response.data.errors?.[0] || t('invitations.failedToAccept') || 'Failed to accept invitation');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('invitations.failedToAccept') || 'Failed to accept invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeclineChat = async (invitationId: string) => {
    try {
      setProcessing(invitationId);
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.DECLINE_INVITATION(invitationId));
      if (response.data.success) {
        toast.success(t('invitations.declined') || 'Invitation declined');
        setChatInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        onInvitationHandled?.();
      } else {
        toast.error(response.data.errors?.[0] || t('invitations.failedToDecline') || 'Failed to decline invitation');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('invitations.failedToDecline') || 'Failed to decline invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleAcceptTopic = async (invitationId: string) => {
    try {
      setProcessing(invitationId);
      const response = await api.post(API_ENDPOINTS.TOPICS.ACCEPT_INVITATION(invitationId));
      if (response.data.success) {
        toast.success(t('invitations.accepted') || 'Invitation accepted');
        setTopicInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        onInvitationHandled?.();
      } else {
        toast.error(response.data.errors?.[0] || t('invitations.failedToAccept') || 'Failed to accept invitation');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('invitations.failedToAccept') || 'Failed to accept invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeclineTopic = async (invitationId: string) => {
    try {
      setProcessing(invitationId);
      const response = await api.post(API_ENDPOINTS.TOPICS.DECLINE_INVITATION(invitationId));
      if (response.data.success) {
        toast.success(t('invitations.declined') || 'Invitation declined');
        setTopicInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        onInvitationHandled?.();
      } else {
        toast.error(response.data.errors?.[0] || t('invitations.failedToDecline') || 'Failed to decline invitation');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('invitations.failedToDecline') || 'Failed to decline invitation');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('notifications.justNow') || 'Just now';
    if (minutes < 60) return `${minutes} ${t('posts.minutes')} ${t('posts.ago')}`;
    if (hours < 24) return `${hours} ${t('posts.hours')} ${t('posts.ago')}`;
    if (days < 7) return `${days} ${t('posts.days')} ${t('posts.ago')}`;
    return date.toLocaleDateString();
  };

  // Group chat invitations by topic
  const groupedChatInvitations = React.useMemo(() => {
    const groups: Record<string, { topicName: string; invitations: ChatInvitation[] }> = {};
    chatInvitations.forEach((inv) => {
      // Use inv.topic_id if available, otherwise 'general' or 'unknown'
      const topicId = inv.topic_id || 'general';

      if (!groups[topicId]) {
        groups[topicId] = {
          // We might not have topic name in invitation data efficiently, 
          // but strictly following requirement "topics that the chatrooms im invited too belong"
          // Ideally backend sends topic_title. If not, we fallback.
          topicName: (inv as any).topic_title || (topicId === 'general' ? (t('common.general') || 'General') : `Topic ${topicId.substring(0, 8)}...`),
          invitations: [],
        };
      }
      groups[topicId].invitations.push(inv);
    });
    return groups;
  }, [chatInvitations, t]);

  const groupKeys = Object.keys(groupedChatInvitations);

  // Auto-select first topic group when in 'chats' tab
  useEffect(() => {
    if (activeTab === 'chats' && groupKeys.length > 0 && !selectedTopicId) {
      setSelectedTopicId(groupKeys[0]);
    }
  }, [activeTab, groupKeys, selectedTopicId]);

  if (!isOpen) return null;

  const activeChatGroup = selectedTopicId ? groupedChatInvitations[selectedTopicId] : null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-gray-800 border theme-border rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col pointer-events-auto overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b theme-border bg-gray-50 dark:bg-gray-800/50">
            <div>
              <h2 className="text-xl font-bold theme-text-primary">
                {t('invitations.title') || 'Invitations'}
              </h2>
              <p className="text-sm theme-text-secondary">
                {t('invitations.manage') || 'Manage your pending invitations'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b theme-border bg-white dark:bg-gray-800 px-6">
            <button
              onClick={() => setActiveTab('chats')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'chats'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
              {t('invitations.chats') || 'Chat Invitations'}
              {chatInvitations.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'chats' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                  {chatInvitations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('topics')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'topics'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
              {t('invitations.topics') || 'Topic Invitations'}
              {topicInvitations.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'topics' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                  {topicInvitations.length}
                </span>
              )}
            </button>
          </div>

          {/* Content Area */}
          <div className="flex flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900/50">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              activeTab === 'chats' ? (
                // CHATS VIEW (2-Column)
                <div className="flex w-full h-full">
                  {/* Left Column: Topics List */}
                  <div className="w-1/3 border-r theme-border overflow-y-auto bg-white dark:bg-gray-800 p-2 space-y-1">
                    {groupKeys.length === 0 ? (
                      <div className="p-4 text-center text-gray-400">
                        <p className="text-sm italic">{t('invitations.noChatInvitations') || 'No chat invitations'}</p>
                      </div>
                    ) : (
                      groupKeys.map(key => (
                        <button
                          key={key}
                          onClick={() => setSelectedTopicId(key)}
                          className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors flex justify-between items-center ${selectedTopicId === key
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-100 dark:border-blue-900'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
                            }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            {/* Minimalist Icon Style - No background circle */}
                            <svg className={`w-4 h-4 flex-shrink-0 ${selectedTopicId === key ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                            </svg>
                            <span className="truncate">{groupedChatInvitations[key].topicName}</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${selectedTopicId === key ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {groupedChatInvitations[key].invitations.length}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Right Column: Invitations List */}
                  <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50">
                    {!activeChatGroup ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        {/* Minimalist Empty State Icon */}
                        <svg className="w-16 h-16 mb-4 opacity-50 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p>{t('invitations.selectTopic') || 'Select a topic to view invitations'}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold theme-text-primary flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                            </svg>
                            {activeChatGroup.topicName}
                          </h3>
                          <span className="text-sm text-gray-500">
                            {activeChatGroup.invitations.length} {t('invitations.pending') || 'pending'}
                          </span>
                        </div>

                        {activeChatGroup.invitations.map((invitation) => (
                          <div
                            key={invitation.id}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border theme-border overflow-hidden hover:shadow-md transition-shadow"
                          >
                            <div className="p-4">
                              <div className="flex items-start gap-4">
                                {/* Room Icon - Minimalist */}
                                <div className="flex-shrink-0 pt-1">
                                  {invitation.background_picture ? (
                                    <img
                                      src={invitation.background_picture}
                                      alt={invitation.room_name}
                                      className="w-10 h-10 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                                    </svg>
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="text-lg font-semibold theme-text-primary mb-1">
                                        {invitation.room_name}
                                      </h4>
                                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                                        <Avatar
                                          userId={invitation.invited_by.id}
                                          username={invitation.invited_by.username}
                                          size="sm"
                                        />
                                        <span>
                                          Invited by <span className="font-medium text-gray-700 dark:text-gray-300">{invitation.invited_by.username}</span>
                                        </span>
                                        <span>•</span>
                                        <span>{formatDate(invitation.created_at)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {invitation.room_description && (
                                    <p className="text-sm theme-text-secondary mb-4 line-clamp-2">
                                      {invitation.room_description}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => handleAcceptChat(invitation.id, invitation.room_id)}
                                      disabled={processing === invitation.id}
                                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                                    >
                                      {processing === invitation.id ? <LoadingSpinner size="sm" /> : (t('invitations.accept') || 'Accept')}
                                    </button>
                                    <button
                                      onClick={() => handleDeclineChat(invitation.id)}
                                      disabled={processing === invitation.id}
                                      className="theme-text-secondary hover:text-red-500 px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                                    >
                                      {processing === invitation.id ? <LoadingSpinner size="sm" /> : (t('invitations.decline') || 'Decline')}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // TOPICS VIEW (Single Column Grid/List)
                <div className="w-full h-full overflow-y-auto p-6">
                  {topicInvitations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <svg className="w-16 h-16 mb-4 opacity-50 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      <p>{t('invitations.noTopicInvitations') || 'No topic invitations'}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {topicInvitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border theme-border p-5 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {/* Minimalist Topic Icon */}
                              <svg className="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                              </svg>
                              <div>
                                <h3 className="font-bold theme-text-primary text-lg">
                                  {invitation.topic.title}
                                </h3>
                                <p className="text-xs theme-text-secondary">
                                  {invitation.topic.member_count} {t('common.members') || 'members'}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                              {formatDate(invitation.created_at)}
                            </span>
                          </div>

                          {invitation.topic.description && (
                            <p className="text-sm theme-text-secondary mb-4 line-clamp-2">
                              {invitation.topic.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mb-4 text-xs theme-text-muted bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg">
                            <Avatar
                              userId={invitation.inviter.id}
                              username={invitation.inviter.username}
                              profilePicture={invitation.inviter.profile_picture}
                              size="sm"
                            />
                            <span>
                              Invited by <span className="font-medium">{invitation.inviter.username}</span>
                            </span>
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAcceptTopic(invitation.id)}
                              disabled={processing === invitation.id}
                              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center"
                            >
                              {processing === invitation.id ? <LoadingSpinner size="sm" /> : (t('invitations.accept') || 'Accept')}
                            </button>
                            <button
                              onClick={() => handleDeclineTopic(invitation.id)}
                              disabled={processing === invitation.id}
                              className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex justify-center items-center"
                            >
                              {processing === invitation.id ? <LoadingSpinner size="sm" /> : (t('invitations.decline') || 'Decline')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default InvitationsModal;

