import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import Avatar from './Avatar';

// LocalStorage utilities
const DISMISSED_INVITATIONS_KEY = 'dismissed_invitations';

const getDismissedInvitations = (): Set<string> => {
    try {
        const stored = localStorage.getItem(DISMISSED_INVITATIONS_KEY);
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
        return new Set();
    }
};

const dismissInvitation = (invitationId: string) => {
    const dismissed = getDismissedInvitations();
    dismissed.add(invitationId);
    localStorage.setItem(DISMISSED_INVITATIONS_KEY, JSON.stringify(Array.from(dismissed)));
};

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

            const dismissedIds = getDismissedInvitations();

            if (chatRes.data.success) {
                let pending = (chatRes.data.data || []).filter((inv: any) => !inv.status || inv.status === 'pending');
                // Filter out dismissed invitations
                pending = pending.filter((inv: ChatInvitation) => !dismissedIds.has(inv.id));
                pending.sort((a: ChatInvitation, b: ChatInvitation) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setChatInvitations(pending);
            }

            if (topicRes.data.success) {
                let pending = (topicRes.data.data || []);
                // Filter out dismissed invitations
                pending = pending.filter((inv: TopicInvitation) => !dismissedIds.has(inv.id));
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
                // Trigger refresh of chat list
                window.dispatchEvent(new Event('refresh-chats'));
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
                // Trigger refresh of topic list
                window.dispatchEvent(new Event('refresh-topics'));
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

    const handleDismissChat = (invitationId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        dismissInvitation(invitationId);
        setChatInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        onInvitationHandled?.();
    };

    const handleDismissTopic = (invitationId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        dismissInvitation(invitationId);
        setTopicInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        onInvitationHandled?.();
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
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold theme-text-primary">{t('invitations.title') || 'Invitations'}</h3>
                        <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-full">
                            {chatInvitations.length + topicInvitations.length} {(chatInvitations.length + topicInvitations.length === 1) ? t('invitations.pending') || 'Pending' : t('invitations.pendingPlural') || 'Pending'}
                        </span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 mx-4 mt-3 mb-2 p-1 rounded-lg border theme-border relative">
                    {/* Animated sliding indicator */}
                    <div
                        className={`absolute top-1 bottom-1 w-[calc(50%-0.375rem)] bg-white dark:bg-neutral-700 rounded-md shadow-sm transition-all duration-300 ease-in-out ${activeTab === 'chats' ? 'left-1' : 'left-[calc(50%+0.125rem)]'
                            }`}
                    />
                    <button
                        onClick={() => setActiveTab('chats')}
                        className={`flex-1 py-1 text-xs font-medium rounded-md transition-all relative z-10 ${activeTab === 'chats'
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                    >
                        {t('invitations.chats') || 'Chats'}
                    </button>
                    <button
                        onClick={() => setActiveTab('topics')}
                        className={`flex-1 py-1 text-xs font-medium rounded-md transition-all relative z-10 ${activeTab === 'topics'
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                    >
                        {t('invitations.topics') || 'Topics'}
                    </button>
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
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8H19C20.1046 8 21 8.89543 21 10V16C21 17.1046 20.1046 18 19 18H17V22L13 18H9C8.44772 18 7.94772 17.7761 7.58579 17.4142M7.58579 17.4142L11 14H15C16.1046 14 17 13.1046 17 12V6C17 4.89543 16.1046 4 15 4H5C3.89543 4 3 4.89543 3 6V12C3 13.1046 3.89543 14 5 14H7V18L7.58579 17.4142Z" />
                                    </svg>
                                </div>
                                <p className="text-sm font-medium theme-text-primary">{t('invitations.noChatInvitations') || 'No chat invitations'}</p>
                            </div>
                        ) : (
                            chatInvitations.slice(0, 5).map((invitation) => (
                                <div
                                    key={invitation.id}
                                    className="relative group rounded-lg border theme-border hover:shadow-md transition-all duration-200 overflow-hidden mb-2"
                                >
                                    <div className="px-4 py-4">
                                        <div className="flex gap-4 items-start">
                                            <div className="flex-shrink-0">
                                                <Avatar
                                                    userId={invitation.invited_by.id}
                                                    username={invitation.invited_by.username}
                                                    size="lg"
                                                    className="w-12 h-12"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm theme-text-primary font-medium leading-snug mb-1">
                                                    <span className="font-semibold">{invitation.invited_by.username}</span>
                                                    {' '}{t('invitations.invitedYou') || 'invited you'}
                                                </p>
                                                <p className="text-sm theme-text-secondary mb-1">
                                                    {t('invitations.to') || 'to'}{' '}
                                                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                                        {invitation.room_name}
                                                    </span>
                                                </p>
                                                {invitation.room_description && (
                                                    <p className="text-xs theme-text-muted line-clamp-1 mb-2">{invitation.room_description}</p>
                                                )}
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                                                    {formatDate(invitation.created_at)}
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => handleAcceptChat(invitation.id, e)}
                                                        disabled={processing === invitation.id}
                                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                    >
                                                        {processing === invitation.id ? '...' : t('invitations.accept') || 'Accept'}
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeclineChat(invitation.id, e)}
                                                        disabled={processing === invitation.id}
                                                        className="flex-1 px-4 py-2 theme-bg-tertiary hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-primary text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {processing === invitation.id ? '...' : t('invitations.decline') || 'Decline'}
                                                    </button>
                                                </div>
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
                                    className="relative group rounded-lg border theme-border hover:shadow-md transition-all duration-200 overflow-hidden mb-2"
                                >
                                    <div className="px-4 py-4">
                                        <div className="flex gap-4 items-start">
                                            <div className="flex-shrink-0">
                                                <Avatar
                                                    userId={invitation.inviter.id}
                                                    username={invitation.inviter.username}
                                                    profilePicture={invitation.inviter.profile_picture}
                                                    size="lg"
                                                    className="w-12 h-12"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm theme-text-primary font-medium leading-snug mb-1">
                                                    <span className="font-semibold">{invitation.inviter.username}</span>
                                                    {' '}{t('invitations.invitedYou') || 'invited you'}
                                                </p>
                                                <p className="text-sm theme-text-secondary mb-1">
                                                    {t('invitations.to') || 'to'}{' '}
                                                    <span className="text-purple-600 dark:text-purple-400 font-semibold">
                                                        {invitation.topic.title}
                                                    </span>
                                                </p>
                                                {invitation.topic.description && (
                                                    <p className="text-xs theme-text-muted line-clamp-1 mb-2">{invitation.topic.description}</p>
                                                )}
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                                                    {formatDate(invitation.created_at)}
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => handleAcceptTopic(invitation.id, e)}
                                                        disabled={processing === invitation.id}
                                                        className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                    >
                                                        {processing === invitation.id ? '...' : t('invitations.accept') || 'Accept'}
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeclineTopic(invitation.id, e)}
                                                        disabled={processing === invitation.id}
                                                        className="flex-1 px-4 py-2 theme-bg-tertiary hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-primary text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {processing === invitation.id ? '...' : t('invitations.decline') || 'Decline'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>

                <div className="p-3 border-t theme-border bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
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
