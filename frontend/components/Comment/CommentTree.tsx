import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { translate } from '@/utils/translations';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import CommentCard from './CommentCard';
import CommentForm from './CommentForm';
import LoadingSpinner from '../UI/LoadingSpinner';
import { getAnonymousModeState, saveAnonymousModeState, getLastAnonymousName, saveLastAnonymousName } from '@/utils/anonymousStorage';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  author_username?: string;
  display_name?: string;
  is_anonymous?: boolean;
  content: string;
  parent_comment_id?: string;
  parent_author_username?: string;
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
}

interface CommentTreeProps {
  postId: string;
  topicId?: string;
  sortBy?: 'top' | 'new' | 'old';
  maxDepth?: number;
  isClosed?: boolean;
}

const CommentTree: React.FC<CommentTreeProps> = ({
  postId,
  topicId,
  sortBy = 'top',
  maxDepth = 10,
  isClosed = false,
}) => {
  const { t } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSort, setCurrentSort] = useState(sortBy);
  const [useAnonymous, setUseAnonymous] = useState(false);
  const [anonymousName, setAnonymousName] = useState<string>('');

  const buildCommentTree = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // Helper to find root comment for any comment
    const findRootComment = (commentId: string, visited = new Set<string>()): string | null => {
      if (visited.has(commentId)) return null; // Prevent cycles
      visited.add(commentId);

      const comment = flatComments.find(c => c.id === commentId);
      if (!comment) return null;

      if (!comment.parent_comment_id) {
        return commentId; // This is a root comment
      }

      return findRootComment(comment.parent_comment_id, visited);
    };

    // Helper to get the author of the previous reply in the chain
    const getPreviousReplyAuthor = (commentId: string, visited = new Set<string>()): { username: string, is_anonymous: boolean } | null => {
      if (visited.has(commentId)) return null;
      visited.add(commentId);

      const comment = flatComments.find(c => c.id === commentId);
      if (!comment || !comment.parent_comment_id) return null;

      const parent = flatComments.find(c => c.id === comment.parent_comment_id);
      if (!parent) return null;

      // If parent is a root comment, return its author
      if (!parent.parent_comment_id) {
        return {
          username: parent.is_anonymous ? (parent.display_name || 'Unknown') : (parent.author_username || 'Unknown'),
          is_anonymous: parent.is_anonymous || false
        };
      }

      // Otherwise, get the parent's author (recursive)
      return getPreviousReplyAuthor(parent.id, visited);
    };

    // First pass: create map of all comments
    flatComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: build tree structure with flat replies (Twitter/Instagram style)
    flatComments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;

      if (comment.parent_comment_id) {
        // Find the root comment (main comment)
        const rootId = findRootComment(comment.id);
        if (rootId) {
          const root = commentMap.get(rootId);
          if (root) {
            if (!root.replies) {
              root.replies = [];
            }

            // Get the author of the previous reply to mention
            const previousAuthor = getPreviousReplyAuthor(comment.id);
            if (previousAuthor) {
              commentWithReplies.parent_author_username = previousAuthor.username;
            } else {
              // Fallback: mention the root comment author
              const rootComment = flatComments.find(c => c.id === rootId);
              if (rootComment) {
                commentWithReplies.parent_author_username = rootComment.is_anonymous
                  ? (rootComment.display_name || 'Unknown')
                  : (rootComment.author_username || 'Unknown');
              }
            }

            root.replies.push(commentWithReplies);
          }
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    // Sort replies by creation time
    rootComments.forEach(root => {
      if (root.replies) {
        root.replies.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
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
        // Backend already returns comments in tree structure with replies
        const commentsData = response.data.data || [];
        setComments(commentsData);
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

  // Load anonymous identity when topicId is available
  useEffect(() => {
    if (!topicId) return;

    const loadAnonymousIdentity = async () => {
      // First, check localStorage for saved state
      const savedState = getAnonymousModeState(topicId);
      const lastName = getLastAnonymousName(topicId);

      // If we have a saved state, use it immediately
      if (savedState.isAnonymous) {
        setUseAnonymous(true);
        // Use saved name or last name
        if (savedState.name) {
          setAnonymousName(savedState.name);
        } else if (lastName) {
          setAnonymousName(lastName);
        }
      }

      // Then try to load from API to get the actual identity
      try {
        const response = await api.get(API_ENDPOINTS.TOPICS.ANONYMOUS_IDENTITY(topicId));
        if (response.data.success && response.data.data?.anonymous_name) {
          const apiName = response.data.data.anonymous_name;
          setAnonymousName(apiName);
          setUseAnonymous(true);
          // Save to localStorage
          saveAnonymousModeState(topicId, true, apiName);
          saveLastAnonymousName(topicId, apiName);
        } else {
          // If API doesn't have identity but localStorage says it should be on, keep it on with saved name
          if (savedState.isAnonymous && savedState.name) {
            setUseAnonymous(true);
            setAnonymousName(savedState.name);
          } else {
            setAnonymousName(lastName || '');
            setUseAnonymous(false);
          }
        }
      } catch (error: any) {
        // If identity doesn't exist, that's fine
        if (error.response?.status !== 404) {
          console.error('Failed to load anonymous identity:', error);
        }
        // Use saved state if available
        if (savedState.isAnonymous && savedState.name) {
          setUseAnonymous(true);
          setAnonymousName(savedState.name);
        } else {
          setAnonymousName(lastName || '');
          setUseAnonymous(false);
        }
      }
    };

    loadAnonymousIdentity();
  }, [topicId]);

  // Save anonymous mode state to localStorage whenever it changes
  useEffect(() => {
    if (topicId) {
      saveAnonymousModeState(topicId, useAnonymous, anonymousName);
      if (anonymousName) {
        saveLastAnonymousName(topicId, anonymousName);
      }
    }
  }, [topicId, useAnonymous, anonymousName]);

  const handleCommentSubmit = async (content: string, gifUrl?: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.COMMENTS.CREATE(postId), {
        content,
        gif_url: gifUrl,
        use_anonymous: useAnonymous,
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
        use_anonymous: useAnonymous,
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

  const handleVoteChange = (commentId: string, upvoted: boolean, downvoted: boolean, upCount: number, downCount: number, score: number) => {
    // Update only the specific comment without re-sorting the entire list
    // This prevents the list from jumping around when voting on comments
    const updateComment = (commentList: Comment[]): Comment[] => {
      return commentList.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            upvote_count: upCount,
            downvote_count: downCount,
            score: score,
            user_has_upvoted: upvoted,
            user_has_downvoted: downvoted
          };
        }
        if (comment.replies && comment.replies.length > 0) {
          return { ...comment, replies: updateComment(comment.replies) };
        }
        return comment;
      });
    };

    const updatedComments = updateComment(comments);

    // DO NOT re-sort the entire list - keep the order stable
    // Only update the specific comment's data
    setComments(updatedComments);
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
          className="px-3 pr-8 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
        >
          <option value="top">{t('posts.sortTop')}</option>
          <option value="new">{t('posts.sortNew')}</option>
          <option value="old">{t('posts.sortOld')}</option>
        </select>
      </div>

      {/* Comment Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        {isClosed ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 italic">
            {t('posts.commentsDisabled') || 'Comments are disabled for this post.'}
          </div>
        ) : (
          <CommentForm
            postId={postId}
            onSubmit={handleCommentSubmit}
          />
        )}
      </div>

      {/* Comments Tree */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>{t('comments.noComments')}</p>
          <p className="text-sm mt-2">{t('comments.beFirstToComment')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Display comments in their current order - don't re-sort on every vote */}
          {/* Sorting only happens when sortBy changes or on initial load */}
          {comments.map(comment => (
            <CommentCard
              key={comment.id}
              comment={comment}
              onVoteChange={(upvoted, downvoted, upCount, downCount, score) =>
                handleVoteChange(comment.id, upvoted, downvoted, upCount, downCount, score)
              }
              onReply={handleReply}
              onHide={async (commentId) => {
                try {
                  await api.post(`/api/content-settings/comments/${commentId}/hide`);
                  setComments(prev => {
                    const removeComment = (list: Comment[]): Comment[] => {
                      return list
                        .filter(c => c.id !== commentId)
                        .map(c => ({
                          ...c,
                          replies: c.replies ? removeComment(c.replies) : []
                        }));
                    };
                    return removeComment(prev);
                  });
                  toast.success(t('settings.itemHidden') || 'Comment hidden');
                } catch (error: any) {
                  console.error('Failed to hide comment:', error);
                  toast.error(error.response?.data?.errors?.[0] || 'Failed to hide comment');
                }
              }}
              maxDepth={maxDepth}
              isClosed={isClosed}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentTree;

