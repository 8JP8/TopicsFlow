import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../UI/LoadingSpinner';
import useEscapeKey from '@/hooks/useEscapeKey';
import { Clock } from 'lucide-react';

interface SilencedItem {
    id: string;
    type: 'topic' | 'post' | 'chatroom'; // Removed 'user' as it's not currently supported by backend logic here
    name: string; // Username, Title, or Chatroom Name
    description?: string; // Content preview or descriptions
    topic_id?: string;
    topic_title?: string;
    silenced_at: string;
    silenced_until?: string | null; // Null means forever
    remaining_seconds?: number; // Optional, might be calculated
}

interface MutedItemsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MutedItemsModal: React.FC<MutedItemsModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    useEscapeKey(() => {
        if (isOpen) onClose();
    });
    const [silencedItems, setSilencedItems] = useState<SilencedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadSilencedItems();
        }
    }, [isOpen]);

    const loadSilencedItems = async () => {
        setLoading(true);
        try {
            const response = await api.get(API_ENDPOINTS.CONTENT_SETTINGS.SILENCED_ITEMS);
            if (response.data.success) {
                const data = response.data.data;
                // Backend now returns { items: [...], topics: [...], ... }
                // We want the flat 'items' list which has 'type' populated
                if (data && Array.isArray(data.items)) {
                    setSilencedItems(data.items);
                } else if (Array.isArray(data)) {
                    // Fallback for unexpected structure or old API
                    setSilencedItems(data);
                } else {
                    console.warn('Received unexpected data structure for silenced items:', data);
                    setSilencedItems([]);
                }
            }
        } catch (error) {
            console.error('Failed to load silenced items:', error);
            toast.error(t('errors.generic'));
        } finally {
            setLoading(false);
        }
    };

    const handleUnmute = async (item: SilencedItem) => {
        setProcessingId(item.id);
        try {
            let response;
            // Determine correct endpoint based on item type
            switch (item.type) {
                case 'topic':
                    response = await api.post(API_ENDPOINTS.TOPICS.UNSILENCE(item.id));
                    break;
                case 'post':
                    response = await api.post(API_ENDPOINTS.POSTS.UNSILENCE(item.id));
                    break;
                case 'chatroom':
                    response = await api.post(API_ENDPOINTS.MUTE.UNMUTE_CHAT_ROOM(item.id));
                    break;
                default:
                    toast.error('Unknown item type');
                    return;
            }

            if (response && response.data.success) {
                setSilencedItems(prev => prev.filter(i => i.id !== item.id));
                toast.success(t('mute.unsilenced'));
            }
        } catch (error) {
            // Check if response suggests already unmuted
            toast.error(t('errors.generic'));
        } finally {
            setProcessingId(null);
        }
    };

    const formatRemainingTime = (until: string | null | undefined) => {
        if (!until) return t('mute.forever') || 'Forever';
        const date = new Date(until);
        const now = new Date();
        if (date <= now) return t('mute.expired') || 'Expired';

        const diff = date.getTime() - now.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b theme-border">
                    <h2 className="text-xl font-bold theme-text-primary flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-volume-off-icon lucide-volume-off w-6 h-6">
                            <path d="M16 9a5 5 0 0 1 .95 2.293" />
                            <path d="M19.364 5.636a9 9 0 0 1 1.889 9.96" />
                            <path d="m2 2 20 20" />
                            <path d="m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11" />
                            <path d="M9.828 4.172A.686.686 0 0 1 11 4.657v.686" />
                        </svg>
                        {t('settings.mutedItems') || 'Muted Items'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors">
                        <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center py-8"><LoadingSpinner /></div>
                    ) : silencedItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-volume-off-icon lucide-volume-off w-12 h-12 mx-auto mb-3 opacity-50">
                                <path d="M16 9a5 5 0 0 1 .95 2.293" />
                                <path d="M19.364 5.636a9 9 0 0 1 1.889 9.96" />
                                <path d="m2 2 20 20" />
                                <path d="m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11" />
                                <path d="M9.828 4.172A.686.686 0 0 1 11 4.657v.686" />
                            </svg>
                            <p>{t('settings.noMutedItems') || 'No muted items found.'}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {silencedItems.map(item => (
                                <div key={`${item.type}-${item.id}`} className="p-3 rounded-lg border theme-border theme-bg-tertiary flex items-center justify-between">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full uppercase font-bold tracking-wider 
                            ${item.type === 'topic' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                    item.type === 'chatroom' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                                }`}>
                                                {item.type}
                                            </span>
                                            <h3 className="font-medium theme-text-primary truncate">{item.name}</h3>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs theme-text-muted">
                                            {item.topic_title && (
                                                <span className="flex items-center gap-1 font-medium bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                                    in {item.topic_title}
                                                </span>
                                            )}
                                            {item.silenced_until && (
                                                <span className="flex items-center gap-1 text-orange-500">
                                                    <Clock size={12} />
                                                    {formatRemainingTime(item.silenced_until)} remaining
                                                </span>
                                            )}
                                            {!item.silenced_until && <span>Indefinitely</span>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUnmute(item)}
                                        disabled={processingId === item.id}
                                        className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        {processingId === item.id ? <LoadingSpinner size="sm" /> : (t('common.unmute') || 'Unmute')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MutedItemsModal;
