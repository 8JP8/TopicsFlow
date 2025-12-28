import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { getReportReasons, ReportReason, ReportType } from '@/utils/reportUtils';

interface ReportUserDialogProps {
  userId?: string;
  username?: string;
  contentId?: string;
  contentType?: 'message' | 'post' | 'comment' | 'chatroom' | 'chatroom_background' | 'chatroom_picture' | 'user' | 'topic';
  onClose: () => void;
  includeMessageHistory?: boolean;
  currentMessageId?: string;
  chatRoomId?: string;
  messageId?: string;
  ownerId?: string;
  ownerUsername?: string;
  moderators?: Array<{ id: string, username: string }>;
  topicId?: string;
}

const ReportUserDialog: React.FC<ReportUserDialogProps> = ({
  userId,
  username,
  contentId,
  contentType,
  onClose,
  includeMessageHistory = false,
  currentMessageId,
  chatRoomId,
  messageId,
  ownerId,
  ownerUsername,
  moderators = [],
  topicId,
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    report_type: (contentId ? 'content' : 'user') as ReportType,
    reason: '' as ReportReason,
    description: '',
    attachCurrentMessage: false,
    attachMessageHistory: false,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [canReport, setCanReport] = useState(true);

  // Check if user is trying to report themselves
  useEffect(() => {
    if (!user) {
      setCanReport(false);
      return;
    }

    // For user reports
    if (userId && userId === user.id) {
      setCanReport(false);
      return;
    }

    // For content reports, we need to check if the content author is the current user
    // This will be checked on submit, but we can disable the button if we know the user_id matches
    if (contentId && userId && userId === user.id) {
      setCanReport(false);
      return;
    }

    // For chatroom reports, check if user is the owner
    if (contentType && contentType.startsWith('chatroom') && ownerId && ownerId === user.id) {
      setCanReport(false);
      return;
    }

    setCanReport(true);
  }, [user, userId, contentId, contentType, ownerId]);

  // Get context-specific report reasons
  const getContextReasons = (): Array<{ value: ReportReason; label: string }> => {
    const allReasons = getReportReasons();

    if (contentType === 'topic') {
      return [
        { value: 'hate_speech', label: t('reports.reason_hate_speech') || 'Hate Speech' },
        { value: 'inappropriate_content', label: t('reports.reason_inappropriate_content') || 'Inappropriate Content' },
        { value: 'spam', label: t('reports.reason_spam') || 'Spam' },
        { value: 'misinformation', label: t('reports.reason_misinformation') || 'Misinformation' },
        { value: 'violence', label: t('reports.reason_violence') || 'Violence' },
        { value: 'other', label: t('reports.reason_other') || 'Other' },
      ];
    } else if (contentType === 'chatroom' || contentType === 'chatroom_background' || contentType === 'chatroom_picture') {
      // Chatroom-specific reasons
      return [
        { value: 'hate_speech', label: t('reports.reason_hate_speech') || 'Hate Speech / Racial Content' },
        { value: 'violence', label: t('reports.reason_violence') || 'Terrorism / Violence' },
        { value: 'inappropriate_content', label: t('reports.reason_inappropriate_content') || 'Inappropriate Content' },
        { value: 'spam', label: t('reports.reason_spam') || 'Spam' },
        { value: 'other', label: t('reports.reason_other') || 'Other' },
      ];
    } else if (contentType === 'post') {
      // Post-specific reasons
      return [
        { value: 'hate_speech', label: t('reports.reason_hate_speech') || 'Hate Speech / Racial Slurs' },
        { value: 'inappropriate_content', label: t('reports.reason_inappropriate_content') || 'Content Violation' },
        { value: 'misinformation', label: t('reports.reason_misinformation') || 'Misinformation' },
        { value: 'spam', label: t('reports.reason_spam') || 'Spam' },
        { value: 'violence', label: t('reports.reason_violence') || 'Violence' },
        { value: 'sexual_content', label: t('reports.reason_sexual_content') || 'Sexual Content' },
        { value: 'other', label: t('reports.reason_other') || 'Other' },
      ];
    } else if (contentType === 'comment') {
      // Comment-specific reasons
      return [
        { value: 'harassment', label: t('reports.reason_harassment') || 'Harassment' },
        { value: 'hate_speech', label: t('reports.reason_hate_speech') || 'Hate Speech' },
        { value: 'spam', label: t('reports.reason_spam') || 'Spam' },
        { value: 'inappropriate_content', label: t('reports.reason_inappropriate_content') || 'Inappropriate Content' },
        { value: 'other', label: t('reports.reason_other') || 'Other' },
      ];
    } else if (contentType === 'user') {
      // User behavior reasons
      return [
        { value: 'harassment', label: t('reports.reason_harassment') || 'Harassment' },
        { value: 'hate_speech', label: t('reports.reason_hate_speech') || 'Hate Speech' },
        { value: 'spam', label: t('reports.reason_spam') || 'Spam' },
        { value: 'inappropriate_content', label: t('reports.reason_inappropriate_content') || 'Inappropriate Behavior' },
        { value: 'impersonation', label: t('reports.reason_impersonation') || 'Impersonation' },
        { value: 'other', label: t('reports.reason_other') || 'Other' },
      ];
    }

    return allReasons;
  };

  const reportReasons = getContextReasons();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const validateForm = () => {
    const newErrors: string[] = [];

    if (!formData.reason) {
      newErrors.push(t('reports.reasonRequired') || 'Please select a reason');
    }

    if (!formData.description.trim()) {
      newErrors.push(t('reports.descriptionRequired') || 'Please provide a description');
    } else if (formData.description.trim().length < 10) {
      newErrors.push(t('reports.descriptionTooShort') || 'Description must be at least 10 characters');
    } else if (formData.description.trim().length > 1000) {
      newErrors.push(t('reports.descriptionTooLong') || 'Description must be less than 1000 characters');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      // Final check: prevent reporting yourself
      if (user && userId && userId === user.id) {
        setErrors([t('reports.cannotReportYourself') || 'You cannot report yourself']);
        return;
      }

      if (user && contentType && contentType.startsWith('chatroom') && ownerId && ownerId === user.id) {
        setErrors([t('reports.cannotReportYourself') || 'You cannot report your own chatroom']);
        return;
      }

      const reportData: any = {
        report_type: formData.report_type,
        reason: formData.reason,
        description: formData.description.trim(),
        reported_user_id: userId,
        content_id: contentId,
        content_type: contentType,
        owner_id: ownerId,
        owner_username: ownerUsername,
        moderators: moderators || [],
        topic_id: topicId,
      };

      // Add message attachment options if available
      if (includeMessageHistory && userId) {
        reportData.attach_current_message = formData.attachCurrentMessage;
        reportData.attach_message_history = formData.attachMessageHistory;
        if (currentMessageId || messageId) {
          reportData.current_message_id = currentMessageId || messageId;
        }
        if (chatRoomId) {
          reportData.chat_room_id = chatRoomId;
        }
      }

      // If reporting user from message, use the message report endpoint
      let response;
      if (messageId && userId) {
        response = await api.post(API_ENDPOINTS.MESSAGES.REPORT_USER(messageId), {
          reason: formData.reason,
          description: formData.description.trim(),
        });
      } else {
        // Use general reports endpoint
        response = await api.post(API_ENDPOINTS.REPORTS.CREATE, reportData);
      }

      if (response.data.success) {
        toast.success(t('reports.reportSubmitted') || 'Report submitted successfully');
        onClose();
      } else {
        setErrors(response.data.errors || [t('reports.reportFailed') || 'Failed to submit report']);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.errors ||
        error.response?.data?.message ||
        t('reports.reportFailed') ||
        'Failed to submit report';
      setErrors(Array.isArray(errorMessage) ? errorMessage : [errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold theme-text-primary">
              {contentType === 'chatroom' || contentType === 'chatroom_background' || contentType === 'chatroom_picture'
                ? (t('reports.reportChatroom') || 'Report Chatroom')
                : contentType === 'topic'
                  ? (t('reports.reportTopic') || 'Report Topic')
                  : contentType === 'post'
                    ? (t('reports.reportPost') || 'Report Post')
                    : contentType === 'comment'
                      ? (t('reports.reportComment') || 'Report Comment')
                      : (t('reports.reportUser') || 'Report User')}
            </h2>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
            >
              <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Info */}
          {/* Info */}
          {(contentType === 'chatroom' || contentType === 'chatroom_background' || contentType === 'chatroom_picture' || contentType === 'topic') ? (
            <div className="mb-4 p-3 theme-bg-tertiary rounded-lg space-y-2">
              <p className="text-sm font-semibold theme-text-primary">
                {contentType === 'chatroom'
                  ? (t('reports.reportChatroom') || 'Report Chatroom')
                  : contentType === 'chatroom_background'
                    ? (t('reports.reportBackground') || 'Report Background Image')
                    : contentType === 'chatroom_picture'
                      ? (t('reports.reportPicture') || 'Report Group Image')
                      : (t('reports.reportTopic') || 'Report Topic')}
              </p>
              {ownerUsername && (
                <p className="text-sm theme-text-muted">
                  {t('admin.owner') || 'Owner'}: <span className="font-semibold theme-text-primary">{ownerUsername}</span>
                </p>
              )}
              {moderators && moderators.length > 0 && (
                <p className="text-sm theme-text-muted">
                  {t('admin.moderators') || 'Moderators'}: <span className="font-semibold theme-text-primary">{moderators.map(m => m.username).join(', ')}</span>
                </p>
              )}
            </div>
          ) : (contentType === 'post' || contentType === 'comment') ? (
            <div className="mb-4 p-3 theme-bg-tertiary rounded-lg space-y-2">
              <p className="text-sm font-semibold theme-text-primary">
                {contentType === 'post'
                  ? (t('reports.reportPost') || 'Report Post')
                  : (t('reports.reportComment') || 'Report Comment')}
              </p>
              {username && (
                <p className="text-sm theme-text-muted">
                  {t('posts.author') || (t('admin.owner') || 'Author')}: <span className="font-semibold theme-text-primary">{username}</span>
                </p>
              )}
            </div>
          ) : username && (
            <div className="mb-4 p-3 theme-bg-tertiary rounded-lg">
              <p className="text-sm theme-text-muted">
                {t('reports.reportingUser') || 'Reporting:'}{' '}
                <span className="font-semibold theme-text-primary">{username}</span>
              </p>
            </div>
          )}

          {/* Cannot report yourself warning */}
          {!canReport && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                {t('reports.cannotReportYourself') || 'You cannot report yourself or your own content.'}
              </p>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
              <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Report Type - Hide for chatroom reports */}
            {contentType !== 'chatroom' && contentType !== 'chatroom_background' && contentType !== 'chatroom_picture' && (
              <div>
                <label className="block text-sm font-medium theme-text-primary mb-1">
                  {t('reports.reportType') || 'Report Type'}
                </label>
                <select
                  name="report_type"
                  value={formData.report_type}
                  onChange={handleChange}
                  disabled={loading || !!contentId}
                  className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary"
                >
                  <option value="user">{t('reports.typeUser') || 'User Behavior'}</option>
                  <option value="content">{t('reports.typeContent') || 'Content Violation'}</option>
                </select>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-1">
                {t('reports.reason') || 'Reason'} *
              </label>
              <select
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                disabled={loading}
                required
                className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary"
              >
                <option value="">{t('reports.selectReason') || 'Select a reason...'}</option>
                {reportReasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {t(`reports.reason_${reason.value}`) || reason.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-1">
                {t('reports.description') || 'Description'} *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                disabled={loading}
                required
                rows={4}
                placeholder={t('reports.descriptionPlaceholder') || 'Please provide details about the issue...'}
                className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted resize-none"
              />
              <p className="text-xs theme-text-muted mt-1">
                {formData.description.length}/1000 {t('common.characters') || 'characters'}
              </p>
            </div>

            {/* Message Attachment Options */}
            {includeMessageHistory && userId && (
              <div className="space-y-3 p-4 theme-bg-tertiary rounded-lg">
                <h3 className="text-sm font-medium theme-text-primary mb-2">
                  {t('reports.attachMessages') || 'Attach Messages'}
                </h3>
                <div className="space-y-2">
                  {currentMessageId && (
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="attachCurrentMessage"
                        checked={formData.attachCurrentMessage}
                        onChange={handleChange}
                        disabled={loading}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm theme-text-primary">
                        {t('reports.attachCurrentMessage') || 'Attach current message'}
                      </span>
                    </label>
                  )}
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="attachMessageHistory"
                      checked={formData.attachMessageHistory}
                      onChange={handleChange}
                      disabled={loading}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm theme-text-primary">
                      {t('reports.attachMessageHistory') || 'Attach entire message history with this user'}
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {t('reports.warning') ||
                  'False reports may result in action against your account. Please only report genuine violations.'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 btn btn-ghost"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button type="submit" disabled={loading || !canReport} className="px-4 py-2 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <LoadingSpinner size="sm" /> : t('reports.submit') || 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReportUserDialog;
