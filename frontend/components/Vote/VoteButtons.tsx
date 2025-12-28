import React, { useState, useEffect } from 'react';
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
  horizontal?: boolean; // Display buttons horizontally instead of vertically
}

const VoteButtons: React.FC<VoteButtonsProps> = ({
  contentId,
  contentType,
  initialUpvoteCount,
  initialDownvoteCount = 0,
  initialScore,
  userHasUpvoted: initialUserHasUpvoted,
  userHasDownvoted: initialUserHasDownvoted = false,
  onVoteChange,
  size = 'md',
  showCount = true,
  disabled = false,
  horizontal = false,
}) => {
  const { t } = useLanguage();
  const [upvoteCount, setUpvoteCount] = useState(initialUpvoteCount);
  const [downvoteCount, setDownvoteCount] = useState(initialDownvoteCount);
  // Calculate initial score if not provided
  const calculatedInitialScore = initialScore !== undefined ? initialScore : initialUpvoteCount - initialDownvoteCount;
  const [score, setScore] = useState(calculatedInitialScore);
  const [userHasUpvoted, setUserHasUpvoted] = useState(initialUserHasUpvoted);
  const [userHasDownvoted, setUserHasDownvoted] = useState(initialUserHasDownvoted);
  const [isLoading, setIsLoading] = useState(false);

  // Update state when props change
  useEffect(() => {
    // Only update state from props if we are NOT currently effectively "optimistically updated" 
    // or if the props have changed to a new truth that supersedes our local state.
    // For simplicity, we sync with props, BUT we need to ensure parent updates props correctly.
    // If parent passes old props back, this Effect resets the button.
    // We can avoid this by checking if the prop change matches our current state? No.
    // Best approach: Trust props, but ensure `onVoteChange` works.
    // Use a ref to track if we just voted to ignore the immediate next prop update if it's stale?
    // Let's just make sure we interpret "initial" props as "current" props.

    setUpvoteCount(initialUpvoteCount);
    setDownvoteCount(initialDownvoteCount);
    const newScore = initialScore !== undefined ? initialScore : initialUpvoteCount - initialDownvoteCount;
    setScore(newScore);
    setUserHasUpvoted(initialUserHasUpvoted);
    setUserHasDownvoted(initialUserHasDownvoted || false);
  }, [initialUpvoteCount, initialDownvoteCount, initialScore, initialUserHasUpvoted, initialUserHasDownvoted]);

  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || isLoading) return;

    // Optimistic Update
    const previousState = {
      userHasUpvoted,
      userHasDownvoted,
      upvoteCount,
      downvoteCount,
      score
    };

    // Calculate new state logic
    const newUpvoted = !userHasUpvoted;
    const newDownvoted = false; // Cannot be both
    let newUpCount = upvoteCount;
    let newDownCount = downvoteCount;

    if (newUpvoted) {
      newUpCount++;
      if (userHasDownvoted) newDownCount--;
    } else {
      newUpCount--;
    }

    // Simple score estimation
    const newScore = newUpCount - newDownCount;

    setUserHasUpvoted(newUpvoted);
    setUserHasDownvoted(newDownvoted);
    setUpvoteCount(newUpCount);
    setDownvoteCount(newDownCount);
    setScore(newScore);

    // Notify parent immediately
    if (onVoteChange) {
      onVoteChange(newUpvoted, newDownvoted, newUpCount, newDownCount, newScore);
    }

    // No loading state for optimistic UI to prevent "disabled" feel, or keep it short
    // We'll skip setting isLoading to true to allow rapid toggling, or handle race conditions.
    // Better to keep isLoading=true to prevent double-clicks, but it blocks immediate feedback if button greys out.
    // User wants "lit up", so we shouldn't disable it visually too much.
    setIsLoading(true);

    try {
      const endpoint = contentType === 'post'
        ? API_ENDPOINTS.POSTS.UPVOTE(contentId)
        : API_ENDPOINTS.COMMENTS.UPVOTE(contentId);

      const response = await api.post(endpoint);

      if (response.data.success) {
        // Sync with server truth if needed, or just trust our math. 
        // Server might return different score if others voted.
        const data = response.data.data;
        if (data) {
          // Update with actual server data to be safe
          setUserHasUpvoted(data.user_has_upvoted);
          setUserHasDownvoted(data.user_has_downvoted);
          setUpvoteCount(data.upvote_count);
          setDownvoteCount(data.downvote_count);
          setScore(data.score);
        }
      } else {
        // Revert on failure
        throw new Error(response.data.errors?.[0] || 'Failed to upvote');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || 'Failed to upvote';
      toast.error(errorMessage);

      // Revert state
      setUserHasUpvoted(previousState.userHasUpvoted);
      setUserHasDownvoted(previousState.userHasDownvoted);
      setUpvoteCount(previousState.upvoteCount);
      setDownvoteCount(previousState.downvoteCount);
      setScore(previousState.score);
      if (onVoteChange) {
        onVoteChange(previousState.userHasUpvoted, previousState.userHasDownvoted, previousState.upvoteCount, previousState.downvoteCount, previousState.score);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || isLoading) return;

    // Optimistic Update
    const previousState = {
      userHasUpvoted,
      userHasDownvoted,
      upvoteCount,
      downvoteCount,
      score
    };

    const newDownvoted = !userHasDownvoted;
    const newUpvoted = false;
    let newUpCount = upvoteCount;
    let newDownCount = downvoteCount;

    if (newDownvoted) {
      newDownCount++;
      if (userHasUpvoted) newUpCount--;
    } else {
      newDownCount--;
    }

    const newScore = newUpCount - newDownCount;

    setUserHasUpvoted(newUpvoted);
    setUserHasDownvoted(newDownvoted);
    setUpvoteCount(newUpCount);
    setDownvoteCount(newDownCount);
    setScore(newScore);

    if (onVoteChange) {
      onVoteChange(newUpvoted, newDownvoted, newUpCount, newDownCount, newScore);
    }

    setIsLoading(true);

    try {
      const endpoint = contentType === 'post'
        ? API_ENDPOINTS.POSTS.DOWNVOTE(contentId)
        : API_ENDPOINTS.COMMENTS.DOWNVOTE?.(contentId) || API_ENDPOINTS.COMMENTS.UPVOTE(contentId);

      const response = await api.post(endpoint);

      if (response.data.success) {
        const data = response.data.data;
        if (data) {
          setUserHasUpvoted(data.user_has_upvoted);
          setUserHasDownvoted(data.user_has_downvoted);
          setUpvoteCount(data.upvote_count);
          setDownvoteCount(data.downvote_count);
          setScore(data.score);
        }
      } else {
        throw new Error(response.data.errors?.[0] || 'Failed to downvote');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || 'Failed to downvote';
      toast.error(errorMessage);

      // Revert
      setUserHasUpvoted(previousState.userHasUpvoted);
      setUserHasDownvoted(previousState.userHasDownvoted);
      setUpvoteCount(previousState.upvoteCount);
      setDownvoteCount(previousState.downvoteCount);
      setScore(previousState.score);
      if (onVoteChange) {
        onVoteChange(previousState.userHasUpvoted, previousState.userHasDownvoted, previousState.upvoteCount, previousState.downvoteCount, previousState.score);
      }
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

  // Horizontal layout (for comments at bottom, Reddit style)
  if (horizontal) {
    return (
      <div className="flex items-center gap-1">
        {/* Upvote Button */}
        <button
          onClick={handleUpvote}
          disabled={disabled || isLoading}
          className={`
            flex items-center justify-center rounded transition-colors
            ${userHasUpvoted
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400'
            }
            ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'}
          `}
          title={userHasUpvoted ? 'Remove upvote' : 'Upvote'}
        >
          <svg
            className={size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'}
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
          <span className={`text-xs font-medium ${score > 0 ? 'text-orange-600 dark:text-orange-400' : score < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
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
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }
            ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'}
          `}
          title={userHasDownvoted ? 'Remove downvote' : 'Downvote'}
        >
          <svg
            className={size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'}
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
  }

  // Vertical layout (default, for posts)
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





