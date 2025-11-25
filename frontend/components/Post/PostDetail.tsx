import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { translate } from '@/utils/translations';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/router';
import UpvoteButton from '../Upvote/UpvoteButton';
import CommentTree from '../Comment/CommentTree';
import LoadingSpinner from '../UI/LoadingSpinner';
// Using simple date formatting instead of date-fns
import Link from 'next/link';

interface Post {
  id: string;
  title: string;
  content: string;
  theme_id: string;
  user_id: string;
  author_username?: string;
  display_name?: string;
  is_anonymous?: boolean;
  upvote_count: number;
  comment_count: number;
  user_has_upvoted?: boolean;
  created_at: string;
  gif_url?: string;
}

interface PostDetailProps {
  postId: string;
}

const PostDetail: React.FC<PostDetailProps> = ({ postId }) => {
  const { t } = useLanguage();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

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
      
      if (minutes < 1) return t('chat.online');
      if (minutes < 60) return `${minutes} ${t('posts.minutes')} ${t('posts.ago')}`;
      if (hours < 24) return `${hours} ${t('posts.hours')} ${t('posts.ago')}`;
      if (days < 7) return `${days} ${t('posts.days')} ${t('posts.ago')}`;
      return date.toLocaleDateString();
    } catch {
      return t('posts.ago');
    }
  };

  const handleUpvoteChange = (upvoted: boolean, newCount: number) => {
    if (post) {
      setPost({ ...post, upvote_count: newCount, user_has_upvoted: upvoted });
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
      <Link
        href={`/theme/${post.theme_id}`}
        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
      >
        ← {t('common.back')}
      </Link>

      {/* Post */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex gap-4">
          {/* Upvote Section */}
          <div className="flex flex-col items-center">
            <UpvoteButton
              contentId={post.id}
              contentType="post"
              initialUpvoteCount={post.upvote_count}
              userHasUpvoted={post.user_has_upvoted || false}
              onUpvoteChange={handleUpvoteChange}
              size="lg"
              showCount={true}
            />
          </div>

          {/* Content Section */}
          <div className="flex-1">
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

            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
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
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('comments.title')}
        </h2>
        <CommentTree postId={postId} />
      </div>
    </div>
  );
};

export default PostDetail;

