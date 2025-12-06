import React, { useState } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import useEscapeKey from '@/hooks/useEscapeKey';

interface PostAdminModalProps {
    postId: string;
    currentStatus: 'open' | 'closed';
    currentReason?: string;
    onClose: () => void;
    onStatusUpdate: (status: 'open' | 'closed', reason?: string) => void;
}

const PostAdminModal: React.FC<PostAdminModalProps> = ({
    postId,
    currentStatus,
    currentReason,
    onClose,
    onStatusUpdate,
}) => {
    const { t } = useLanguage();


    const [status, setStatus] = useState<'open' | 'closed'>(currentStatus);
    const [reason, setReason] = useState(currentReason || '');
    const [loading, setLoading] = useState(false);

    useEscapeKey(onClose);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.put(API_ENDPOINTS.POSTS.UPDATE_STATUS(postId), {
                status,
                reason: status === 'closed' ? reason : undefined,
            });

            if (response.data.success) {
                toast.success(t('posts.statusUpdated') || 'Post status updated');
                onStatusUpdate(status, reason);
                onClose();
            } else {
                toast.error(response.data.errors?.[0] || t('errors.generic'));
            }
        } catch (error: any) {
            toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4 theme-text-primary">
                    {t('admin.managePost') || 'Manage Post'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium theme-text-secondary mb-1">
                            {t('admin.postStatus') || 'Post Status'}
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="status"
                                    value="open"
                                    checked={status === 'open'}
                                    onChange={() => setStatus('open')}
                                    className="theme-radio"
                                />
                                <span className="theme-text-primary">{t('admin.open') || 'Open'}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="status"
                                    value="closed"
                                    checked={status === 'closed'}
                                    onChange={() => setStatus('closed')}
                                    className="theme-radio"
                                />
                                <span className="theme-text-primary">{t('admin.closed') || 'Closed'}</span>
                            </label>
                        </div>
                    </div>

                    {status === 'closed' && (
                        <div>
                            <label className="block text-sm font-medium theme-text-secondary mb-1">
                                {t('admin.closureReason') || 'Closure Reason'}
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required={status === 'closed'}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 theme-bg-secondary theme-text-primary theme-border"
                                rows={3}
                                placeholder={t('admin.closureReasonPlaceholder') || 'Enter reason for closing this post...'}
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                            disabled={loading}
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? (t('common.saving') || 'Saving...') : (t('common.save') || 'Save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PostAdminModal;
