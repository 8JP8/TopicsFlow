import React, { useState } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

interface BanUserDialogProps {
  userId: string;
  username: string;
  onClose: () => void;
}

const BanUserDialog: React.FC<BanUserDialogProps> = ({ userId, username, onClose }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    reason: '',
    duration_type: 'temporary' as 'temporary' | 'permanent',
    duration_days: 7,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'duration_days' ? parseInt(value, 10) : value,
    }));
  };

  const validateForm = () => {
    const newErrors: string[] = [];

    if (!formData.reason.trim()) {
      newErrors.push(t('admin.reasonRequired') || 'Reason is required');
    } else if (formData.reason.trim().length < 10) {
      newErrors.push(t('admin.reasonTooShort') || 'Reason must be at least 10 characters');
    }

    if (formData.duration_type === 'temporary') {
      if (formData.duration_days < 1) {
        newErrors.push(t('admin.durationTooShort') || 'Duration must be at least 1 day');
      } else if (formData.duration_days > 365) {
        newErrors.push(t('admin.durationTooLong') || 'Duration cannot exceed 365 days');
      }
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
      const banData: any = {
        reason: formData.reason.trim(),
        permanent: formData.duration_type === 'permanent',
      };

      if (formData.duration_type === 'temporary') {
        banData.duration_days = formData.duration_days;
      }

      const response = await api.post(API_ENDPOINTS.ADMIN.BAN_USER(userId), banData);

      if (response.data.success) {
        toast.success(t('admin.userBanned') || 'User banned successfully');
        onClose();
      } else {
        setErrors(response.data.errors || [t('admin.banFailed') || 'Failed to ban user']);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.errors ||
        error.response?.data?.message ||
        t('admin.banFailed') ||
        'Failed to ban user';
      setErrors(Array.isArray(errorMessage) ? errorMessage : [errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="theme-bg-secondary rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold theme-text-primary">
              {t('admin.banUser') || 'Ban User'}
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

          {/* User Info */}
          <div className="mb-4 p-4 theme-bg-tertiary rounded-lg">
            <p className="text-sm theme-text-muted mb-1">{t('admin.banningUser') || 'Banning user:'}</p>
            <p className="font-semibold theme-text-primary text-lg">{username}</p>
            <p className="text-xs theme-text-muted mt-1">ID: {userId}</p>
          </div>

          {/* Warning */}
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-800 dark:text-red-200">
                {t('admin.banWarning') || 'This action will prevent the user from accessing the platform. Make sure you have reviewed all evidence before proceeding.'}
              </p>
            </div>
          </div>

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
            {/* Duration Type */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">
                {t('admin.banDuration') || 'Ban Duration'} *
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="duration_type"
                    value="temporary"
                    checked={formData.duration_type === 'temporary'}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-4 h-4 theme-blue-primary"
                  />
                  <span className="ml-2 theme-text-primary">{t('admin.temporary') || 'Temporary'}</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="duration_type"
                    value="permanent"
                    checked={formData.duration_type === 'permanent'}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-4 h-4 theme-blue-primary"
                  />
                  <span className="ml-2 theme-text-primary">{t('admin.permanent') || 'Permanent'}</span>
                </label>
              </div>
            </div>

            {/* Duration Days (if temporary) */}
            {formData.duration_type === 'temporary' && (
              <div>
                <label className="block text-sm font-medium theme-text-primary mb-1">
                  {t('admin.durationDays') || 'Number of Days'} *
                </label>
                <input
                  type="number"
                  name="duration_days"
                  value={formData.duration_days}
                  onChange={handleChange}
                  disabled={loading}
                  min="1"
                  max="365"
                  required
                  className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary"
                />
                <p className="text-xs theme-text-muted mt-1">
                  {t('admin.durationHint') || 'Ban will expire after the specified number of days (1-365)'}
                </p>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-1">
                {t('admin.reason') || 'Reason'} *
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                disabled={loading}
                required
                rows={4}
                placeholder={t('admin.reasonPlaceholder') || 'Provide a detailed reason for the ban...'}
                className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted resize-none"
              />
              <p className="text-xs theme-text-muted mt-1">
                {formData.reason.length}/500 {t('common.characters') || 'characters'}
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
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                {loading ? <LoadingSpinner size="sm" /> : t('admin.confirmBan') || 'Confirm Ban'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BanUserDialog;
