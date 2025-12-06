import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '../UI/LoadingSpinner';
import { getAnonymousModeState, saveAnonymousModeState } from '@/utils/anonymousStorage';

interface PostCreateProps {
  topicId: string;
  onPostCreated?: (post: any) => void;
  onCancel?: () => void;
}

const PostCreate: React.FC<PostCreateProps> = ({ topicId, onPostCreated, onCancel }) => {
  const { t } = useLanguage();
  
  // Load anonymous mode state from localStorage
  const savedState = getAnonymousModeState(topicId);
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    use_anonymous: savedState.isAnonymous,
    tags: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Load anonymous state when topicId changes
  useEffect(() => {
    const saved = getAnonymousModeState(topicId);
    setFormData(prev => ({
      ...prev,
      use_anonymous: saved.isAnonymous,
    }));
  }, [topicId]);

  // Save anonymous state to localStorage when it changes
  useEffect(() => {
    saveAnonymousModeState(topicId, formData.use_anonymous);
  }, [topicId, formData.use_anonymous]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    // Auto-convert spaces to commas for tags input
    let processedValue = value;
    if (name === 'tags' && type === 'text') {
      // Replace spaces with commas to separate tags
      processedValue = value.replace(/\s+/g, ',');
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : processedValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!formData.title.trim()) {
      setErrors(['Title is required']);
      return;
    }

    if (!formData.content.trim()) {
      setErrors(['Content is required']);
      return;
    }

    setLoading(true);

    try {
      // Parse tags
      const tags = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);

      const response = await api.post(API_ENDPOINTS.POSTS.CREATE(topicId), {
        title: formData.title.trim(),
        content: formData.content.trim(),
        use_anonymous: formData.use_anonymous,
        tags: tags,
      });

      if (response.data.success) {
        toast.success(t('posts.postCreated') || 'Post created successfully');
        setFormData({ title: '', content: '', use_anonymous: false, tags: '' });
        if (onPostCreated) {
          onPostCreated(response.data.data);
        }
        if (onCancel) {
          onCancel();
        }
      } else {
        setErrors(response.data.errors || ['Failed to create post']);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || 'Failed to create post';
      setErrors([errorMessage]);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold theme-text-primary mb-4">
        {t('posts.createPost') || 'Create Post'}
      </h2>

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
        <div>
          <label htmlFor="title" className="block text-sm font-medium theme-text-primary mb-1">
            {t('posts.title') || 'Title'} *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            maxLength={300}
            required
            className="w-full px-3 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('posts.titlePlaceholder') || 'Enter post title...'}
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium theme-text-primary mb-1">
            {t('posts.content') || 'Content'} *
          </label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            required
            rows={6}
            className="w-full px-3 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder={t('posts.contentPlaceholder') || 'Enter post content...'}
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium theme-text-primary mb-1">
            {t('posts.tags') || 'Tags'} <span className="text-xs theme-text-muted">({t('posts.tagsHint') || 'comma-separated'})</span>
          </label>
          <input
            type="text"
            id="tags"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            className="w-full px-3 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('posts.tagsPlaceholder') || 'tag1, tag2, tag3...'}
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="use_anonymous"
            name="use_anonymous"
            checked={formData.use_anonymous}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="use_anonymous" className="ml-2 text-sm theme-text-secondary">
            {t('posts.useAnonymous') || 'Post anonymously'}
          </label>
        </div>

        <div className="flex justify-end space-x-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 btn btn-ghost"
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 btn btn-primary"
          >
            {loading ? <LoadingSpinner size="sm" /> : (t('posts.create') || 'Create Post')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PostCreate;
