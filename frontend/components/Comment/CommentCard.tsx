import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getUserColorClass } from '@/utils/colorUtils';
import VoteButtons from '../Vote/VoteButtons';
import CommentForm from './CommentForm';
import UserBanner from '../UI/UserBanner';
import { useUserBanner } from '@/hooks/useUserBanner';
import Avatar from '../UI/Avatar';
import UserBadges from '../UI/UserBadges';
import { getUserProfilePicture } from '@/hooks/useUserProfile';
import CommentContextMenu from '../UI/CommentContextMenu';
import { useAuth } from '@/contexts/AuthContext';
// Using simple date formatting instead of date-fns

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  author_username?: string;
  display_name?: string;
  is_anonymous?: boolean;
  content: string;
  parent_comment_id?: string;
  parent_author_username?: string; // For mentions
  upvote_count: number;
  downvote_count?: number;
  score?: number;
  reply_count: number;
  user_has_upvoted?: boolean;
  user_has_downvoted?: boolean;
  created_at: string;
  depth: number;
  gif_url?: string;
  replies?: Comment[];
  profile_picture?: string; // User profile picture
  is_admin?: boolean;
  is_owner?: boolean;
  is_moderator?: boolean;
}

interface CommentCardProps {
  comment: Comment;
  onVoteChange?: (upvoted: boolean, downvoted: boolean, upCount: number, downCount: number, score: number) => void;
  onReply?: (commentId: string, content: string, gifUrl?: string) => void;
  onDelete?: (commentId: string) => void;
  onHide?: (commentId: string) => void;
  maxDepth?: number;
  currentDepth?: number; // Track current nesting depth
  isClosed?: boolean;
}

// Helper function to calculate comment score for sorting
const getCommentScore = (comment: Comment): number => {
  if (comment.score !== undefined) {
    return comment.score;
  }
  return comment.upvote_count - (comment.downvote_count || 0);
};

// Helper function to get best child score recursively
const getBestChildScore = (comment: Comment): number => {
  if (!comment.replies || comment.replies.length === 0) {
    return 0;
  }

  // Get the best score from direct children
  const childScores = comment.replies.map(reply => {
    const directScore = getCommentScore(reply);
    const nestedScore = getBestChildScore(reply);
    return Math.max(directScore, nestedScore);
  });

  return Math.max(...childScores, 0);
};

// Sort comments by score, then by best child score, then randomly
const sortCommentsByScore = (comments: Comment[]): Comment[] => {
  return [...comments].sort((a, b) => {
    const scoreA = getCommentScore(a);
    const scoreB = getCommentScore(b);

    // First, sort by score (descending)
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // If scores are equal, sort by best child score
    const childScoreA = getBestChildScore(a);
    const childScoreB = getBestChildScore(b);

    if (childScoreB !== childScoreA) {
      return childScoreB - childScoreA;
    }

    // If still equal, sort randomly (using id as seed for consistency)
    return a.id.localeCompare(b.id);
  });
};

const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  onVoteChange,
  onReply,
  onDelete,
  onHide,
  maxDepth = 10,
  currentDepth = 0, // Start at depth 0 for top-level comments
  isClosed = false,
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [showReplies, setShowReplies] = useState(false); // Start collapsed like Reddit
  const { showBanner, bannerPos, selectedUser, handleMouseEnter, handleMouseLeave, handleClick, handleClose } = useUserBanner();
  const [currentScore, setCurrentScore] = useState(
    comment.score !== undefined ? comment.score : comment.upvote_count - (comment.downvote_count || 0)
  );
  const [currentUpvoteCount, setCurrentUpvoteCount] = useState(comment.upvote_count);
  const [currentDownvoteCount, setCurrentDownvoteCount] = useState(comment.downvote_count || 0);
  const [sortedReplies, setSortedReplies] = useState<Comment[]>([]);

  // Update score when comment prop changes
  useEffect(() => {
    const newScore = comment.score !== undefined ? comment.score : comment.upvote_count - (comment.downvote_count || 0);
    setCurrentScore(newScore);
    setCurrentUpvoteCount(comment.upvote_count);
    setCurrentDownvoteCount(comment.downvote_count || 0);
  }, [comment.score, comment.upvote_count, comment.downvote_count]);

  // Sort replies whenever they change
  useEffect(() => {
    if (comment.replies && comment.replies.length > 0) {
      const sorted = sortCommentsByScore(comment.replies);
      setSortedReplies(sorted);
    } else {
      setSortedReplies([]);
    }
  }, [comment.replies]);

  const formatTimeAgo = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return t('notifications.justNow') || 'Just now';
      if (minutes < 60) return `${minutes}${t('posts.minutes')?.charAt(0) || 'm'}`;
      if (hours < 24) return `${hours}${t('posts.hours')?.charAt(0) || 'h'}`;
      if (days < 7) return `${days}${t('posts.days')?.charAt(0) || 'd'}`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const handleReply = (content: string, gifUrl?: string) => {
    if (onReply) {
      onReply(comment.id, content, gifUrl);
      setShowReplyForm(false);
    }
  };

  const handleVoteChange = (upvoted: boolean, downvoted: boolean, upCount: number, downCount: number, score: number) => {
    // Update local state - only for THIS comment
    setCurrentScore(score);
    setCurrentUpvoteCount(upCount);
    setCurrentDownvoteCount(downCount);

    // Update comment object for sorting
    const updatedComment = {
      ...comment,
      upvote_count: upCount,
      downvote_count: downCount,
      score: score,
      user_has_upvoted: upvoted,
      user_has_downvoted: downvoted
    };

    // Re-sort replies if they exist (only for THIS comment's replies)
    if (updatedComment.replies && updatedComment.replies.length > 0) {
      const sorted = sortCommentsByScore(updatedComment.replies);
      setSortedReplies(sorted);
    }

    // DO NOT notify parent component - each comment is independent
    // The parent will handle its own votes separately
  };

  const canReply = comment.depth < maxDepth && !isClosed;
  const isReply = comment.parent_comment_id !== undefined && comment.parent_comment_id !== null;
  const hasReplies = (comment.replies && comment.replies.length > 0) || comment.reply_count > 0;

  // Get user avatar using Avatar component
  const getUserAvatar = () => {
    if (comment.is_anonymous) {
      // For anonymous comments, show circle with initial


      const anonymousName = comment.display_name || comment.author_username || 'Anonymous';
      const initial = anonymousName.charAt(0).toUpperCase();
      const avatarColor = getUserColorClass(anonymousName);

      return (
        <div
          className={`w-6 h-6 rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold flex-shrink-0 text-xs cursor-pointer`}
          onMouseEnter={(e) => handleMouseEnter(e, '', anonymousName)}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClick(e, '', anonymousName);
          }}
        >
          {initial}
        </div>
      );
    }
    if (comment.user_id) {
      return (
        <Avatar
          userId={comment.user_id}
          username={comment.author_username || comment.display_name || 'Unknown'}
          profilePicture={getUserProfilePicture(comment.user_id) || comment.profile_picture}
          size="sm"
        />
      );
    }
    // Fallback
    return (
      <Avatar
        username={comment.display_name || comment.author_username || '?'}
        size="sm"
      />
    );
  };

  // Consistent spacing: 24px (1.5rem) per level - same spacing for every nest
  const INDENT_PER_LEVEL = 24;
  // Each reply indents by exactly one level (24px), not cumulative
  // This ensures consistent spacing regardless of nesting depth
  const indentPx = isReply ? INDENT_PER_LEVEL : 0;

  return (
    <>
      <div className="relative">
        {/* Indentation wrapper - each reply indents by exactly one level */}
        <div style={indentPx > 0 ? { marginLeft: `${indentPx}px` } : {}}>
          {/* Connecting line - positioned indented by one level, fixed width */}
          {isReply && (
            <div
              className="absolute bg-gray-300 dark:bg-gray-600 z-0"
              style={{
                // Fixed width: 2px (0.5 * 4px = 2px, but using explicit 2px for consistency)
                width: '2px',
                // Line positioned indented by one level (24px to the right from the left edge)
                // Wrapper is at 24px, line at 0px relative = 24px visual (indented by one level)
                left: `0px`,
                top: '0',
                bottom: '0',
                // Ensure line doesn't overlap with comment content
                pointerEvents: 'none'
              }}
            />
          )}

          {/* Comment container - Reddit style with border */}
          <div
            className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 mb-1 p-2 hover:border-gray-300 dark:hover:border-gray-600 transition-colors relative z-10"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <div className="flex gap-2">
              {/* Content Section */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {/* User Avatar */}
                  {getUserAvatar()}
                  {!comment.is_anonymous && comment.user_id && comment.author_username ? (
                    <span
                      className="text-xs font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:underline"
                      onMouseEnter={(e) => handleMouseEnter(e, comment.user_id, comment.author_username!)}
                      onMouseLeave={handleMouseLeave}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleClick(e, comment.user_id, comment.author_username!);
                      }}
                    >
                      {comment.author_username}
                    </span>
                  ) : comment.is_anonymous ? (
                    <span
                      className="text-xs font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:underline"
                      onMouseEnter={(e) => handleMouseEnter(e, '', comment.display_name || 'Anonymous')}
                      onMouseLeave={handleMouseLeave}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleClick(e, '', comment.display_name || 'Anonymous');
                      }}
                    >
                      {comment.display_name || 'Anonymous'}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {comment.author_username || 'Unknown'}
                    </span>
                  )}
                  <UserBadges
                    isFromMe={user?.id === comment.user_id}
                    isAdmin={comment.is_admin}
                    isOwner={comment.is_owner}
                    isModerator={comment.is_moderator}
                    isAnonymous={comment.is_anonymous}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimeAgo(comment.created_at)}
                  </span>
                </div>

                {comment.gif_url && (
                  <div className="mb-2">
                    <img
                      src={comment.gif_url}
                      alt="GIF"
                      className="max-w-full max-h-32 rounded"
                    />
                  </div>
                )}

                {comment.content && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap leading-relaxed">
                    {comment.content}
                  </p>
                )}

                {/* Actions and Votes - Bottom row like Reddit */}
                <div className="flex items-center gap-3 text-xs">
                  {/* Vote buttons - horizontal, compact */}
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <VoteButtons
                      contentId={comment.id}
                      contentType="comment"
                      initialUpvoteCount={currentUpvoteCount}
                      initialDownvoteCount={currentDownvoteCount}
                      initialScore={currentScore}
                      userHasUpvoted={comment.user_has_upvoted || false}
                      userHasDownvoted={comment.user_has_downvoted || false}
                      onVoteChange={handleVoteChange}
                      size="sm"
                      showCount={true}
                      horizontal={true}
                    />
                  </div>

                  {/* Action buttons */}
                  {canReply && (
                    <button
                      onClick={() => setShowReplyForm(!showReplyForm)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                    >
                      {t('comments.reply')}
                    </button>
                  )}
                  {hasReplies && (
                    <button
                      onClick={() => setShowReplies(!showReplies)}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {showReplies
                        ? t('comments.hideReplies') || 'Ocultar respostas'
                        : `${comment.reply_count || comment.replies?.length || 0} ${comment.reply_count === 1 ? t('comments.reply') : t('comments.replies')}`
                      }
                    </button>
                  )}
                </div>

                {/* Reply Form - Compact */}
                {showReplyForm && canReply && (
                  <div className="mt-2 mb-1">
                    <CommentForm
                      postId={comment.post_id}
                      parentCommentId={comment.id}
                      onSubmit={handleReply}
                      onCancel={() => setShowReplyForm(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nested Replies - Sorted by score, then by best child score */}
          {showReplies && sortedReplies.length > 0 && (
            <div className="mt-1">
              {sortedReplies.map(reply => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  onVoteChange={undefined}
                  onReply={onReply}
                  onDelete={onDelete}
                  onHide={onHide}
                  maxDepth={maxDepth}
                  currentDepth={currentDepth + 1} // Track depth for reference
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {showBanner && selectedUser && bannerPos && (
        <UserBanner
          userId={selectedUser.userId || ''}
          username={selectedUser.username}
          isAnonymous={!selectedUser.userId}
          x={bannerPos.x}
          y={bannerPos.y}
          onClose={handleClose}
        />
      )}
      {contextMenu && (
        <CommentContextMenu
          commentId={comment.id}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onReport={(commentId) => {
            setContextMenu(null);
            // Trigger report dialog - will be handled by parent component
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('reportComment', { detail: { commentId, comment } }));
            }
          }}
          onHide={(commentId) => {
            setContextMenu(null);
            if (onHide) {
              onHide(commentId);
            }
          }}
        />
      )}
    </>
  );
};

export default CommentCard;
