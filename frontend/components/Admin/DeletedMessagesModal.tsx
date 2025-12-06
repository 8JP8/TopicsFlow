import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '../UI/LoadingSpinner';
import toast from 'react-hot-toast';
import Avatar from '../UI/Avatar';
import ImageViewerModal from '../UI/ImageViewerModal';
import VideoPlayer from '../UI/VideoPlayer';
import BanUserDialog from './BanUserDialog';
import WarnUserDialog from './WarnUserDialog';

interface DeletedMessage {
  _id: string;
  id: string;
  user_id: string;
  username: string;
  deleted_by: string;
  deleted_by_username: string;
  content: string;
  message_type: string;
  attachments?: Array<{
    type: string;
    file_id: string;
    url: string;
    filename: string;
    size: number;
    mime_type: string;
  }>;
  deletion_reason?: string;
  created_at: string;
  deleted_at: string;
  permanent_delete_at: string;
  topic_id?: string;
  chat_room_id?: string;
}

interface DeletedMessagesModalProps {
  onClose: () => void;
}

const DeletedMessagesModal: React.FC<DeletedMessagesModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<DeletedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<DeletedMessage | null>(null);
  const [viewingImage, setViewingImage] = useState<{ url: string; filename: string } | null>(null);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0, has_more: false });
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banUserId, setBanUserId] = useState<string>('');
  const [banUsername, setBanUsername] = useState<string>('');
  const [showWarnDialog, setShowWarnDialog] = useState(false);
  const [warnUserId, setWarnUserId] = useState<string>('');
  const [warnUsername, setWarnUsername] = useState<string>('');

  useEffect(() => {
    loadDeletedMessages();
  }, []);

  const loadDeletedMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.ADMIN.DELETED_MESSAGES, {
        params: { limit: pagination.limit, offset: pagination.offset }
      });
      
      if (response.data.success) {
        setMessages(response.data.data || []);
        setPagination(response.data.pagination || pagination);
      }
    } catch (error: any) {
      console.error('Failed to load deleted messages:', error);
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async (messageId: string) => {
    if (!confirm(t('admin.confirmPermanentDelete') || 'Are you sure you want to permanently delete this message? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.post(API_ENDPOINTS.ADMIN.PERMANENT_DELETE_MESSAGE(messageId));
      if (response.data.success) {
        toast.success(t('admin.messagePermanentlyDeleted') || 'Message permanently deleted');
        loadDeletedMessages();
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

  const handleBanUser = (userId: string, username: string) => {
    setBanUserId(userId);
    setBanUsername(username);
    setShowBanDialog(true);
  };

  const handleWarnUser = (userId: string, username: string) => {
    setWarnUserId(userId);
    setWarnUsername(username);
    setShowWarnDialog(true);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Two-column layout: list and details */}
          <div className="flex-1 overflow-hidden flex">
            {/* Messages List */}
            <div className={`${selectedMessage ? 'w-1/2' : 'w-full'} border-r border-gray-200 dark:border-gray-700 overflow-y-auto`}>
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold theme-text-primary">
                    {t('admin.deletedMessages') || 'Deleted Messages'} ({pagination.total})
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
                  {t('admin.deletedMessagesDesc') || 'Review deleted messages before they are permanently removed'}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="theme-text-secondary">{t('admin.noDeletedMessages') || 'No deleted messages'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {messages.map((message) => (
                      <button
                        key={message._id || message.id}
                        onClick={() => setSelectedMessage(message)}
                        className={`w-full p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                          selectedMessage?.id === message.id || selectedMessage?._id === message._id ? 'bg-gray-100 dark:bg-gray-700' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Avatar userId={message.user_id} username={message.username} size="sm" />
                            <div>
                              <div className="font-medium theme-text-primary">{message.username}</div>
                              <div className="text-xs theme-text-muted">
                                {t('admin.deletedBy') || 'Deleted by'}: {message.deleted_by_username || 'Unknown'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-xs theme-text-muted">
                            <div>{formatDate(message.deleted_at)}</div>
                            <div className="mt-1 font-semibold">
                              {t('admin.permanentDeleteIn') || 'Permanent delete in'}: {formatTimeRemaining(message.permanent_delete_at)}
                            </div>
                          </div>
                        </div>
                        {message.deletion_reason && (
                          <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900 rounded text-xs">
                            <strong>{t('admin.deletionReason') || 'Deletion Reason'}:</strong> {message.deletion_reason}
                          </div>
                        )}
                        <p className="text-sm theme-text-primary truncate">{message.content || '[No content]'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Message Details */}
            {selectedMessage && (
              <div className="w-1/2 overflow-y-auto p-6 border-l border-gray-200 dark:border-gray-700">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold theme-text-primary">
                    {t('admin.messageDetails') || 'Message Details'}
                  </h3>
                  <button
                    onClick={() => setSelectedMessage(null)}
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
                      {t('admin.user') || 'User'}
                    </label>
                    <div className="flex items-center gap-3 mt-1">
                      <Avatar userId={selectedMessage.user_id} username={selectedMessage.username} size="md" />
                      <div>
                        <p className="theme-text-primary font-medium">{selectedMessage.username}</p>
                        <p className="text-xs theme-text-muted">{selectedMessage.user_id}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.deletedBy') || 'Deleted by'}
                    </label>
                    <p className="theme-text-primary">{selectedMessage.deleted_by_username || 'Unknown'}</p>
                  </div>

                  {selectedMessage.deletion_reason && (
                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.deletionReason') || 'Deletion Reason'}
                      </label>
                      <div className="mt-1 p-3 bg-yellow-100 dark:bg-yellow-900 rounded">
                        <p className="theme-text-primary">{selectedMessage.deletion_reason}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.content') || 'Content'}
                    </label>
                    <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                      <p className="theme-text-primary whitespace-pre-wrap">{selectedMessage.content || '[No content]'}</p>
                    </div>
                  </div>

                  {/* Attachments */}
                  {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.attachments') || 'Attachments'} ({selectedMessage.attachments.length})
                      </label>
                      <div className="mt-2 space-y-2">
                        {selectedMessage.attachments.map((attachment, idx) => {
                          if (attachment.type === 'image') {
                            return (
                              <img
                                key={idx}
                                src={attachment.url}
                                alt={attachment.filename}
                                className="max-w-full rounded-lg cursor-pointer"
                                onClick={() => setViewingImage({ url: attachment.url, filename: attachment.filename })}
                              />
                            );
                          } else if (attachment.type === 'video') {
                            return (
                              <VideoPlayer
                                key={idx}
                                src={attachment.url}
                                filename={attachment.filename}
                                className="max-w-full"
                              />
                            );
                          } else {
                            return (
                              <div key={idx} className="p-3 bg-gray-200 dark:bg-gray-600 rounded">
                                <a href={attachment.url} download className="text-blue-600 dark:text-blue-400 hover:underline">
                                  {attachment.filename} ({(attachment.size / 1024).toFixed(2)} KB)
                                </a>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.createdAt') || 'Created'}
                      </label>
                      <p className="theme-text-primary">{formatDate(selectedMessage.created_at)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.deletedAt') || 'Deleted'}
                      </label>
                      <p className="theme-text-primary">{formatDate(selectedMessage.deleted_at)}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.permanentDeleteIn') || 'Permanent Delete In'}
                    </label>
                    <p className="theme-text-primary font-semibold text-lg">
                      {formatTimeRemaining(selectedMessage.permanent_delete_at)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 space-y-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handlePermanentDelete(selectedMessage._id || selectedMessage.id)}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    {t('admin.permanentDelete') || 'Permanent Delete'}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleWarnUser(selectedMessage.user_id, selectedMessage.username)}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                    >
                      {t('admin.warnUser') || 'Warn User'}
                    </button>
                    <button
                      onClick={() => handleBanUser(selectedMessage.user_id, selectedMessage.username)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      {t('admin.banUser') || 'Ban User'}
                    </button>
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewingImage && (
        <ImageViewerModal
          imageUrl={viewingImage.url}
          filename={viewingImage.filename}
          onClose={() => setViewingImage(null)}
        />
      )}

      {showBanDialog && (
        <BanUserDialog
          userId={banUserId}
          username={banUsername}
          onClose={() => {
            setShowBanDialog(false);
            loadDeletedMessages();
          }}
        />
      )}

      {showWarnDialog && (
        <WarnUserDialog
          reportId=""
          userId={warnUserId}
          username={warnUsername}
          onClose={() => {
            setShowWarnDialog(false);
            setWarnUserId('');
            setWarnUsername('');
          }}
          onSuccess={() => {
            loadDeletedMessages();
          }}
        />
      )}
    </>
  );
};

export default DeletedMessagesModal;

