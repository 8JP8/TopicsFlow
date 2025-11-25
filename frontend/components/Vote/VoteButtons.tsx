import React, { useState } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface VoteButtonsProps {
  contentId: string;
  contentType: 'post' | 'comment';
  initialUpvoteCount: number;
  initialDownvoteCount?: number;
  initialScore?: number;
  userHasUpvoted: boolean;
  userHasDownvoted?: boolean;
  onVoteChange?: (upvoted: boolean, downvoted: boolean, upCount: number, downCount: number, score: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  disabled?: boolean;
}

const VoteButtons: React.FC<VoteButtonsProps> = ({
  contentId,
  contentType,
  initialUpvoteCount,
  initialDownvoteCount = 0,
  initialScore = 0,
  userHasUpvoted: initialUserHasUpvoted,
  userHasDownvoted: initialUserHasDownvoted = false,
  onVoteChange,
  size = 'md',
  showCount = true,
  disabled = false,
}) => {
  const { t } = useLanguage();
  const [upvoteCount, setUpvoteCount] = useState(initialUpvoteCount);
  const [downvoteCount, setDownvoteCount] = useState(initialDownvoteCount);
  const [score, setScore] = useState(initialScore !== undefined ? initialScore : initialUpvoteCount - initialDownvoteCount);
  const [userHasUpvoted, setUserHasUpvoted] = useState(initialUserHasUpvoted);
  const [userHasDownvoted, setUserHasDownvoted] = useState(initialUserHasDownvoted);
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
        const data = response.data.data;
        const newUpvoted = data?.user_has_upvoted ?? !userHasUpvoted;
        const newDownvoted = data?.user_has_downvoted ?? false;
        const newUpCount = data?.upvote_count ?? upvoteCount;
        const newDownCount = data?.downvote_count ?? downvoteCount;
        const newScore = data?.score ?? (newUpCount - newDownCount);

        setUserHasUpvoted(newUpvoted);
        setUserHasDownvoted(newDownvoted);
        setUpvoteCount(newUpCount);
        setDownvoteCount(newDownCount);
        setScore(newScore);

        if (onVoteChange) {
          onVoteChange(newUpvoted, newDownvoted, newUpCount, newDownCount, newScore);
        }
      } else {
        toast.error(response.data.errors?.[0] || 'Failed to upvote');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || 'Failed to upvote';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || isLoading) return;

    setIsLoading(true);

    try {
      const endpoint = contentType === 'post'
        ? API_ENDPOINTS.POSTS.DOWNVOTE(contentId)
        : API_ENDPOINTS.COMMENTS.DOWNVOTE?.(contentId) || API_ENDPOINTS.COMMENTS.UPVOTE(contentId); // Fallback if downvote not available for comments

      const response = await api.post(endpoint);

      if (response.data.success) {
        const data = response.data.data;
        const newUpvoted = data?.user_has_upvoted ?? false;
        const newDownvoted = data?.user_has_downvoted ?? !userHasDownvoted;
        const newUpCount = data?.upvote_count ?? upvoteCount;
        const newDownCount = data?.downvote_count ?? downvoteCount;
        const newScore = data?.score ?? (newUpCount - newDownCount);

        setUserHasUpvoted(newUpvoted);
        setUserHasDownvoted(newDownvoted);
        setUpvoteCount(newUpCount);
        setDownvoteCount(newDownCount);
        setScore(newScore);

        if (onVoteChange) {
          onVoteChange(newUpvoted, newDownvoted, newUpCount, newDownCount, newScore);
        }
      } else {
        toast.error(response.data.errors?.[0] || 'Failed to downvote');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || 'Failed to downvote';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Upvote Button */}
      <button
        onClick={handleUpvote}
        disabled={disabled || isLoading}
        className={`
          flex items-center justify-center rounded transition-colors
          ${userHasUpvoted
            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }
          ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${sizeClasses[size]}
        `}
        title={userHasUpvoted ? 'Remove upvote' : 'Upvote'}
      >
        <svg
          className={iconSizeClasses[size]}
          fill={userHasUpvoted ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Score */}
      {showCount && (
        <span className={`text-sm font-semibold ${score > 0 ? 'text-orange-600 dark:text-orange-400' : score < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {score}
        </span>
      )}

      {/* Downvote Button */}
      <button
        onClick={handleDownvote}
        disabled={disabled || isLoading}
        className={`
          flex items-center justify-center rounded transition-colors
          ${userHasDownvoted
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }
          ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${sizeClasses[size]}
        `}
        title={userHasDownvoted ? 'Remove downvote' : 'Downvote'}
      >
        <svg
          className={iconSizeClasses[size]}
          fill={userHasDownvoted ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
};

export default VoteButtons;


