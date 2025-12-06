import React, { useState } from 'react';
import { api, API_ENDPOINTS } from '../../utils/api';
import { translate } from '../../utils/translations';
import { toast } from 'react-hot-toast';

interface UpvoteButtonProps {
  contentId: string;
  contentType: 'post' | 'comment';
  initialUpvoteCount: number;
  userHasUpvoted: boolean;
  onUpvoteChange?: (upvoted: boolean, newCount: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  disabled?: boolean;
}

const UpvoteButton: React.FC<UpvoteButtonProps> = ({
  contentId,
  contentType,
  initialUpvoteCount,
  userHasUpvoted: initialUserHasUpvoted,
  onUpvoteChange,
  size = 'md',
  showCount = true,
  disabled = false,
}) => {
  const [upvoteCount, setUpvoteCount] = useState(initialUpvoteCount);
  const [userHasUpvoted, setUserHasUpvoted] = useState(initialUserHasUpvoted);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || isLoading) return;

    setIsLoading(true);

    try {
      const endpoint = contentType === 'post'
        ? API_ENDPOINTS.POSTS.UPVOTE(contentId)
        : API_ENDPOINTS.COMMENTS.UPVOTE(contentId);

      const response = await api.post(endpoint);

      if (response.data.success) {
        const newUpvoted = response.data.data?.user_has_upvoted ?? !userHasUpvoted;
        const newCount = response.data.data?.upvote_count ?? upvoteCount + (newUpvoted ? 1 : -1);

        setUserHasUpvoted(newUpvoted);
        setUpvoteCount(newCount);

        if (onUpvoteChange) {
          onUpvoteChange(newUpvoted, newCount);
        }
      } else {
        toast.error(response.data.errors?.[0] || translate('posts.failedToUpvote'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || translate('posts.failedToUpvote');
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-10 h-10 text-lg',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      onClick={handleUpvote}
      disabled={disabled || isLoading}
      className={`
        flex items-center gap-1 px-2 py-1 rounded-md transition-colors
        ${userHasUpvoted
          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }
        ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${sizeClasses[size]}
      `}
      title={userHasUpvoted ? translate('upvote.removeUpvote') : translate('upvote.upvote')}
    >
      <svg
        className={iconSizeClasses[size]}
        fill={userHasUpvoted ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
        />
      </svg>
      {showCount && (
        <span className="font-medium min-w-[1.5rem] text-center">
          {upvoteCount}
        </span>
      )}
    </button>
  );
};

export default UpvoteButton;








