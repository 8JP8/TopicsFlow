import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface MessageDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isOwnerDeletion?: boolean;
}

const DELETION_REASONS = [
  'violates_content_policies',
  'racial_slurs',
  'harassment',
  'spam',
  'inappropriate_content',
  'other',
];

const MessageDeleteDialog: React.FC<MessageDeleteDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isOwnerDeletion = false,
}) => {
  const { t } = useLanguage();
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    const reason = selectedReason === 'other' ? customReason : selectedReason;
    if (!reason.trim() && isOwnerDeletion) {
      return; // Reason required for owner deletions
    }
    onConfirm(reason);
    setSelectedReason('');
    setCustomReason('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t('messages.deleteMessage') || 'Delete Message'}
        </h2>

        {isOwnerDeletion && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {t('messages.ownerDeletionWarning') || 'As the chat owner, you must provide a reason for deleting this message. This will be reported to administrators.'}
            </p>
          </div>
        )}

        {isOwnerDeletion && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('messages.deletionReason') || 'Reason for deletion'} *
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">{t('messages.selectReason') || 'Select a reason...'}</option>
              {DELETION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {t(`messages.deletionReasons.${reason}`) || reason.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            {selectedReason === 'other' && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder={t('messages.customReason') || 'Please provide details...'}
                className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                rows={3}
              />
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isOwnerDeletion && !selectedReason && !customReason}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('common.delete') || 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageDeleteDialog;






