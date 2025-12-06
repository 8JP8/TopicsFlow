import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getUserColorClass } from '@/utils/colorUtils';
import { toast } from 'react-hot-toast';
import VoteButtons from '../Vote/VoteButtons';
import CommentTree from '../Comment/CommentTree';
import LoadingSpinner from '../UI/LoadingSpinner';
import Avatar from '../UI/Avatar';
import { useUserBanner } from '@/hooks/useUserBanner';
import UserBanner from '../UI/UserBanner';
import ReportUserDialog from '../Reports/ReportUserDialog';

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
  profile_picture?: string;
}

interface PostDetailContainerProps {
  post: Post;
  topicId: string;
  posts: Post[];
  onBack: () => void;
  onPostChange: (post: Post) => void;
}

const PostDetailContainer: React.FC<PostDetailContainerProps> = ({
  post: initialPost,
  topicId,
  posts,
  onBack,
  onPostChange,
}) => {
  const { t } = useLanguage();
  const [post, setPost] = useState<Post | null>(initialPost);
  const [loading, setLoading] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [commentToReport, setCommentToReport] = useState<{ id: string, userId?: string, username?: string } | null>(null);
  const { showBanner, bannerPos, selectedUser, handleMouseEnter, handleMouseLeave, handleClick, handleClose } = useUserBanner();

  useEffect(() => {
    const handleReportComment = (event: CustomEvent) => {
      const { commentId, comment } = event.detail;
      setCommentToReport({
        id: commentId,
        userId: comment.user_id,
        username: comment.author_username || comment.display_name
      });
      setShowReportDialog(true);
    };

    window.addEventListener('reportComment' as any, handleReportComment as EventListener);
    return () => {
      window.removeEventListener('reportComment' as any, handleReportComment as EventListener);
    };
  }, []);

  useEffect(() => {
    if (initialPost) {
      loadPost(initialPost.id);
    }
  }, [initialPost.id]);

  const loadPost = async (postId: string) => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.POSTS.GET(postId));

      if (response.data.success) {
        setPost(response.data.data);
      } else {
        toast.error(response.data.errors?.[0] || t('posts.failedToLoadPost') || 'Failed to load post');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || t('posts.failedToLoadPost') || 'Failed to load post';
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
      return t('posts.ago') || 'ago';
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

  // Find current post index and get previous/next posts
  const currentIndex = posts.findIndex(p => p.id === post?.id);
  const previousPost = currentIndex > 0 ? posts[currentIndex - 1] : null;
  const nextPost = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;
  const currentPage = currentIndex >= 0 ? currentIndex + 1 : 0;
  const totalPages = posts.length;

  const handlePreviousPost = () => {
    if (previousPost) {
      onPostChange(previousPost);
    }
  };

  const handleNextPost = () => {
    if (nextPost) {
      onPostChange(nextPost);
    }
  };

  if (loading && !post) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12 theme-text-secondary">
        <p>{t('posts.postNotFound') || 'Post not found'}</p>
        <button onClick={onBack} className="mt-4 btn btn-primary">
          {t('common.back') || 'Back'}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with navigation */}
      <div className="p-4 border-b theme-border flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
            title={t('common.back') || 'Back'}
          >
            <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold theme-text-primary">
            {t('posts.post') || 'Post'}
          </h2>
        </div>

        {/* Navigation buttons with pagination */}
        {totalPages > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPost}
              disabled={!previousPost}
              className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={previousPost ? previousPost.title : t('posts.noPreviousPost') || 'No previous post'}
            >
              <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-3 py-1 text-sm font-medium theme-text-primary">
              {t('posts.postPagination', { current: currentPage, total: totalPages }) || `${currentPage} / ${totalPages}`}
            </span>
            <button
              onClick={handleNextPost}
              disabled={!nextPost}
              className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={nextPost ? nextPost.title : t('posts.noNextPost') || 'No next post'}
            >
              <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Post Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Post */}
          <div className="theme-bg-secondary rounded-lg border theme-border p-6 shadow-sm">
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
                  onVoteChange={handleVoteChange}
                  size="md"
                  showCount={true}
                />
              </div>

              {/* Content Section */}
              <div className="flex-1">
                <h1 className="text-2xl font-bold theme-text-primary mb-4">
                  {post.title}
                </h1>

                {post.gif_url && (
                  <div className="mb-4">
                    <img
                      src={post.gif_url}
                      alt="GIF"
                      className="max-w-full max-h-96 rounded-lg"
                    />
                  </div>
                )}

                {post.content && (
                  <div className="prose dark:prose-invert max-w-none mb-4">
                    <p className="theme-text-primary whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm theme-text-muted pt-4 border-t theme-border">
                  <div className="flex items-center gap-2">


                    {post.is_anonymous ? (
                      <div className={`w-6 h-6 rounded-full ${getUserColorClass(post.display_name || 'Anonymous')} flex items-center justify-center text-white font-semibold flex-shrink-0 text-xs`}>
                        {(post.display_name || 'Anonymous').charAt(0).toUpperCase()}
                      </div>
                    ) : post.user_id ? (
                      <Avatar
                        userId={post.user_id}
                        username={post.author_username || post.display_name || 'Unknown'}
                        profilePicture={post.profile_picture}
                        size="sm"
                      />
                    ) : null}
                    <span
                      className="font-medium theme-text-primary cursor-pointer hover:underline"
                      onMouseEnter={(e) => {
                        if (!post.is_anonymous && post.user_id) {
                          handleMouseEnter(e, post.user_id, post.author_username || post.display_name || 'Unknown');
                        }
                      }}
                      onMouseLeave={handleMouseLeave}
                      onClick={(e) => {
                        if (!post.is_anonymous && post.user_id) {
                          handleClick(e, post.user_id, post.author_username || post.display_name || 'Unknown');
                        }
                      }}
                    >
                      {post.is_anonymous ? post.display_name : post.author_username || 'Unknown'}
                    </span>
                  </div>
                  <span>{formatTimeAgo(post.created_at)}</span>
                  <span>
                    {post.comment_count} {post.comment_count === 1 ? t('comments.comment') : t('comments.comments')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="theme-bg-secondary rounded-lg border theme-border p-6">
            <h2 className="text-xl font-semibold theme-text-primary mb-4">
              {t('comments.title') || 'Comments'}
            </h2>
            <CommentTree postId={post.id} topicId={topicId} />
          </div>
        </div>
      </div>

      {showReportDialog && commentToReport && (
        <ReportUserDialog
          userId={commentToReport.userId}
          username={commentToReport.username}
          contentId={commentToReport.id}
          contentType="comment"
          onClose={() => {
            setShowReportDialog(false);
            setCommentToReport(null);
          }}
        />
      )}

      {/* User Banner */}
      {showBanner && selectedUser && bannerPos && (
        <UserBanner
          userId={post.is_anonymous ? '' : selectedUser.userId}
          username={selectedUser.username}
          isAnonymous={post.is_anonymous || false}
          x={bannerPos.x}
          y={bannerPos.y}
          onClose={handleClose}
        />
      )}
    </div>
  );
};

export default PostDetailContainer;

