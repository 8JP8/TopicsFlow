import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import VoteButtons from '../Vote/VoteButtons';
// Using simple date formatting instead of date-fns to avoid dependency

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
}

interface PostCardProps {
  post: Post;
  onVoteChange?: (upvoted: boolean, downvoted: boolean, upCount: number, downCount: number, score: number) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onVoteChange }) => {
  const { t } = useLanguage();

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

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <Link href={`/post/${post.id}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex gap-4">
          {/* Vote Section */}
          <div className="flex flex-col items-center">
            <VoteButtons
              contentId={post.id}
              contentType="post"
              initialUpvoteCount={post.upvote_count}
              initialDownvoteCount={post.downvote_count || 0}
              initialScore={post.score !== undefined ? post.score : post.upvote_count - (post.downvote_count || 0)}
              userHasUpvoted={post.user_has_upvoted || false}
              userHasDownvoted={post.user_has_downvoted || false}
              onVoteChange={onVoteChange}
              size="md"
              showCount={true}
            />
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 hover:text-blue-600 dark:hover:text-blue-400">
              {post.title}
            </h3>

            {post.gif_url ? (
              <div className="mb-3">
                <img
                  src={post.gif_url}
                  alt="GIF"
                  className="max-w-full max-h-64 rounded-lg"
                />
              </div>
            ) : (
              <p className="text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
                {truncateContent(post.content)}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
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
    </Link>
  );
};

export default PostCard;

