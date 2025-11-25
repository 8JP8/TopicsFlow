import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import GifPicker from '../Chat/GifPicker';

interface CommentFormProps {
  postId: string;
  parentCommentId?: string;
  onSubmit: (content: string, gifUrl?: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  useAnonymous?: boolean;
}

const CommentForm: React.FC<CommentFormProps> = ({
  postId,
  parentCommentId,
  onSubmit,
  onCancel,
  placeholder,
  useAnonymous = false,
}) => {
  const { t } = useLanguage();
  const [content, setContent] = useState('');
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && !gifUrl) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(content.trim() || (gifUrl ? '[GIF]' : ''), gifUrl || undefined);
      setContent('');
      setGifUrl(null);
    } catch (error) {
      // Error handling is done by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGifSelect = (selectedGifUrl: string) => {
    setGifUrl(selectedGifUrl);
    setShowGifPicker(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={5000}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={placeholder || t('comments.addComment')}
          required={!gifUrl}
        />
      </div>

      {gifUrl && (
        <div className="relative">
          <img
            src={gifUrl}
            alt="Selected GIF"
            className="max-w-full max-h-48 rounded-lg"
          />
          <button
            type="button"
            onClick={() => setGifUrl(null)}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowGifPicker(!showGifPicker)}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {t('chat.gif')}
        </button>

        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || (!content.trim() && !gifUrl)}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('common.loading') : (parentCommentId ? t('comments.reply') : t('comments.addComment'))}
          </button>
        </div>
      </div>

      {showGifPicker && (
        <div className="mt-3 relative">
          <GifPicker 
            onSelectGif={handleGifSelect} 
            onClose={() => setShowGifPicker(false)} 
          />
        </div>
      )}
    </form>
  );
};

export default CommentForm;

