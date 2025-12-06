import React, { useState } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';

interface WarnUserDialogProps {
  reportId: string;
  userId: string;
  username: string;
  onClose: () => void;
  onSuccess: () => void;
}

// Predefined warnings will be generated based on language

const WarnUserDialog: React.FC<WarnUserDialogProps> = ({
  reportId,
  userId,
  username,
  onClose,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const [warningMessage, setWarningMessage] = useState('');
  const [selectedPredefined, setSelectedPredefined] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate predefined warnings based on language
  const PREDEFINED_WARNINGS = [
    t('admin.predefinedWarning1') || 'Inappropriate behavior detected. Please review our community guidelines.',
    t('admin.predefinedWarning2') || 'Your recent actions violate our terms of service. Please be more respectful.',
    t('admin.predefinedWarning3') || 'Warning: Harassment or bullying is not tolerated. Continued violations may result in a ban.',
    t('admin.predefinedWarning4') || 'Your content has been reported for spam. Please ensure your contributions are meaningful.',
    t('admin.predefinedWarning5') || 'Warning: Hate speech or discriminatory content is strictly prohibited.',
  ];

  const handlePredefinedSelect = (message: string) => {
    setSelectedPredefined(message);
    setWarningMessage(message);
  };

  const handleSubmit = async () => {
    if (!warningMessage.trim()) {
      toast.error(t('admin.warningMessageRequired') || 'Warning message is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post(API_ENDPOINTS.ADMIN.REPORT_ACTION(reportId), {
        action: 'warn_user',
        warning_message: warningMessage.trim(),
      });

      if (response.data.success) {
        toast.success(t('admin.userWarned') || 'User warned successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(response.data.errors?.[0] || t('admin.failedToWarnUser') || 'Failed to warn user');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('admin.failedToWarnUser') || 'Failed to warn user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
        <h2 className="text-2xl font-semibold theme-text-primary mb-4">
          {t('admin.warnUser') || 'Warn User'}
        </h2>
        <p className="text-sm theme-text-muted mb-6">
          {t('admin.warningUser') || 'Warning'}: {username}
        </p>

        {/* Predefined warnings */}
        <div className="mb-6">
          <label className="block text-sm font-medium theme-text-primary mb-2">
            {t('admin.predefinedWarnings') || 'Predefined Warnings'}:
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {PREDEFINED_WARNINGS.map((warning, index) => (
              <button
                key={index}
                onClick={() => handlePredefinedSelect(warning)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedPredefined === warning
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'theme-border hover:theme-bg-tertiary'
                  }`}
              >
                <p className="text-sm theme-text-primary">{warning}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Custom warning message */}
        <div className="mb-6">
          <label className="block text-sm font-medium theme-text-primary mb-2">
            {t('admin.warningMessage') || 'Warning Message'}:
          </label>
          <textarea
            value={warningMessage}
            onChange={(e) => setWarningMessage(e.target.value)}
            rows={4}
            placeholder={t('admin.warningMessagePlaceholder') || 'Enter a custom warning message...'}
            className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 btn btn-ghost"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !warningMessage.trim()}
            className="px-4 py-2 btn btn-secondary disabled:opacity-50"
          >
            {isSubmitting
              ? t('common.sending') || 'Sending...'
              : t('admin.sendWarning') || 'Send Warning'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarnUserDialog;


