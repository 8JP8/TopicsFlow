import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import LoadingSpinner from '../UI/LoadingSpinner';
import { BellOff, MessageSquare, BookOpen, Bell } from 'lucide-react';
import useEscapeKey from '@/hooks/useEscapeKey';

interface FollowedPost {
    id: string;
    title: string;
    content: string;
    topic_id: string;
    author_username: string;
    created_at: string;
    followed_at: string;
    comment_count: number;
}

interface FollowedChatroom {
    id: string;
    name: string;
    description: string;
    topic_id: string;
    topic_title?: string;
    member_count: number;
    message_count: number;
    last_activity: string;
    type: 'group' | 'topic';
}

interface FollowedItemsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const FollowedItemsModal: React.FC<FollowedItemsModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const router = useRouter();
    useEscapeKey(() => {
        if (isOpen) onClose();
    });
    const [activeTab, setActiveTab] = useState<'publications' | 'chatrooms'>('publications');
    const [followedPosts, setFollowedPosts] = useState<FollowedPost[]>([]);
    const [followedChatrooms, setFollowedChatrooms] = useState<FollowedChatroom[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [postsResponse, chatroomsResponse] = await Promise.all([
                api.get(API_ENDPOINTS.NOTIFICATION_SETTINGS.FOLLOWED_POSTS),
                api.get('/api/notification-settings/chat-rooms/followed')
            ]);

            if (postsResponse.data.success) {
                setFollowedPosts(postsResponse.data.data || []);
            }
            if (chatroomsResponse.data.success) {
                setFollowedChatrooms(chatroomsResponse.data.data || []);
            }
        } catch (error) {
            console.error('Failed to load followed items:', error);
            toast.error(t('errors.generic'));
        } finally {
            setLoading(false);
        }
    };

    const handleUnfollowPost = async (postId: string) => {
        setProcessingId(postId);
        try {
            const response = await api.post(API_ENDPOINTS.NOTIFICATION_SETTINGS.UNFOLLOW_POST(postId));
            if (response.data.success) {
                setFollowedPosts(prev => prev.filter(p => p.id !== postId));
                toast.success(t('posts.unfollowed'));
            }
        } catch (error) {
            toast.error(t('posts.failedToUnfollow'));
        } finally {
            setProcessingId(null);
        }
    };

    const handleUnfollowChatroom = async (chatroomId: string) => {
        setProcessingId(chatroomId);
        try {
            const response = await api.post(API_ENDPOINTS.NOTIFICATION_SETTINGS.UNFOLLOW_CHATROOM(chatroomId));
            if (response.data.success) {
                setFollowedChatrooms(prev => prev.filter(c => c.id !== chatroomId));
                toast.success(t('mute.unfollowed', { name: 'Chatroom' }));
            }
        } catch (error) {
            toast.error(t('errors.generic'));
        } finally {
            setProcessingId(null);
        }
    };

    const formatLastActivity = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return t('notifications.justNow') || 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

    const groupedChatrooms = useMemo(() => {
        const groups: { [key: string]: FollowedChatroom[] } = {};
        followedChatrooms.forEach(room => {
            const topicName = room.topic_title || 'Other';
            if (!groups[topicName]) groups[topicName] = [];
            groups[topicName].push(room);
        });
        return groups;
    }, [followedChatrooms]);

    const groupedPosts = useMemo(() => {
        // Assuming posts might have topic info, if not we list them flat or by author maybe?
        // The interface has topic_id but maybe not topic_title. 
        // For now, let's just list them flat as per original modal, or group by author?
        // User request: "organize items by topic". 
        // If we don't have topic title, we might need to fetch it or just fallback.
        // Let's stick to flat list for posts for now unless we wanna fetch topic details.
        return followedPosts;
    }, [followedPosts]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b theme-border">
                    <h2 className="text-xl font-bold theme-text-primary flex items-center gap-2">
                        <Bell className="w-6 h-6" />
                        {t('settings.followedItems') || 'Followed Items'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors">
                        <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b theme-border">
                    <button
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'publications'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent theme-text-secondary hover:theme-text-primary'
                            }`}
                        onClick={() => setActiveTab('publications')}
                    >
                        <BookOpen size={18} />
                        {t('settings.publications') || 'Publications'}
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">
                            {followedPosts.length}
                        </span>
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'chatrooms'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent theme-text-secondary hover:theme-text-primary'
                            }`}
                        onClick={() => setActiveTab('chatrooms')}
                    >
                        <MessageSquare size={18} />
                        {t('settings.chatrooms') || 'Chatrooms'}
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">
                            {followedChatrooms.length}
                        </span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center py-8"><LoadingSpinner /></div>
                    ) : (
                        <>
                            {activeTab === 'publications' && (
                                followedPosts.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        {t('settings.noFollowedPublications')}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {followedPosts.map(post => (
                                            <div key={post.id} className="p-3 rounded-lg border theme-border theme-bg-tertiary flex justify-between items-start gap-3">
                                                <div
                                                    className="flex-1 cursor-pointer"
                                                    onClick={() => { onClose(); router.push(`/post/${post.id}`); }}
                                                >
                                                    <h3 className="font-medium theme-text-primary line-clamp-1 hover:underline">{post.title}</h3>
                                                    <p className="text-xs theme-text-secondary line-clamp-2 mt-1">{post.content}</p>
                                                    <div className="flex gap-3 mt-2 text-xs theme-text-muted">
                                                        <span>{post.author_username}</span>
                                                        <span>{post.comment_count} {t('comments.comments')}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleUnfollowPost(post.id)}
                                                    disabled={processingId === post.id}
                                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                    title={t('posts.unfollow')}
                                                >
                                                    {processingId === post.id ? <LoadingSpinner size="sm" /> : <BellOff size={18} />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {activeTab === 'chatrooms' && (
                                followedChatrooms.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        {t('settings.noFollowedChatrooms')}
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.entries(groupedChatrooms).map(([topicName, rooms]) => (
                                            <div key={topicName}>
                                                <h3 className="text-xs font-semibold theme-text-secondary uppercase tracking-wider mb-2 px-1">
                                                    {topicName}
                                                </h3>
                                                <div className="space-y-2">
                                                    {rooms.map(room => (
                                                        <div key={room.id} className="p-3 rounded-lg border theme-border theme-bg-tertiary flex justify-between items-center gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium theme-text-primary truncate">{room.name}</span>
                                                                    <span className="text-xs theme-text-muted flex-shrink-0">{formatLastActivity(room.last_activity)}</span>
                                                                </div>
                                                                <p className="text-xs theme-text-secondary truncate">{room.description}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => { onClose(); router.push(`/chat-room/${room.id}`); }}
                                                                    className="px-3 py-1 text-xs btn btn-primary"
                                                                >
                                                                    {t('common.open')}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUnfollowChatroom(room.id)}
                                                                    disabled={processingId === room.id}
                                                                    className="px-3 py-1 text-xs btn btn-secondary text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                >
                                                                    {processingId === room.id ? <LoadingSpinner size="sm" /> : t('mute.unfollow')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FollowedItemsModal;
