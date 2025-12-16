import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
    topic?: {
        id: string;
        title: string;
    };
    is_group_chat?: boolean;  // Flag from backend to distinguish group chats from topic chatrooms
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
    useEscapeKey(onClose);

    const [activeTab, setActiveTab] = useState<'chats' | 'topics'>('chats');
    const [chatInvitations, setChatInvitations] = useState<ChatInvitation[]>([]);
    const [topicInvitations, setTopicInvitations] = useState<TopicInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);

    // Resizable sidebar
    const [sidebarWidth, setSidebarWidth] = useState(320); // Default 320px (w-80 = 20rem = 320px)
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Selection state
    const [selectedChatCategory, setSelectedChatCategory] = useState<string>('groups'); // 'groups' or topic_id
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

    const fetchInvitations = useCallback(async () => {
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
                setTopicInvitations(topicRes.data.data || []);
            }

        } catch (error) {
            console.error('Failed to fetch invitations:', error);
            toast.error(t('invitations.failedToLoad') || 'Failed to load invitations');
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (isOpen) {
            fetchInvitations();
        }
    }, [isOpen, fetchInvitations]);

    // Listen for real-time updates
    useEffect(() => {
        const handleRefresh = () => {
            if (isOpen) {
                fetchInvitations();
            }
        };

        window.addEventListener('refresh_invitations', handleRefresh);
        return () => window.removeEventListener('refresh_invitations', handleRefresh);
    }, [isOpen, fetchInvitations]);

    // Grouping Logic for Chat Invites
    const { groupChatInvites, topicChatInvitesByTopic } = useMemo(() => {
        const groupChats: ChatInvitation[] = [];
        const topicChats: Record<string, { title: string, invites: ChatInvitation[] }> = {};

        chatInvitations.forEach(inv => {
            // Use is_group_chat flag from backend for reliable separation
            if (inv.is_group_chat || !inv.topic_id) {
                groupChats.push(inv);
            } else {
                if (!topicChats[inv.topic_id]) {
                    // Use provided topic title from backend
                    const title = inv.topic?.title || 'Unknown Topic';
                    topicChats[inv.topic_id] = { title, invites: [] };
                }
                topicChats[inv.topic_id].invites.push(inv);
            }
        });

        return { groupChatInvites: groupChats, topicChatInvitesByTopic: topicChats };
    }, [chatInvitations]);

    // Group topic invitations by topic for the sidebar
    const topicInvitationsByTopic = useMemo(() => {
        const grouped: Record<string, { title: string, invites: TopicInvitation[] }> = {};
        topicInvitations.forEach(inv => {
            if (!grouped[inv.topic_id]) {
                grouped[inv.topic_id] = {
                    title: inv.topic.title,
                    invites: []
                };
            }
            grouped[inv.topic_id].invites.push(inv);
        });
        return grouped;
    }, [topicInvitations]);

    // Derived list of invites to show in right column
    const displayedChatInvites = useMemo(() => {
        if (selectedChatCategory === 'groups') {
            return groupChatInvites;
        }
        return topicChatInvitesByTopic[selectedChatCategory]?.invites || [];
    }, [selectedChatCategory, groupChatInvites, topicChatInvitesByTopic]);

    const displayedTopicInvites = useMemo(() => {
        if (!selectedTopicFilter) return topicInvitations; // Show all if none selected
        return topicInvitationsByTopic[selectedTopicFilter]?.invites || [];
    }, [selectedTopicFilter, topicInvitations, topicInvitationsByTopic]);



    // Handlers (Accept/Decline) - Copied from Popup logic
    const handleAction = async (
        id: string,
        endpoint: (id: string) => string,
        onSuccess: () => void
    ) => {
        setProcessing(id);
        try {
            const response = await api.post(endpoint(id));
            if (response.data.success) {
                toast.success(t('invitations.accepted') || 'Success');
                onSuccess();
                onInvitationHandled?.();
            } else {
                toast.error(response.data.errors?.[0] || 'Failed');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.errors?.[0] || 'Failed');
        } finally {
            setProcessing(null);
        }
    };

    const handleAcceptChat = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        handleAction(id, API_ENDPOINTS.CHAT_ROOMS.ACCEPT_INVITATION, () => {
            setChatInvitations(prev => prev.filter(i => i.id !== id));
        });
    };

    const handleDeclineChat = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        handleAction(id, API_ENDPOINTS.CHAT_ROOMS.DECLINE_INVITATION, () => {
            setChatInvitations(prev => prev.filter(i => i.id !== id));
        });
    };

    const handleAcceptTopic = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        handleAction(id, API_ENDPOINTS.TOPICS.ACCEPT_INVITATION, () => {
            setTopicInvitations(prev => prev.filter(i => i.id !== id));
        });
    };

    const handleDeclineTopic = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        handleAction(id, API_ENDPOINTS.TOPICS.DECLINE_INVITATION, () => {
            setTopicInvitations(prev => prev.filter(i => i.id !== id));
        });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

    // Mouse event handlers for resizing
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = e.clientX - (sidebarRef.current?.getBoundingClientRect().left || 0);
            // Constrain width between 200px and 500px
            if (newWidth >= 200 && newWidth <= 500) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50 transition-opacity" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[600px] flex flex-col pointer-events-auto overflow-hidden border theme-border"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b theme-border bg-gray-50 dark:bg-gray-800/50">
                        <div>
                            <h2 className="text-xl font-bold theme-text-primary">{t('invitations.title') || 'Invitations'}</h2>
                            <p className="text-sm theme-text-secondary">{t('invitations.manage') || 'Manage your pending invitations'}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <svg className="w-5 h-5 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Sidebar (Left Column) */}
                        <div
                            ref={sidebarRef}
                            style={{ width: `${sidebarWidth}px` }}
                            className="border-r theme-border bg-gray-50/50 dark:bg-gray-800/30 flex flex-col relative"
                        >
                            {/* Tabs */}
                            <div className="flex p-2 gap-1 border-b theme-border">
                                <button
                                    onClick={() => setActiveTab('chats')}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'chats'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {t('invitations.chats') || 'Chats'}
                                    {chatInvitations.length > 0 && (
                                        <span className={`ml-2 text-xs px-1.5 rounded-full ${activeTab === 'chats' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                            {chatInvitations.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('topics')}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'topics'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {t('invitations.topics') || 'Topics'}
                                    {topicInvitations.length > 0 && (
                                        <span className={`ml-2 text-xs px-1.5 rounded-full ${activeTab === 'topics' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                            {topicInvitations.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Sidebar List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {loading ? (
                                    <div className="flex justify-center p-4"><LoadingSpinner size="sm" /></div>
                                ) : activeTab === 'chats' ? (
                                    <>
                                        {/* Group Invites Item */}
                                        <button
                                            onClick={() => setSelectedChatCategory('groups')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex justify-between items-center ${selectedChatCategory === 'groups'
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                }`}
                                        >
                                            <span className="font-medium">{t('invitations.groupInvites') || 'Group Chats'}</span>
                                            {groupChatInvites.length > 0 && <span className="bg-gray-200 dark:bg-gray-700 px-1.5 rounded text-xs">{groupChatInvites.length}</span>}
                                        </button>

                                        {/* Separator */}
                                        {Object.keys(topicChatInvitesByTopic).length > 0 && (
                                            <div className="my-2 border-t theme-border mx-2" />
                                        )}

                                        {/* Topic List */}
                                        {Object.entries(topicChatInvitesByTopic).map(([topicId, { title, invites }]) => (
                                            <button
                                                key={topicId}
                                                onClick={() => setSelectedChatCategory(topicId)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex justify-between items-center ${selectedChatCategory === topicId
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 theme-text-secondary'
                                                    }`}
                                            >
                                                <span className="truncate pr-2">Tópico #{title}</span>
                                                <span className="bg-gray-200 dark:bg-gray-700 px-1.5 rounded text-xs">{invites.length}</span>
                                            </button>
                                        ))}
                                    </>
                                ) : (
                                    // Topics Tab Sidebar
                                    <div className="space-y-1">
                                        {Object.keys(topicInvitationsByTopic).length === 0 ? (
                                            <div className="p-4 text-xs text-center theme-text-muted">{t('invitations.noTopicInvitations')}</div>
                                        ) : (
                                            Object.entries(topicInvitationsByTopic).map(([topicId, data]) => (
                                                <button
                                                    key={topicId}
                                                    onClick={() => setSelectedTopicFilter(curr => curr === topicId ? null : topicId)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex justify-between items-center ${selectedTopicFilter === topicId
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 theme-text-secondary'
                                                        }`}
                                                >
                                                    <span className="truncate pr-2">Tópico #{data.title}</span>
                                                    <span className="bg-gray-200 dark:bg-gray-700 px-1.5 rounded text-xs">{data.invites.length}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Resize Handle */}
                            <div
                                onMouseDown={handleMouseDown}
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors group"
                                style={{ zIndex: 10 }}
                            >
                            </div>
                        </div>

                        {/* Right Column (Content) */}
                        <div className="flex-1 bg-white dark:bg-gray-800 p-6 overflow-y-auto">
                            {activeTab === 'chats' ? (
                                <>
                                    <h3 className="text-lg font-bold theme-text-primary mb-4 flex items-center gap-2">
                                        {selectedChatCategory === 'groups' ? (
                                            <>{t('invitations.groupInvites')} <span className="text-sm font-normal theme-text-muted">({groupChatInvites.length} {t('invitations.pending') || 'Pending'})</span></>
                                        ) : (
                                            <>{t('invitations.invitesForTopicChats', { topic: topicChatInvitesByTopic[selectedChatCategory]?.title || 'Topic' }) || `Convites para Chats do Tópico #${topicChatInvitesByTopic[selectedChatCategory]?.title || 'Topic'}`} <span className="text-sm font-normal theme-text-muted">({(topicChatInvitesByTopic[selectedChatCategory]?.invites || []).length} {t('invitations.pending')})</span></>
                                        )}
                                    </h3>

                                    <div className="space-y-3">
                                        {displayedChatInvites.length === 0 ? (
                                            <div className="text-center py-12 text-gray-400">
                                                {t('invitations.noChatInvitations')}
                                            </div>
                                        ) : (
                                            displayedChatInvites.map(inv => (
                                                <div key={inv.id} className="p-4 rounded-xl border theme-border bg-gray-50 dark:bg-gray-800/50 hover:border-blue-300 transition-colors">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-1">
                                                            {inv.topic_id ? (
                                                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8H19C20.1046 8 21 8.89543 21 10V16C21 17.1046 20.1046 18 19 18H17V22L13 18H9C8.44772 18 7.94772 17.7761 7.58579 17.4142M7.58579 17.4142L11 14H15C16.1046 14 17 13.1046 17 12V6C17 4.89543 16.1046 4 15 4H5C3.89543 4 3 4.89543 3 6V12C3 13.1046 3.89543 14 5 14H7V18L7.58579 17.4142Z" />
                                                                </svg>
                                                            ) : (
                                                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="font-semibold theme-text-primary text-base">{inv.room_name}</h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Avatar userId={inv.invited_by.id} username={inv.invited_by.username} size="xs" />
                                                                <p className="text-sm text-gray-500">
                                                                    {t('invitations.invitedBy') || 'Invited by'} <span className="font-medium theme-text-primary">{inv.invited_by.username}</span> • {formatDate(inv.created_at)}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-3 mt-4">
                                                                <button
                                                                    onClick={(e) => handleAcceptChat(inv.id, e)}
                                                                    disabled={processing === inv.id}
                                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                                                >
                                                                    {t('invitations.accept') || 'Accept'}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeclineChat(inv.id, e)}
                                                                    disabled={processing === inv.id}
                                                                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                                                                >
                                                                    {t('invitations.decline') || 'Decline'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            ) : (
                                // Topic Invites Content
                                <>

                                    <h3 className="text-lg font-bold theme-text-primary mb-4">
                                        {selectedTopicFilter ? (
                                            <>{t('invitations.invitesForTopic', { topic: topicInvitationsByTopic[selectedTopicFilter]?.title }) || `Convites para o Tópico #${topicInvitationsByTopic[selectedTopicFilter]?.title}`} <span className="text-sm font-normal theme-text-muted">({(topicInvitationsByTopic[selectedTopicFilter]?.invites || []).length} {t('invitations.pending')})</span></>
                                        ) : (
                                            <>{t('invitations.topicInvites') || 'Convites para Tópicos'} <span className="text-sm font-normal theme-text-muted">({topicInvitations.length} {t('invitations.pending')})</span></>
                                        )}
                                    </h3>
                                    <div className="space-y-3">
                                        {displayedTopicInvites.length === 0 ? (
                                            <div className="text-center py-12 text-gray-400">
                                                {t('invitations.noTopicInvitations')}
                                            </div>
                                        ) : (
                                            displayedTopicInvites.map(inv => (
                                                <div key={inv.id} className="p-4 rounded-xl border theme-border bg-gray-50 dark:bg-gray-800/50 hover:border-blue-300 transition-colors">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-1">
                                                            <span className="w-10 h-10 flex items-center justify-center text-gray-400 text-3xl font-bold">#</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="font-semibold theme-text-primary text-base">{inv.topic.title}</h4>
                                                            <p className="text-xs text-gray-500 line-clamp-1 mb-2">{inv.topic.description}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Avatar userId={inv.inviter.id} username={inv.inviter.username} profilePicture={inv.inviter.profile_picture} size="xs" />
                                                                <p className="text-sm text-gray-500">
                                                                    {t('invitations.invitedBy') || 'Invited by'} <span className="font-medium theme-text-primary">{inv.inviter.username}</span> • {formatDate(inv.created_at)}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-3 mt-4">
                                                                <button
                                                                    onClick={(e) => handleAcceptTopic(inv.id, e)}
                                                                    disabled={processing === inv.id}
                                                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                                                                >
                                                                    {t('invitations.accept') || 'Accept'}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeclineTopic(inv.id, e)}
                                                                    disabled={processing === inv.id}
                                                                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                                                                >
                                                                    {t('invitations.decline') || 'Decline'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default InvitationsModal;
