import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { translate } from '@/utils/translations';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/router';
import VoteButtons from '../Vote/VoteButtons';
import CommentTree from '../Comment/CommentTree';
import LoadingSpinner from '../UI/LoadingSpinner';

interface Post {
  id: string;
  title: string;
  content: string;
  topic_id: string;
  user_id: string;
  author_username?: string;
  display_name?: string;
  is_anonymous?: boolean;
  upvote_count: number;
  downvote_count?: number;
  score?: number;
  comment_count: number;
  user_has_upvoted?: boolean;
  user_has_downvoted?: boolean;
  created_at: string;
  gif_url?: string;
  status?: 'open' | 'closed';
  closure_reason?: string;
  is_followed?: boolean;
}

interface PostDetailProps {
  postId: string;
}

const PostDetail: React.FC<PostDetailProps> = ({ postId }) => {
  const { t } = useLanguage();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (postId) {
      loadPost();
    }
  }, [postId]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.POSTS.GET(postId));

      if (response.data.success) {
        setPost(response.data.data);
        setIsFollowing(response.data.data.is_followed || false);
      } else {
        toast.error(response.data.errors?.[0] || translate('posts.failedToCreatePost'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || translate('posts.failedToCreatePost');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return t('notifications.justNow') || 'Just now';
      if (minutes < 60) return `${minutes} ${t('posts.minutes')} ${t('posts.ago')}`;
      if (hours < 24) return `${hours} ${t('posts.hours')} ${t('posts.ago')}`;
      if (days < 7) return `${days} ${t('posts.days')} ${t('posts.ago')}`;
      return date.toLocaleDateString();
    } catch {
      return t('posts.ago');
    }
  };

  const handleVoteChange = (upvoted: boolean, downvoted: boolean, upCount: number, downCount: number, score: number) => {
    if (post) {
      setPost({
        ...post,
        upvote_count: upCount,
        downvote_count: downCount,
        score: score,
        user_has_upvoted: upvoted,
        user_has_downvoted: downvoted
      });
    }
  };

  const handleFollow = async () => {
    if (!post) return;
    setFollowLoading(true);
    try {
      const response = await api.post(API_ENDPOINTS.NOTIFICATION_SETTINGS.FOLLOW_POST(post.id));
      if (response.data.success) {
        setIsFollowing(true);
        toast.success(t('posts.followed') || 'You are now following this post');
      } else {
        toast.error(response.data.errors?.[0] || t('posts.failedToFollow') || 'Failed to follow post');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('posts.failedToFollow') || 'Failed to follow post');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!post) return;
    setFollowLoading(true);
    try {
      const response = await api.post(API_ENDPOINTS.NOTIFICATION_SETTINGS.UNFOLLOW_POST(post.id));
      if (response.data.success) {
        setIsFollowing(false);
        toast.success(t('posts.unfollowed') || 'You are no longer following this post');
      } else {
        toast.error(response.data.errors?.[0] || t('posts.failedToUnfollow') || 'Failed to unfollow post');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('posts.failedToUnfollow') || 'Failed to unfollow post');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>{t('posts.noPosts')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {t('common.back')}
      </button>

      {/* Post */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex gap-4">
          {/* Vote Section */}
          <div className="flex flex-col items-center pt-1">
            <VoteButtons
              contentId={post.id}
              contentType="post"
              initialUpvoteCount={post.upvote_count}
              initialDownvoteCount={post.downvote_count || 0}
              initialScore={post.score !== undefined ? post.score : post.upvote_count - (post.downvote_count || 0)}
              userHasUpvoted={post.user_has_upvoted || false}
              userHasDownvoted={post.user_has_downvoted || false}
              onVoteChange={handleVoteChange}
              size="lg"
              showCount={true}
            />
          </div>

          {/* Content Section */}
          <div className="flex-1">
            {post.status === 'closed' && (
              <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 border-l-4 border-gray-500 rounded-r-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>{t('posts.closed') || 'Post Closed'}</span>
                  </div>
                  {post.closure_reason && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {t('posts.closedReason') || 'Reason'}: {post.closure_reason}
                    </span>
                  )}
                </div>
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {post.title}
            </h1>

            {post.gif_url ? (
              <div className="mb-4">
                <img
                  src={post.gif_url}
                  alt="GIF"
                  className="max-w-full max-h-96 rounded-lg"
                />
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none mb-4">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {post.content}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <span>
                  {t('posts.postedBy')}{' '}
                  <span className="font-medium">
                    {post.is_anonymous ? post.display_name : post.author_username || 'Unknown'}
                  </span>
                </span>
                <span>{formatTimeAgo(post.created_at)}</span>
                <span>
                  {post.comment_count} {post.comment_count === 1 ? t('comments.comment') : t('comments.comments')}
                </span>
              </div>
              {isFollowing ? (
                <button
                  onClick={handleUnfollow}
                  disabled={followLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800"
                  title={t('posts.unfollow') || 'Unfollow'}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  title={t('posts.follow') || 'Follow'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="text-sm font-medium">
                    {t('posts.follow') || 'Follow'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('comments.title')}
        </h2>
        <CommentTree postId={postId} isClosed={post.status === 'closed'} />
      </div>
    </div>
  );
};

export default PostDetail;

