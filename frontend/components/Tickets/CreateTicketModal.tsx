import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { getTicketCategories, getTicketPriorities, TicketCategory, TicketPriority } from '@/utils/ticketUtils';
import useEscapeKey from '@/hooks/useEscapeKey';

interface CreateTicketModalProps {
  onClose: () => void;
  onTicketCreated?: () => void;
}

import { createPortal } from 'react-dom';

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({ onClose, onTicketCreated }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    category: '' as TicketCategory | '',
    subject: '',
    description: '',
    priority: 'medium' as TicketPriority,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEscapeKey(onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  const categories = getTicketCategories();
  const priorities = getTicketPriorities();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const newErrors: string[] = [];

    if (!formData.category) {
      newErrors.push(t('tickets.categoryRequired') || 'Please select a category');
    }

    if (!formData.subject.trim()) {
      newErrors.push(t('tickets.subjectRequired') || 'Subject is required');
    } else if (formData.subject.trim().length < 5) {
      newErrors.push(t('tickets.subjectTooShort') || 'Subject must be at least 5 characters');
    } else if (formData.subject.trim().length > 200) {
      newErrors.push(t('tickets.subjectTooLong') || 'Subject must be less than 200 characters');
    }

    if (!formData.description.trim()) {
      newErrors.push(t('tickets.descriptionRequired') || 'Description is required');
    } else if (formData.description.trim().length < 20) {
      newErrors.push(t('tickets.descriptionTooShort') || 'Description must be at least 20 characters');
    } else if (formData.description.trim().length > 2000) {
      newErrors.push(t('tickets.descriptionTooLong') || 'Description must be less than 2000 characters');
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
      const ticketData = {
        category: formData.category,
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
      };

      const response = await api.post(API_ENDPOINTS.TICKETS.CREATE, ticketData);

      if (response.data.success) {
        toast.success(t('tickets.ticketCreated') || 'Ticket created successfully');
        if (onTicketCreated) {
          onTicketCreated();
        }
        onClose();
      } else {
        setErrors(response.data.errors || [t('tickets.createFailed') || 'Failed to create ticket']);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.errors ||
        error.response?.data?.message ||
        t('tickets.createFailed') ||
        'Failed to create ticket';
      setErrors(Array.isArray(errorMessage) ? errorMessage : [errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold theme-text-primary">
              {t('tickets.createTicket') || 'Create Support Ticket'}
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
          <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {t('tickets.createInfo') ||
                'Submit a support ticket and our team will respond as soon as possible. Please provide as much detail as you can.'}
            </p>
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
            {/* Category */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-1">
                {t('tickets.category') || 'Category'} *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                disabled={loading}
                required
                className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary"
              >
                <option value="">{t('tickets.selectCategory') || 'Select a category...'}</option>
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.icon} {t(`tickets.category_${category.value}`) || category.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-1">
                {t('tickets.priority') || 'Priority'} *
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                disabled={loading}
                required
                className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary"
              >
                {priorities.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {t(`tickets.priority_${priority.value}`) || priority.label}
                  </option>
                ))}
              </select>
              <p className="text-xs theme-text-muted mt-1">
                {t('tickets.priorityHint') || 'Select the urgency level of your issue'}
              </p>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-1">
                {t('tickets.subject') || 'Subject'} *
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                disabled={loading}
                required
                placeholder={t('tickets.subjectPlaceholder') || 'Brief summary of your issue...'}
                className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
              />
              <p className="text-xs theme-text-muted mt-1">
                {formData.subject.length}/200 {t('common.characters') || 'characters'}
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-1">
                {t('tickets.description') || 'Description'} *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                disabled={loading}
                required
                rows={6}
                placeholder={t('tickets.descriptionPlaceholder') || 'Provide detailed information about your issue...'}
                className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted resize-none"
              />
              <p className="text-xs theme-text-muted mt-1">
                {formData.description.length}/2000 {t('common.characters') || 'characters'}
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
              <button type="submit" disabled={loading} className="px-4 py-2 btn btn-primary">
                {loading ? <LoadingSpinner size="sm" /> : t('tickets.createTicket') || 'Create Ticket'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateTicketModal;
