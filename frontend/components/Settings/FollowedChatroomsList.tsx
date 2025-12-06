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

interface FollowedChatroomsListProps {
    limit?: number;
}

const FollowedChatroomsList: React.FC<FollowedChatroomsListProps> = ({ limit }) => {
    const { t } = useLanguage();
    const router = useRouter();
    const [chatrooms, setChatrooms] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFollowedChatrooms();
    }, []);

    const loadFollowedChatrooms = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/notification-settings/chat-rooms/followed');

            if (response.data.success) {
                setChatrooms(response.data.data || []);
            } else {
                setChatrooms([]);
            }
        } catch (error: any) {
            console.error('Failed to load followed chatrooms:', error);
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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="md" />
            </div>
        );
    }

    if (chatrooms.length === 0) {
        return (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                <p className="text-sm theme-text-primary mb-1">
                    {t('settings.noFollowedChatrooms') || 'No followed chatrooms'}
                </p>
                <p className="text-xs theme-text-secondary">
                    {t('settings.noFollowedChatroomsDesc') || 'You are not following any chatrooms yet.'}
                </p>
            </div>
        );
    }

    const displayedChatrooms = limit ? chatrooms.slice(0, limit) : chatrooms;

    return (
        <div className="space-y-3">
            {displayedChatrooms.map((chatroom) => (
                <div
                    key={chatroom.id}
                    className="p-4 rounded-lg border theme-border theme-bg-tertiary hover:theme-bg-hover transition-colors"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                            <h3 className="text-sm font-medium theme-text-primary mb-1 truncate">
                                {chatroom.name}
                            </h3>
                            {chatroom.description && (
                                <p className="text-xs theme-text-secondary mb-2 line-clamp-1">
                                    {chatroom.description}
                                </p>
                            )}
                            <div className="flex items-center space-x-3 text-xs theme-text-muted">
                                <span className="flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    {chatroom.member_count}
                                </span>
                                <span>•</span>
                                <span className="flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {formatLastActivity(chatroom.last_activity)}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                            <button
                                onClick={() => router.push(`/chat-room/${chatroom.id}`)}
                                className="px-3 py-1 text-xs btn btn-primary flex-1 justify-center"
                            >
                                {t('common.open') || 'Open'}
                            </button>
                            <button
                                onClick={() => handleUnfollow(chatroom.id)}
                                className="px-3 py-1 text-xs btn btn-secondary flex-1 justify-center"
                            >
                                {t('mute.unfollow') || 'Unfollow'}
                            </button>
                        </div>
                    </div>
                </div>
            ))}
            {limit && chatrooms.length > limit && (
                <div className="text-center pt-2">
                    <button
                        onClick={() => router.push('/settings?tab=followed-chatrooms')} // Assuming we might want a full tab later, or just show list
                        className="text-xs theme-text-link hover:underline"
                    >
                        {t('common.viewAll') || 'View All'} ({chatrooms.length})
                    </button>
                </div>
            )}
        </div>
    );
};

export default FollowedChatroomsList;
