import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../UI/LoadingSpinner';
import Avatar from '../UI/Avatar';

interface PendingDeletion {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  owner: {
    id: string;
    username: string;
  };
  deleted_by: string;
  deleted_at: string;
  permanent_delete_at: string;
  type: 'topic' | 'post' | 'chatroom';
}

interface PendingDeletionsModalProps {
  onClose: () => void;
}

const PendingDeletionsModal: React.FC<PendingDeletionsModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [deletions, setDeletions] = useState<PendingDeletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeletion, setSelectedDeletion] = useState<PendingDeletion | null>(null);

  const [lockDeletion, setLockDeletion] = useState(false);

  useEffect(() => {
    loadPendingDeletions();
  }, []);

  const loadPendingDeletions = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.ADMIN.PENDING_DELETIONS);
      if (response.data.success) {
        const allDeletions: PendingDeletion[] = [];

        // Add topics
        if (response.data.data.topics && Array.isArray(response.data.data.topics)) {
          response.data.data.topics.forEach((topic: any) => {
            allDeletions.push({
              id: topic.id || topic._id,
              title: topic.title,
              description: topic.description,
              owner: topic.owner || { id: topic.owner_id, username: 'Unknown' },
              deleted_by: topic.deleted_by || '',
              deleted_at: topic.deleted_at,
              permanent_delete_at: topic.permanent_delete_at,
              type: 'topic'
            });
          });
        }

        // Add posts
        if (response.data.data.posts && Array.isArray(response.data.data.posts)) {
          response.data.data.posts.forEach((post: any) => {
            allDeletions.push({
              id: post.id || post._id,
              title: post.title,
              description: post.content,
              owner: post.owner || { id: post.user_id, username: 'Unknown' },
              deleted_by: post.deleted_by || '',
              deleted_at: post.deleted_at,
              permanent_delete_at: post.permanent_delete_at,
              type: 'post'
            });
          });
        }

        // Add chatrooms
        if (response.data.data.chatrooms && Array.isArray(response.data.data.chatrooms)) {
          response.data.data.chatrooms.forEach((chatroom: any) => {
            allDeletions.push({
              id: chatroom.id || chatroom._id,
              name: chatroom.name,
              description: chatroom.description,
              owner: chatroom.owner || { id: chatroom.owner_id, username: 'Unknown' },
              deleted_by: chatroom.deleted_by || '',
              deleted_at: chatroom.deleted_at,
              permanent_delete_at: chatroom.permanent_delete_at,
              type: 'chatroom'
            });
          });
        }

        setDeletions(allDeletions);
      }
    } catch (error: any) {
      console.error('Failed to load pending deletions:', error);
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (deletion: PendingDeletion) => {
    try {
      let endpoint = '';
      if (deletion.type === 'topic') {
        endpoint = API_ENDPOINTS.ADMIN.APPROVE_TOPIC_DELETION(deletion.id);
      } else if (deletion.type === 'post') {
        endpoint = API_ENDPOINTS.ADMIN.APPROVE_POST_DELETION(deletion.id);
      } else if (deletion.type === 'chatroom') {
        endpoint = API_ENDPOINTS.ADMIN.APPROVE_CHATROOM_DELETION(deletion.id);
      } else {
        toast.error(t('errors.generic') || 'Unknown deletion type');
        return;
      }

      const response = await api.post(endpoint);
      if (response.data.success) {
        toast.success(t('admin.deletionApproved') || 'Deletion approved');
        loadPendingDeletions();
        setSelectedDeletion(null);
      } else {
        toast.error(response.data.errors?.[0] || t('errors.generic'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
  };

  const handleReject = async (deletion: PendingDeletion) => {
    try {
      let endpoint = '';
      if (deletion.type === 'topic') {
        endpoint = API_ENDPOINTS.ADMIN.REJECT_TOPIC_DELETION(deletion.id);
      } else if (deletion.type === 'post') {
        endpoint = API_ENDPOINTS.ADMIN.REJECT_POST_DELETION(deletion.id);
      } else if (deletion.type === 'chatroom') {
        endpoint = API_ENDPOINTS.ADMIN.REJECT_CHATROOM_DELETION(deletion.id);
      } else {
        toast.error(t('errors.generic') || 'Unknown deletion type');
        return;
      }

      const payload = deletion.type === 'post' ? { lock_deletion: lockDeletion } : {};
      const response = await api.post(endpoint, payload);
      if (response.data.success) {
        toast.success(t('admin.deletionRejected') || 'Deletion rejected and content restored');
        loadPendingDeletions();
        setSelectedDeletion(null);
      } else {
        toast.error(response.data.errors?.[0] || t('errors.generic'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
  };

  const formatTimeRemaining = (permanentDeleteAt: string) => {
    const now = new Date();
    const deleteAt = new Date(permanentDeleteAt);
    const diff = deleteAt.getTime() - now.getTime();

    if (diff <= 0) return t('admin.expired') || 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold theme-text-primary">
              {t('admin.pendingDeletions') || 'Pending Deletions'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm theme-text-secondary mt-2">
            {t('admin.pendingDeletionsDesc') || 'Review and approve or reject pending deletions'}
          </p>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Deletions List */}
          <div className={`${selectedDeletion ? 'w-1/2' : 'w-full'} border-r border-gray-200 dark:border-gray-700 overflow-y-auto`}>
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : deletions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="theme-text-secondary">{t('admin.noPendingDeletions') || 'No pending deletions'}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {deletions.map((deletion) => (
                    <button
                      key={deletion.id}
                      onClick={() => {
                        setSelectedDeletion(deletion);
                        setLockDeletion(false);
                      }}
                      className={`w-full p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${selectedDeletion?.id === deletion.id ? 'bg-gray-100 dark:bg-gray-700' : ''
                        }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Avatar userId={deletion.owner.id} username={deletion.owner.username} size="sm" />
                          <div>
                            <div className="font-medium theme-text-primary">
                              {deletion.title || deletion.name || t('admin.untitled') || 'Untitled'}
                            </div>
                            <div className="text-xs theme-text-muted">
                              {t('admin.type') || 'Type'}: {deletion.type === 'topic' ? (t('admin.deletionTypeTopic') || 'Topic') : deletion.type === 'post' ? (t('admin.deletionTypePost') || 'Post') : deletion.type === 'chatroom' ? (t('admin.deletionTypeChatroom') || 'Chatroom') : deletion.type}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-xs theme-text-muted">
                          <div>{formatDate(deletion.deleted_at)}</div>
                          <div className="mt-1 font-semibold">
                            {t('admin.permanentDeleteIn') || 'Permanent delete in'}: {formatTimeRemaining(deletion.permanent_delete_at)}
                          </div>
                        </div>
                      </div>
                      {deletion.description && (
                        <p className="text-sm theme-text-secondary truncate">{deletion.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Deletion Details */}
          {selectedDeletion && (
            <div className="w-1/2 overflow-y-auto p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold theme-text-primary">
                    {t('admin.deletionDetails') || 'Deletion Details'}
                  </h3>
                  <button
                    onClick={() => setSelectedDeletion(null)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.type') || 'Type'}
                    </label>
                    <p className="theme-text-primary">
                      {selectedDeletion.type === 'topic' ? (t('admin.deletionTypeTopic') || 'Topic') :
                        selectedDeletion.type === 'post' ? (t('admin.deletionTypePost') || 'Post') :
                          selectedDeletion.type === 'chatroom' ? (t('admin.deletionTypeChatroom') || 'Chatroom') :
                            selectedDeletion.type}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {selectedDeletion.type === 'topic' ? (t('topics.title') || 'Title') : (t('chat.name') || 'Name')}
                    </label>
                    <p className="theme-text-primary">{selectedDeletion.title || selectedDeletion.name || t('admin.untitled') || 'Untitled'}</p>
                  </div>

                  {selectedDeletion.description && (
                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('topics.description') || 'Description'}
                      </label>
                      <p className="theme-text-primary whitespace-pre-wrap">{selectedDeletion.description}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.owner') || 'Owner'}
                    </label>
                    <div className="flex items-center gap-3 mt-1">
                      <Avatar userId={selectedDeletion.owner.id} username={selectedDeletion.owner.username} size="md" />
                      <div>
                        <p className="theme-text-primary font-medium">{selectedDeletion.owner.username}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.deletedAt') || 'Deleted at'}
                      </label>
                      <p className="theme-text-primary">{formatDate(selectedDeletion.deleted_at)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.permanentDeleteIn') || 'Permanent Delete In'}
                      </label>
                      <p className="theme-text-primary font-semibold">
                        {formatTimeRemaining(selectedDeletion.permanent_delete_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lock Deletion Option */}
                {selectedDeletion.type === 'post' && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockDeletion}
                        onChange={(e) => setLockDeletion(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm theme-text-primary">
                        {t('admin.lockDeletion') || 'Prevent further removals (Lock Deletion)'}
                      </span>
                    </label>
                    <p className="text-xs theme-text-muted mt-1 ml-6">
                      {t('admin.lockDeletionDesc') || 'If checked, the owner will not be able to delete this content again.'}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 space-y-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleApprove(selectedDeletion)}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    {t('admin.approveDeletion') || 'Approve Deletion'}
                  </button>
                  <button
                    onClick={() => handleReject(selectedDeletion)}
                    className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                  >
                    {t('admin.rejectDeletion') || 'Reject Deletion & Restore'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingDeletionsModal;

