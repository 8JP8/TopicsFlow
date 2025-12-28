import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import Avatar from '../UI/Avatar';
import VoteButtons from '../Vote/VoteButtons';
import CommentTree from '../Comment/CommentTree';
import LoadingSpinner from '../UI/LoadingSpinner';

import { MoreHorizontal, Share2, ArrowLeft, Bell, BellOff } from 'lucide-react';
import PostContextMenu from '../UI/PostContextMenu';
import UserContextMenu from '../UI/UserContextMenu';
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
  status?: 'open' | 'closed';
  closure_reason?: string;
  is_followed?: boolean;
  user_permission_level?: number;
}

interface PostDetailProps {
  postId: string;
}

const PostDetail: React.FC<PostDetailProps> = ({ postId }) => {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [userContextMenu, setUserContextMenu] = useState<{ x: number, y: number, userId: string, username: string } | null>(null);
  const [showReportUserDialog, setShowReportUserDialog] = useState(false);
  const [userToReport, setUserToReport] = useState<{ userId: string, username: string, contentId?: string, contentType?: 'post' | 'user' } | null>(null);

  const handleDeletePost = async () => {
    if (!post) return;
    if (!confirm(t('topics.confirmDelete') || `Are you sure you want to delete "${post.title}"?`)) {
      return;
    }

    try {
      const response = await api.delete(API_ENDPOINTS.POSTS.DELETE(post.id));
      if (response.data.success) {
        toast.success(t('topics.deletionRequested') || 'Deletion requested');
        router.back();
      } else {
        toast.error(response.data.errors?.[0] || t('errors.generic'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
  };

  const handleSilenceTopic = async (postId: string, minutes: number = -1) => {
    if (!post) return;
    try {
      if (minutes === 0) {
        await api.post(API_ENDPOINTS.MUTE.UNMUTE_POST(postId));
        toast.success(t('mute.unsilenced') || 'Unsilenced');
      } else {
        await api.post(API_ENDPOINTS.MUTE.MUTE_POST(postId), { minutes });

        // Map minutes to translation key
        const durationMap: Record<number, string> = {
          15: '15minutes',
          60: '1hour',
          480: '8hours',
          1440: '24hours',
          [-1]: 'forever'
        };
        const durationKey = durationMap[minutes] || 'forever';
        const durationText = t(`mute.${durationKey}`) || (minutes === -1 ? 'Forever' : `${minutes}m`);

        toast.success(t('mute.success', { name: post.title, duration: durationText }) || `Muted for ${durationText}`);
      }
    } catch (e) {
      toast.error(t('errors.generic'));
    }
  };

  const handleHideTopic = async () => {
    if (!post) return;
    try {
      await api.post(API_ENDPOINTS.POSTS.HIDE(post.id));
      toast.success(t('contentSettings.hidden') || 'Hidden');
      router.back();
    } catch (e) {
      toast.error(t('errors.generic'));
    }
  };

  useEffect(() => {
    if (postId) {
      fetchPost();
      checkFollowStatus();
    }
  }, [postId]);

  useEffect(() => {
    const handleReportUser = (e: CustomEvent) => {
      const { userId, username, contentId, contentType } = e.detail;
      setUserToReport({ userId, username, contentId, contentType });
      setShowReportUserDialog(true);
    };

    window.addEventListener('reportUser', handleReportUser as EventListener);
    return () => {
      window.removeEventListener('reportUser', handleReportUser as EventListener);
    };
  }, []);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.POSTS.GET(postId));
      if (response.data.success) {
        setPost(response.data.data);
      } else {
        toast.error(t('errors.postNotFound') || 'Post not found');
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      toast.error(t('errors.loadingFailed') || 'Failed to load post');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    // Assuming there's an endpoint to check follow status for posts or it comes with the post data
    // If it comes with post data (is_followed), we set it in fetchPost
  };

  useEffect(() => {
    if (post) {
      setIsFollowing(post.is_followed || false);
    }
  }, [post]);

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      await api.post(API_ENDPOINTS.NOTIFICATION_SETTINGS.FOLLOW_POST(postId));
      setIsFollowing(true);
      toast.success(t('posts.following') || 'Following post');
    } catch (error) {
      toast.error(t('errors.generic') || 'An error occurred');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    setFollowLoading(true);
    try {
      await api.delete(API_ENDPOINTS.NOTIFICATION_SETTINGS.UNFOLLOW_POST(postId));
      setIsFollowing(false);
      toast.success(t('posts.unfollowing') || 'Unfollowed post');
    } catch (error) {
      toast.error(t('errors.generic') || 'An error occurred');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    try {
      // Generate short link
      // Use window.location.origin + /post/ + post.id (or topic structure)
      // The routable page for post is usually /post/[postId] for direct access
      const targetUrl = `${window.location.origin}/post/${post.id}`;
      const response = await api.post(API_ENDPOINTS.SHORT_LINKS.GENERATE, { url: targetUrl });
      if (response.data.success) {
        const shortUrl = response.data.data.short_url;
        await navigator.clipboard.writeText(shortUrl);
        toast.success(t('common.linkCopied') || 'Link copied to clipboard');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error(t('errors.failedToShare') || 'Failed to share');
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-100 dark:border-gray-700 p-4 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft size={18} />
            {t('common.back') || 'Back'}
          </button>
          <button
            onClick={handleShare}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
            title={t('common.share') || 'Share'}
          >
            <Share2 size={18} />
          </button>
        </div>
        <div className="p-6">
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1 min-w-[3rem]">
              <VoteButtons
                contentId={post.id}
                contentType="post"
                initialUpvoteCount={post.upvote_count}
                initialDownvoteCount={post.downvote_count || 0}
                initialScore={post.score}
                userHasUpvoted={post.user_has_upvoted || false}
                userHasDownvoted={post.user_has_downvoted || false}
                onVoteChange={(upvoted: boolean, downvoted: boolean, upCount: number, downCount: number, score: number) => {
                  setPost({
                    ...post,
                    upvote_count: upCount,
                    downvote_count: downCount,
                    score: score,
                    user_has_upvoted: upvoted,
                    user_has_downvoted: downvoted
                  });
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              {/* User Info Block with Context Menu Trigger */}
              <div
                className="flex items-center gap-2 mb-3 cursor-pointer p-1 -ml-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onContextMenu={(e) => {
                  if ((!post.is_anonymous || post.user_id) && post.user_id) {
                    e.preventDefault();
                    setUserContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      userId: post.user_id,
                      username: post.author_username || 'Unknown'
                    });
                  }
                }}
              >
                {post.user_id && !post.is_anonymous ? (
                  <>
                    <Avatar
                      userId={post.user_id}
                      username={post.author_username}
                      size="sm"
                    />
                    <div className="text-sm">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        r/{post.topic_id}
                      </span>
                      <span className="text-gray-500 mx-2">•</span>
                      <span className="text-gray-500">
                        {t('posts.postedBy')}{' '}
                        <span className="font-medium hover:underline">
                          {post.author_username}
                        </span>
                      </span>
                      <span className="text-gray-500 mx-2">•</span>
                      <span className="text-gray-500">{formatTimeAgo(post.created_at)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-xs text-gray-500">?</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        r/{post.topic_id}
                      </span>
                      <span className="mx-2">•</span>
                      <span>
                        {t('posts.postedBy')}{' '}
                        <span className="font-medium">{post.is_anonymous ? post.display_name : 'Unknown'}</span>
                      </span>
                      <span className="mx-2">•</span>
                      <span>{formatTimeAgo(post.created_at)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <div className="pr-10">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 break-words">
                    {post.title}
                  </h1>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setContextMenu({ x: rect.left, y: rect.bottom });
                  }}
                  className="absolute top-0 right-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 z-10"
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>

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
                    <BellOff className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    title={t('posts.follow') || 'Follow'}
                  >
                    <Bell className="w-5 h-5" />
                    <span className="text-sm font-medium">
                      {t('posts.follow') || 'Follow'}
                    </span>
                  </button>
                )}
              </div>
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

      {/* Context Menus */}
      {contextMenu && post && (
        <PostContextMenu
          postId={post.id}
          postTitle={post.title}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSilence={handleSilenceTopic}
          onHide={handleHideTopic}
          onDelete={handleDeletePost}
          onReport={() => {
            setUserToReport({
              userId: post.user_id,
              username: post.author_username || 'Unknown',
              contentId: post.id,
              contentType: 'post'
            });
            setShowReportUserDialog(true);
          }}
          onReportUser={() => {
            setUserToReport({
              userId: post.user_id,
              username: post.author_username || 'Unknown'
            });
            setShowReportUserDialog(true);
          }}
          onBlockUser={async () => {
            if (!post.user_id) return;
            try {
              await api.post(API_ENDPOINTS.USERS.BLOCK(post.user_id));
              toast.success(t('chat.blockedUser', { username: post.author_username || 'Unknown' }));
            } catch (e: any) {
              toast.error(e.response?.data?.errors?.[0] || t('errors.generic'));
            }
          }}
          onFollow={() => {
            if (isFollowing) {
              handleUnfollow();
            } else {
              handleFollow();
            }
          }}
          onShare={handleShare}
          isFollowed={isFollowing}
          isOwner={post.user_permission_level === 3}
          authorId={post.user_id}
          authorUsername={post.author_username || 'Unknown'}
        />
      )}

      {userContextMenu && (
        <UserContextMenu
          x={userContextMenu.x}
          y={userContextMenu.y}
          userId={userContextMenu.userId}
          username={userContextMenu.username}
          onClose={() => setUserContextMenu(null)}
          onSendMessage={(userId, username) => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('openPrivateMessage', {
                detail: { userId, username }
              }));
            }
            setUserContextMenu(null);
          }}
          onBlockUser={async (userId, username) => {
            try {
              await api.post(API_ENDPOINTS.USERS.BLOCK(userId));
              toast.success(t('chat.blockedUser', { username }));
            } catch (e: any) {
              toast.error(e.response?.data?.errors?.[0] || t('errors.generic'));
            }
            setUserContextMenu(null);
          }}
          onReportUser={(userId, username) => {
            setUserToReport({ userId, username });
            setShowReportUserDialog(true);
            setUserContextMenu(null);
          }}
        />
      )}

      {showReportUserDialog && userToReport && (
        <ReportUserDialog
          userId={userToReport.userId}
          username={userToReport.username}
          contentId={userToReport.contentId}
          contentType={userToReport.contentType || 'user'}
          onClose={() => setShowReportUserDialog(false)}
        />
      )}
    </div>
  );
};

export default PostDetail;
