import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { translate } from '@/utils/translations';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '../UI/LoadingSpinner';

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  topic_id: string;
  owner_id: string;
  owner_username?: string;
  member_count: number;
  message_count: number;
  is_public: boolean;
  created_at: string;
  last_activity: string;
}

interface ChatRoomListProps {
  topicId: string;
  onRoomSelect?: (room: ChatRoom) => void;
  selectedRoomId?: string;
}

const ChatRoomList: React.FC<ChatRoomListProps> = ({
  topicId,
  onRoomSelect,
  selectedRoomId,
}) => {
  const { t } = useLanguage();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRooms();
  }, [topicId]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.LIST_BY_TOPIC(topicId));

      if (response.data.success) {
        setRooms(response.data.data || []);
      } else {
        toast.error(response.data.errors?.[0] || translate('chatRooms.failedToCreateRoom'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || translate('chatRooms.failedToCreateRoom');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60 * 1000) {
      return t('notifications.justNow') || 'Just now';
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))} ${t('posts.minutes')} ${t('posts.ago')}`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))} ${t('posts.hours')} ${t('posts.ago')}`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rooms.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>{t('chatRooms.noChatRooms')}</p>
        </div>
      ) : (
        rooms.map(room => (
          <button
            key={room.id}
            className={`
              block w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
              ${selectedRoomId === room.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : ''}
            `}
            onClick={(e) => {
              e.preventDefault();
              if (onRoomSelect) {
                onRoomSelect(room);
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {room.name}
                  </h3>
                  {!room.is_public && (
                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
                      {t('chatRooms.private')}
                    </span>
                  )}
                </div>
                {room.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {room.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {room.is_public ? (t('chatRooms.public') || 'Public') : `${room.member_count} ${t('chatRooms.members')}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    {room.message_count} {t('chatRooms.messages')}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatLastActivity(room.last_activity)}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );
};

export default ChatRoomList;





