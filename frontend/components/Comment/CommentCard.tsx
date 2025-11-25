import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import UpvoteButton from '../Upvote/UpvoteButton';
import CommentForm from './CommentForm';
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
  upvote_count: number;
  reply_count: number;
  user_has_upvoted?: boolean;
  created_at: string;
  depth: number;
  gif_url?: string;
  replies?: Comment[];
}

interface CommentCardProps {
  comment: Comment;
  onUpvoteChange?: (upvoted: boolean, newCount: number) => void;
  onReply?: (commentId: string, content: string, gifUrl?: string) => void;
  onDelete?: (commentId: string) => void;
  maxDepth?: number;
}

const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  onUpvoteChange,
  onReply,
  onDelete,
  maxDepth = 10,
}) => {
  const { t } = useLanguage();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const formatTimeAgo = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (minutes < 1) return t('chat.online');
      if (minutes < 60) return `${minutes} ${t('posts.minutes')} ${t('posts.ago')}`;
      if (hours < 24) return `${hours} ${t('posts.hours')} ${t('posts.ago')}`;
      if (days < 7) return `${days} ${t('posts.days')} ${t('posts.ago')}`;
      return date.toLocaleDateString();
    } catch {
      return t('posts.ago');
    }
  };

  const handleReply = (content: string, gifUrl?: string) => {
    if (onReply) {
      onReply(comment.id, content, gifUrl);
      setShowReplyForm(false);
    }
  };

  const canReply = comment.depth < maxDepth;

  return (
    <div className={`${comment.depth > 0 ? 'ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-2">
        <div className="flex gap-3">
          {/* Upvote Section */}
          <div className="flex flex-col items-center">
            <UpvoteButton
              contentId={comment.id}
              contentType="comment"
              initialUpvoteCount={comment.upvote_count}
              userHasUpvoted={comment.user_has_upvoted || false}
              onUpvoteChange={onUpvoteChange}
              size="sm"
              showCount={true}
            />
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {comment.is_anonymous ? comment.display_name : comment.author_username || 'Unknown'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimeAgo(comment.created_at)}
              </span>
            </div>

            {comment.gif_url ? (
              <div className="mb-3">
                <img
                  src={comment.gif_url}
                  alt="GIF"
                  className="max-w-full max-h-48 rounded-lg"
                />
              </div>
            ) : (
              <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                {comment.content}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 text-sm">
              {canReply && (
                <button
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {t('comments.reply')}
                </button>
              )}
              {comment.reply_count > 0 && (
                <button
                  onClick={() => setShowReplies(!showReplies)}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {showReplies
                    ? t('comments.hideReplies')
                    : `${comment.reply_count} ${comment.reply_count === 1 ? t('comments.reply') : t('comments.replies')}`
                  }
                </button>
              )}
            </div>

            {/* Reply Form */}
            {showReplyForm && canReply && (
              <div className="mt-4">
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

      {/* Replies */}
      {showReplies && comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map(reply => (
            <CommentCard
              key={reply.id}
              comment={reply}
              onUpvoteChange={onUpvoteChange}
              onReply={onReply}
              onDelete={onDelete}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentCard;

