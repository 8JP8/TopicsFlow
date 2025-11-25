import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { translate } from '@/utils/translations';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';
import LoadingSpinner from '../UI/LoadingSpinner';

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  theme_id: string;
  owner_id: string;
  owner_username?: string;
  member_count: number;
  message_count: number;
  is_public: boolean;
  created_at: string;
  last_activity: string;
}

interface ChatRoomListProps {
  themeId: string;
  onRoomSelect?: (room: ChatRoom) => void;
  selectedRoomId?: string;
}

const ChatRoomList: React.FC<ChatRoomListProps> = ({
  themeId,
  onRoomSelect,
  selectedRoomId,
}) => {
  const { t } = useLanguage();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRooms();
  }, [themeId]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.LIST_BY_THEME(themeId));

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
      return t('chat.online');
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}${t('posts.minutes')} ${t('posts.ago')}`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}${t('posts.hours')} ${t('posts.ago')}`;
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
          <Link
            key={room.id}
            href={`/theme/${themeId}/chat/${room.id}`}
            className={`
              block p-4 rounded-lg border border-gray-200 dark:border-gray-700
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
              ${selectedRoomId === room.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : ''}
            `}
            onClick={(e) => {
              if (onRoomSelect) {
                e.preventDefault();
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
                  <span>{room.member_count} {t('chatRooms.members')}</span>
                  <span>{room.message_count} {t('chatRooms.messages')}</span>
                  <span>{formatLastActivity(room.last_activity)}</span>
                </div>
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  );
};

export default ChatRoomList;


