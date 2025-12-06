import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import Avatar from '@/components/UI/Avatar';

interface ChatInvitation {
  id: string;
  room_id: string;
  room_name: string;
  room_description?: string;
  topic_id?: string;
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
  };
  inviter: {
    id: string;
    username: string;
    profile_picture?: string;
  };
  created_at: string;
}

interface InvitationsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onViewAll: () => void;
  onInvitationHandled?: () => void;
}

const InvitationsPopup: React.FC<InvitationsPopupProps> = ({
  isOpen,
  onClose,
  onViewAll,
  onInvitationHandled,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'chats' | 'topics'>('chats');
  const [chatInvitations, setChatInvitations] = useState<ChatInvitation[]>([]);
  const [topicInvitations, setTopicInvitations] = useState<TopicInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

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
        pending.sort((a: ChatInvitation, b: ChatInvitation) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setChatInvitations(pending);
      }

      if (topicRes.data.success) {
        const pending = (topicRes.data.data || []);
        // Backend sorts by created_at desc already, but good to ensure
        setTopicInvitations(pending);
      }

    } catch (error: any) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptChat = async (invitationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleDeclineChat = async (invitationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleAcceptTopic = async (invitationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleDeclineTopic = async (invitationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div className="absolute right-0 top-full mt-2 w-80 theme-bg-secondary border theme-border rounded-lg shadow-lg z-50 flex flex-col max-h-[500px]">
        {/* Header */}
        <div className="p-4 border-b theme-border">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold theme-text-primary">{t('invitations.title') || 'Invitations'}</h3>
            <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-full">
              {chatInvitations.length + topicInvitations.length} New
            </span>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'chats'
                ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
              {t('invitations.chats') || 'Chats'}
              {chatInvitations.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-[10px] rounded-full">
                  {chatInvitations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('topics')}
              className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'topics'
                ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
              {t('invitations.topics') || 'Topics'}
              {topicInvitations.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-[10px] rounded-full">
                  {topicInvitations.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-2 max-h-[350px]">
          {loading ? (
            <div className="flex justify-center p-8">
              <LoadingSpinner size="sm" />
            </div>
          ) : activeTab === 'chats' ? (
            chatInvitations.length === 0 ? (
              <div className="text-center py-8 px-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm font-medium theme-text-primary">{t('invitations.noChatInvitations') || 'No chat invitations'}</p>
              </div>
            ) : (
              chatInvitations.slice(0, 5).map((invitation) => (
                <div
                  key={invitation.id}
                  className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <Avatar
                        userId={invitation.invited_by.id}
                        username={invitation.invited_by.username}
                        size="sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm theme-text-primary font-medium truncate">
                        <span className="font-bold">{invitation.invited_by.username}</span> invited you
                      </p>
                      <p className="text-xs theme-text-secondary truncate mb-1">
                        to <span className="text-blue-500 dark:text-blue-400 font-medium whitespace-normal">{invitation.room_name}</span>
                      </p>
                      <p className="text-xs text-gray-400 mb-2">{formatDate(invitation.created_at)}</p>

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => handleAcceptChat(invitation.id, e)}
                          disabled={processing === invitation.id}
                          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {processing === invitation.id ? '...' : t('invitations.accept') || 'Accept'}
                        </button>
                        <button
                          onClick={(e) => handleDeclineChat(invitation.id, e)}
                          disabled={processing === invitation.id}
                          className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {processing === invitation.id ? '...' : t('invitations.decline') || 'Decline'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            topicInvitations.length === 0 ? (
              <div className="text-center py-8 px-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </div>
                <p className="text-sm font-medium theme-text-primary">{t('invitations.noTopicInvitations') || 'No topic invitations'}</p>
              </div>
            ) : (
              topicInvitations.slice(0, 5).map((invitation) => (
                <div
                  key={invitation.id}
                  className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <Avatar
                        userId={invitation.inviter.id}
                        username={invitation.inviter.username}
                        profilePicture={invitation.inviter.profile_picture} // Pass profile picture if available
                        size="sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm theme-text-primary font-medium truncate">
                        <span className="font-bold">{invitation.inviter.username}</span> invited you
                      </p>
                      <p className="text-xs theme-text-secondary truncate mb-1">
                        to topic <span className="text-purple-500 dark:text-purple-400 font-medium whitespace-normal">{invitation.topic.title}</span>
                      </p>
                      <p className="text-xs text-gray-400 mb-2">{formatDate(invitation.created_at)}</p>

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => handleAcceptTopic(invitation.id, e)}
                          disabled={processing === invitation.id}
                          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {processing === invitation.id ? '...' : t('invitations.accept') || 'Accept'}
                        </button>
                        <button
                          onClick={(e) => handleDeclineTopic(invitation.id, e)}
                          disabled={processing === invitation.id}
                          className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {processing === invitation.id ? '...' : t('invitations.decline') || 'Decline'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        <div className="p-3 border-t theme-border rounded-b-lg">
          <button
            onClick={onViewAll}
            className="w-full py-2 text-sm theme-text-link hover:underline font-medium text-center"
          >
            {t('invitations.viewAll') || 'View All Invitations'}
          </button>
        </div>
      </div>
    </>
  );
};

export default InvitationsPopup;
