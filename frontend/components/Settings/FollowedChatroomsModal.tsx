import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { useRouter } from 'next/router';

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  topic_id: string;
  topic_title?: string;
  member_count: number;
  message_count: number;
  last_activity: string;
}

interface FollowedChatroomsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FollowedChatroomsModal: React.FC<FollowedChatroomsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const router = useRouter();
  const [chatrooms, setChatrooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadFollowedChatrooms();
    }
  }, [isOpen]);

  const loadFollowedChatrooms = async () => {
    try {
      setLoading(true);
      // Note: This endpoint is now implemented in notification_settings.py
      const response = await api.get('/api/notification-settings/chat-rooms/followed');

      if (response.data.success) {
        setChatrooms(response.data.data || []);
      } else {
        // Fallback: show empty state
        setChatrooms([]);
      }
    } catch (error: any) {
      console.error('Failed to load followed chatrooms:', error);
      // If endpoint doesn't exist, show empty state
      setChatrooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (chatroomId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.NOTIFICATION_SETTINGS.UNFOLLOW_CHATROOM(chatroomId));
      if (response.data.success) {
        toast.success(t('mute.unfollowed', { name: 'Chatroom' }) || 'Chatroom unfollowed');
        setChatrooms(prev => prev.filter(c => c.id !== chatroomId));
      } else {
        toast.error(response.data.errors?.[0] || 'Failed to unfollow chatroom');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || 'Failed to unfollow chatroom');
    }
  };

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('notifications.justNow') || 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-gray-800 border theme-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b theme-border">
            <h2 className="text-xl font-bold theme-text-primary">
              {t('settings.followedChatrooms') || 'Followed Chatrooms'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
            >
              <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : chatrooms.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg theme-text-primary mb-2">
                  {t('settings.noFollowedChatrooms') || 'No followed chatrooms'}
                </p>
                <p className="text-sm theme-text-secondary">
                  {t('settings.noFollowedChatroomsDesc') || 'You are not following any chatrooms yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {chatrooms.map((chatroom) => (
                  <div
                    key={chatroom.id}
                    className="p-4 rounded-lg border theme-border theme-bg-tertiary hover:theme-bg-hover transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium theme-text-primary mb-1">
                          {chatroom.name}
                        </h3>
                        {chatroom.description && (
                          <p className="text-xs theme-text-secondary mb-2">
                            {chatroom.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 text-xs theme-text-muted">
                          <span>{chatroom.member_count} {t('chat.members') || 'members'}</span>
                          <span>•</span>
                          <span>{formatLastActivity(chatroom.last_activity)}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => router.push(`/chat-room/${chatroom.id}`)}
                          className="px-3 py-1 text-xs btn btn-primary"
                        >
                          {t('common.open') || 'Open'}
                        </button>
                        <button
                          onClick={() => handleUnfollow(chatroom.id)}
                          className="px-3 py-1 text-xs btn btn-secondary"
                        >
                          {t('mute.unfollow') || 'Unfollow'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FollowedChatroomsModal;

