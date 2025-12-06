import React, { useState, useRef } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '../UI/LoadingSpinner';

interface ChatCreateProps {
  topicId: string;
  onChatCreated?: (chat: any) => void;
  onCancel?: () => void;
}

const ChatCreate: React.FC<ChatCreateProps> = ({ topicId, onChatCreated, onCancel }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: '',
    is_public: true,
    picture: '',
    background_picture: '',
  });
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const pictureInputRef = React.useRef<HTMLInputElement>(null);
  const backgroundInputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

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

    if (!formData.name.trim()) {
      setErrors(['Chat name is required']);
      return;
    }

    if (formData.name.length > 100) {
      setErrors(['Name must be 100 characters or less']);
      return;
    }

    if (formData.description.length > 500) {
      setErrors(['Description must be 500 characters or less']);
      return;
    }

    setLoading(true);

    try {
      // Parse tags
      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''))
        .filter(tag => tag.length >= 2 && tag.length <= 20);

      // Handle background picture upload if selected
      let backgroundPictureUrl = formData.background_picture;
      if (backgroundInputRef.current?.files?.[0]) {
        const file = backgroundInputRef.current.files[0];
        // Convert to data URL (in production, upload to file storage service)
        backgroundPictureUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.CREATE(topicId), {
        name: formData.name.trim(),
        description: formData.description.trim(),
        tags,
        is_public: formData.is_public,
        background_picture: backgroundPictureUrl || undefined,
      });

      if (response.data.success) {
        toast.success(t('chats.chatCreated') || 'Chat created successfully');
        setFormData({ name: '', description: '', tags: '', is_public: true, picture: '', background_picture: '' });
        setPicturePreview(null);
        setBackgroundPreview(null);
        if (onChatCreated) {
          onChatCreated(response.data.data);
        }
        if (onCancel) {
          onCancel();
        }
      } else {
        setErrors(response.data.errors || ['Failed to create chat']);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || 'Failed to create chat';
      setErrors([errorMessage]);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 theme-text-primary">
          {t('chats.createChat') || 'Create Chat'}
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
            <label htmlFor="name" className="block text-sm font-medium theme-text-primary mb-1">
              {t('chats.name') || 'Chat Name'} *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              maxLength={100}
              required
              className="w-full px-3 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('chats.namePlaceholder') || 'Enter chat name...'}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium theme-text-primary mb-1">
              {t('chats.description') || 'Description'}
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              maxLength={500}
              rows={4}
              className="w-full px-3 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={t('chats.descriptionPlaceholder') || 'Enter chat description...'}
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium theme-text-primary mb-1">
              {t('chats.tags') || 'Tags'}
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="w-full px-3 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('chats.tagsPlaceholder') || 'tag1, tag2, tag3...'}
            />
            <p className="mt-1 text-xs theme-text-muted">
              {t('chats.tagsHint') || 'Separate tags with commas'}
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_public"
              name="is_public"
              checked={formData.is_public}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_public" className="ml-2 text-sm theme-text-secondary">
              {t('chats.public') || 'Public chat'}
            </label>
          </div>

          {/* Chat Picture */}
          <div>
            <label className="block text-sm font-medium theme-text-primary mb-1">
              {t('chat.chatroomPhoto') || 'Chatroom Photo'}
            </label>
            <input
              ref={pictureInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    setPicturePreview(reader.result as string);
                    setFormData(prev => ({ ...prev, picture: reader.result as string }));
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
              id="picture-input"
            />
            <div className="space-y-2">
              {picturePreview && (
                <div className="relative">
                  <img
                    src={picturePreview}
                    alt="Picture preview"
                    className="w-20 h-20 object-cover rounded-lg border theme-border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPicturePreview(null);
                      setFormData(prev => ({ ...prev, picture: '' }));
                      if (pictureInputRef.current) {
                        pictureInputRef.current.value = '';
                      }
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => pictureInputRef.current?.click()}
                className="w-full px-4 py-2 border theme-border rounded-lg hover:theme-bg-tertiary transition-colors text-sm theme-text-primary"
              >
                {picturePreview ? (t('chat.changePhoto') || 'Change Photo') : (t('chat.selectPhoto') || 'Select Photo')}
              </button>
            </div>
          </div>

          {/* Background Picture */}
          <div>
            <label className="block text-sm font-medium theme-text-primary mb-1">
              {t('chat.chatroomBackground') || 'Chatroom Background'}
            </label>
            <input
              ref={backgroundInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    setBackgroundPreview(reader.result as string);
                    setFormData(prev => ({ ...prev, background_picture: reader.result as string }));
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
              id="background-picture-input"
            />
            <div className="space-y-2">
              {backgroundPreview && (
                <div className="relative">
                  <img
                    src={backgroundPreview}
                    alt="Background preview"
                    className="w-full h-32 object-cover rounded-lg border theme-border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBackgroundPreview(null);
                      setFormData(prev => ({ ...prev, background_picture: '' }));
                      if (backgroundInputRef.current) {
                        backgroundInputRef.current.value = '';
                      }
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => backgroundInputRef.current?.click()}
                className="w-full px-4 py-2 border theme-border rounded-lg hover:theme-bg-tertiary transition-colors text-sm theme-text-primary"
              >
                {backgroundPreview ? (t('chats.changeBackground') || 'Change Background') : (t('chats.selectBackground') || 'Select Background Picture')}
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
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
              {loading ? <LoadingSpinner size="sm" /> : (t('chats.create') || 'Create Chat')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatCreate;







