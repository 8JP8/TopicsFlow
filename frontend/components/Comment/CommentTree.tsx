import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { translate } from '@/utils/translations';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import CommentCard from './CommentCard';
import CommentForm from './CommentForm';
import LoadingSpinner from '../UI/LoadingSpinner';

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

interface CommentTreeProps {
  postId: string;
  sortBy?: 'top' | 'new' | 'old';
  maxDepth?: number;
}

const CommentTree: React.FC<CommentTreeProps> = ({
  postId,
  sortBy = 'top',
  maxDepth = 10,
}) => {
  const { t } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSort, setCurrentSort] = useState(sortBy);

  const buildCommentTree = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // First pass: create map of all comments
    flatComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: build tree structure
    flatComments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          if (!parent.replies) {
            parent.replies = [];
          }
          parent.replies.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments;
  };

  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.COMMENTS.LIST_BY_POST(postId), {
        sort_by: currentSort,
        limit: 100,
      });

      if (response.data.success) {
        const flatComments = response.data.data || [];
        const treeComments = buildCommentTree(flatComments);
        setComments(treeComments);
      } else {
        toast.error(response.data.errors?.[0] || translate('comments.failedToCreateComment'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || translate('comments.failedToCreateComment');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (postId) {
      loadComments();
    }
  }, [postId, currentSort]);

  const handleCommentSubmit = async (content: string, gifUrl?: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.COMMENTS.CREATE(postId), {
        content,
        gif_url: gifUrl,
        use_anonymous: false,
      });

      if (response.data.success) {
        toast.success(t('comments.commentCreated'));
        await loadComments();
      } else {
        toast.error(response.data.errors?.[0] || t('comments.failedToCreateComment'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || t('comments.failedToCreateComment');
      toast.error(errorMessage);
    }
  };

  const handleReply = async (parentCommentId: string, content: string, gifUrl?: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.COMMENTS.REPLY(parentCommentId), {
        content,
        gif_url: gifUrl,
        use_anonymous: false,
      });

      if (response.data.success) {
        toast.success(t('comments.replyCreated'));
        await loadComments();
      } else {
        toast.error(response.data.errors?.[0] || t('comments.failedToCreateReply'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || t('comments.failedToCreateReply');
      toast.error(errorMessage);
    }
  };

  const handleUpvoteChange = (commentId: string, upvoted: boolean, newCount: number) => {
    const updateComment = (commentList: Comment[]): Comment[] => {
      return commentList.map(comment => {
        if (comment.id === commentId) {
          return { ...comment, upvote_count: newCount, user_has_upvoted: upvoted };
        }
        if (comment.replies) {
          return { ...comment, replies: updateComment(comment.replies) };
        }
        return comment;
      });
    };

    setComments(updateComment(comments));
  };

  if (loading && comments.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('posts.sortBy')}:
        </label>
        <select
          value={currentSort}
          onChange={(e) => setCurrentSort(e.target.value as any)}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="top">{t('posts.sortTop')}</option>
          <option value="new">{t('posts.sortNew')}</option>
          <option value="old">{t('posts.sortOld')}</option>
        </select>
      </div>

      {/* Comment Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <CommentForm
          postId={postId}
          onSubmit={handleCommentSubmit}
        />
      </div>

      {/* Comments Tree */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>{t('comments.noComments')}</p>
          <p className="text-sm mt-2">{t('comments.beFirstToComment')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map(comment => (
            <CommentCard
              key={comment.id}
              comment={comment}
              onUpvoteChange={(upvoted, newCount) =>
                handleUpvoteChange(comment.id, upvoted, newCount)
              }
              onReply={handleReply}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentTree;

