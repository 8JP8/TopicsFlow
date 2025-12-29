import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getUserColorClass } from '@/utils/colorUtils';
import { toast } from 'react-hot-toast';
import VoteButtons from '../Vote/VoteButtons';
import CommentTree from '../Comment/CommentTree';
import LoadingSpinner from '../UI/LoadingSpinner';
import Avatar from '../UI/Avatar';
import { useUserBanner } from '@/hooks/useUserBanner';
import UserBanner from '../UI/UserBanner';
import ReportUserDialog from '../Reports/ReportUserDialog';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Bell,
  BellOff,
  Share2
} from 'lucide-react';
import PostContextMenu from '../UI/PostContextMenu';
import UserContextMenu from '../UI/UserContextMenu';

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
  is_followed?: boolean;
  is_silenced?: boolean;
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
  const { user } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(initialPost);
  const [loading, setLoading] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [commentToReport, setCommentToReport] = useState<{ id: string, userId?: string, username?: string } | null>(null);
  const { showBanner, bannerPos, selectedUser, handleMouseEnter, handleMouseLeave, handleClick, handleClose } = useUserBanner();
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [userContextMenu, setUserContextMenu] = useState<{ x: number, y: number, userId: string, username: string } | null>(null);

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
  const handleSilencePost = async (postId: string, minutes: number = -1) => {
    try {
      if (minutes === 0) {
        await api.post(API_ENDPOINTS.MUTE.UNMUTE_POST(postId));
        toast.success(t('mute.unsilenced') || 'Unsilenced');
        if (post && post.id === postId) {
          setPost({ ...post, is_silenced: false });
        }
      } else {
        await api.post(API_ENDPOINTS.MUTE.MUTE_POST(postId), { minutes });
        toast.success(t('mute.silenced') || 'Silenced');
        if (post && post.id === postId) {
          setPost({ ...post, is_silenced: true });
        }
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  };

  const handleBlockUser = async (userId: string, username: string) => {
    try {
      await api.post(API_ENDPOINTS.USERS.BLOCK(userId));
      toast.success(t('blocking.userBlocked', { name: username }) || `Blocked ${username}`);
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
    setUserContextMenu(null);
  };

  const handleSendMessage = (userId: string, username: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openPrivateMessage', {
        detail: { userId, username }
      }));
    }
    setUserContextMenu(null);
  };

  const handleReportUser = (userId: string, username: string) => {
    setCommentToReport({ id: 'user', userId, username });
    setShowReportDialog(true);
    setUserContextMenu(null);
  };

  const handleFollowToggle = async () => {
    if (!post) return;
    try {
      const endpoint = post.is_followed
        ? API_ENDPOINTS.NOTIFICATION_SETTINGS.UNFOLLOW_POST(post.id)
        : API_ENDPOINTS.NOTIFICATION_SETTINGS.FOLLOW_POST(post.id);
      const response = await api.post(endpoint);
      if (response.data.success) {
        setPost(prev => prev ? ({ ...prev, is_followed: !prev.is_followed }) : null);
        toast.success(post.is_followed ? (t('success.unfollowed') || 'Unfollowed post') : (t('success.followed') || 'Followed post'));
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      toast.error(t('errors.generic') || 'Action failed');
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const targetUrl = `${window.location.origin}/post/${post.id}`;
    try {
      const response = await api.post(API_ENDPOINTS.SHORT_LINKS.GENERATE, { url: targetUrl });
      if (response.data.success) {
        await navigator.clipboard.writeText(response.data.data.short_url);
        toast.success(t('common.linkCopied') || 'Link copied');
      }
    } catch {
      await navigator.clipboard.writeText(targetUrl);
      toast.success(t('common.linkCopied') || 'Link copied');
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
            <ArrowLeft className="w-5 h-5 theme-text-primary" />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold theme-text-primary">
              {t('posts.post') || 'Post'}
            </h2>
          </div>
        </div>

        {totalPages > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPost}
              disabled={!previousPost}
              className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={previousPost ? previousPost.title : t('posts.noPreviousPost') || 'No previous post'}
            >
              <ChevronLeft className="w-5 h-5 theme-text-primary" />
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
              <ChevronRight className="w-5 h-5 theme-text-primary" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Post Content */}
          <div className="theme-bg-secondary rounded-lg border theme-border p-6 shadow-sm relative">
            <div className="absolute top-4 right-4 flex items-center gap-1">
              <button
                onClick={handleFollowToggle}
                className={`p-2 rounded-lg transition-colors ${post.is_followed
                  ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                  : 'theme-text-secondary hover:theme-text-primary hover:theme-bg-tertiary'
                  }`}
                title={post.is_followed ? (t('posts.unfollow') || 'Unfollow') : (t('posts.follow') || 'Follow')}
              >
                {post.is_followed ? <BellOff size={20} /> : <Bell size={20} />}
              </button>
              <button
                onClick={handleShare}
                className="p-2 rounded-lg theme-text-secondary hover:theme-text-primary hover:theme-bg-tertiary transition-colors"
                title={t('common.share') || 'Share'}
              >
                <Share2 size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenu({
                    x: rect.right,
                    y: rect.bottom
                  });
                }}
                className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
                title={t('common.more') || 'More options'}
              >
                <MoreVertical className="w-5 h-5 theme-text-primary" />
              </button>
            </div>
            <div className="flex gap-4">
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
                  <div
                    className="flex items-center gap-2 cursor-pointer rounded hover:theme-bg-tertiary p-1 -ml-1 transition-colors"
                    onContextMenu={(e) => {
                      if (!post.is_anonymous && post.user_id) {
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
                    {post.is_anonymous ? (
                      <div
                        className={`w-6 h-6 rounded-full ${getUserColorClass(post.display_name || 'Anonymous')} flex items-center justify-center text-white font-semibold flex-shrink-0 text-xs cursor-pointer`}
                        onMouseEnter={(e) => handleMouseEnter(e, '', post.display_name || 'Anonymous')}
                        onMouseLeave={handleMouseLeave}
                        onClick={(e) => handleClick(e, '', post.display_name || 'Anonymous')}
                      >
                        {(post.display_name || 'Anonymous').charAt(0).toUpperCase()}
                      </div>
                    ) : post.user_id ? (
                      <Avatar
                        userId={post.user_id}
                        username={post.author_username || post.display_name || 'Unknown'}
                        profilePicture={post.profile_picture}
                        size="sm"
                        onClick={(e) => e && handleClick(e, post.user_id, post.author_username || post.display_name || 'Unknown')}
                        onMouseEnter={(e) => handleMouseEnter(e, post.user_id, post.author_username || post.display_name || 'Unknown')}
                        onMouseLeave={handleMouseLeave}
                        className="cursor-pointer"
                      />
                    ) : null}
                    <span
                      className="font-medium theme-text-primary cursor-pointer hover:underline"
                      onMouseEnter={(e) => {
                        if (post.is_anonymous) {
                          handleMouseEnter(e, '', post.display_name || 'Anonymous');
                        } else if (post.user_id) {
                          handleMouseEnter(e, post.user_id, post.author_username || post.display_name || 'Unknown');
                        }
                      }}
                      onMouseLeave={handleMouseLeave}
                      onClick={(e) => {
                        if (post.is_anonymous) {
                          handleClick(e, '', post.display_name || 'Anonymous');
                        } else if (post.user_id) {
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

          {/* Comments Section */}
          <div className="theme-bg-secondary rounded-lg border theme-border p-6 shadow-sm">
            <h2 className="text-xl font-semibold theme-text-primary mb-4">
              {t('comments.title') || 'Comments'}
            </h2>
            <CommentTree postId={post.id} topicId={topicId} />
          </div>
        </div>
      </div>

      {/* Dialogs and Context Menus */}
      {showReportDialog && commentToReport && (
        <ReportUserDialog
          userId={commentToReport.userId}
          username={commentToReport.username}
          contentId={commentToReport.id}
          contentType={commentToReport.id === 'user' ? 'user' : 'comment'}
          onClose={() => {
            setShowReportDialog(false);
            setCommentToReport(null);
          }}
        />
      )}

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

      {contextMenu && post && (
        <PostContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          postId={post.id}
          postTitle={post.title}
          onClose={() => setContextMenu(null)}
          isFollowed={post.is_followed}
          isSilenced={post.is_silenced}
          onFollow={handleFollowToggle}
          onShare={handleShare}
          onHide={async () => {
            if (onBack) onBack();
            try {
              await api.post(API_ENDPOINTS.POSTS.HIDE(post.id));
              toast.success(t('success.hidden') || 'Post hidden');
            } catch (error) {
              toast.error(t('errors.generic'));
            }
          }}
          onReport={() => {
            setCommentToReport({ id: post.id, userId: post.user_id, username: post.author_username || post.display_name });
            setShowReportDialog(true);
          }}
          onDelete={post.user_id === user?.id || (user as any)?.role === 'admin' ? async () => {
            if (confirm(t('common.confirmDelete') || 'Are you sure?')) {
              try {
                await api.delete(API_ENDPOINTS.POSTS.DELETE(post.id));
                toast.success(t('success.deleted') || 'Post deleted');
                onBack();
              } catch (error) {
                toast.error(t('errors.generic'));
              }
            }
          } : undefined}
          onSilence={handleSilencePost}

        />
      )}

      {userContextMenu && (
        <UserContextMenu
          x={userContextMenu.x}
          y={userContextMenu.y}
          userId={userContextMenu.userId}
          username={userContextMenu.username}
          onClose={() => setUserContextMenu(null)}
          onSendMessage={handleSendMessage}
          onBlockUser={handleBlockUser}
          onReportUser={handleReportUser}
          onSilence={() => { }} // dummy function to enable silence submenu
        />
      )}
    </div>
  );
}

export default PostDetailContainer;

