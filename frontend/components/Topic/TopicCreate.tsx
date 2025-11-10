import React, { useState } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

interface Topic {
  id: string;
  title: string;
  description: string;
  tags: string[];
  member_count: number;
  last_activity: string;
  owner: {
    id: string;
    username: string;
  };
  user_permission_level: number;
}

interface TopicCreateProps {
  onClose: () => void;
  onTopicCreated: (topic: Topic) => void;
}

const TopicCreate: React.FC<TopicCreateProps> = ({ onClose, onTopicCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    allow_anonymous: true,
    require_approval: false,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = () => {
    const newErrors: string[] = [];

    if (!formData.title.trim()) {
      newErrors.push('Title is required');
    } else if (formData.title.trim().length < 3) {
      newErrors.push('Title must be at least 3 characters long');
    } else if (formData.title.trim().length > 100) {
      newErrors.push('Title must be less than 100 characters');
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.push('Description must be less than 500 characters');
    }

    if (formData.tags) {
      const tags = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      if (tags.length > 10) {
        newErrors.push('Maximum 10 tags allowed');
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
      // Parse tags
      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''))
        .filter(tag => tag.length >= 2 && tag.length <= 20);

      const topicData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        tags,
        allow_anonymous: formData.allow_anonymous,
        require_approval: formData.require_approval,
      };

      const response = await api.post(API_ENDPOINTS.TOPICS.CREATE, topicData);

      if (response.data.success) {
        onTopicCreated(response.data.data);
      } else {
        setErrors(response.data.errors || ['Failed to create topic']);
      }
    } catch (error: any) {
      setErrors(error.response?.data?.errors || ['Failed to create topic']);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold theme-text-primary">Create New Topic</h2>
        <button
          onClick={handleCancel}
          className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
        >
          <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
          <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium theme-text-primary mb-1">
            Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter topic title..."
            className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
            disabled={loading}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium theme-text-primary mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe your topic..."
            rows={3}
            className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted resize-none"
            disabled={loading}
          />
          <p className="text-xs theme-text-muted mt-1">
            Optional. Maximum 500 characters.
          </p>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="block text-sm font-medium theme-text-primary mb-1">
            Tags
          </label>
          <input
            type="text"
            id="tags"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            placeholder="chat, general, random (comma separated)"
            className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
            disabled={loading}
          />
          <p className="text-xs theme-text-muted mt-1">
            Optional. Use lowercase letters, numbers, and underscores only. Maximum 10 tags.
          </p>
        </div>

        {/* Settings */}
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="allow_anonymous"
              name="allow_anonymous"
              checked={formData.allow_anonymous}
              onChange={handleChange}
              className="w-4 h-4 theme-blue-primary rounded theme-border"
              disabled={loading}
            />
            <label htmlFor="allow_anonymous" className="ml-2 text-sm theme-text-primary">
              Allow anonymous messages
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="require_approval"
              name="require_approval"
              checked={formData.require_approval}
              onChange={handleChange}
              className="w-4 h-4 theme-blue-primary rounded theme-border"
              disabled={loading}
            />
            <label htmlFor="require_approval" className="ml-2 text-sm theme-text-primary">
              Require approval for new members
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-4 py-2 btn btn-ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 btn btn-primary"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Create Topic'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TopicCreate;