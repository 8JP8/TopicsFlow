import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import VoteButtons from '../Vote/VoteButtons';
import PostContextMenu from '../UI/PostContextMenu';
import UserBanner from '../UI/UserBanner';
import { getUserColorClass } from '@/utils/colorUtils';
import { useUserBanner } from '@/hooks/useUserBanner';
import { api, API_ENDPOINTS } from '@/utils/api';
import toast from 'react-hot-toast';
import Avatar from '../UI/Avatar';
import UserBadges from '../UI/UserBadges';
import { getUserProfilePicture } from '@/hooks/useUserProfile';
import ReportUserDialog from '../Reports/ReportUserDialog';
import { useAuth } from '@/contexts/AuthContext';
// Using simple date formatting instead of date-fns to avoid dependency
import PostAdminModal from './PostAdminModal';

interface Post {
  id: string;
  title: string;
  content: string;
  topic_id: string;
  topic_title?: string;
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
  is_admin?: boolean;
  is_owner?: boolean;
  is_moderator?: boolean;
  status?: 'open' | 'closed';
  closure_reason?: string;
}

interface PostCardProps {
  post: Post;
  onVoteChange?: (upvoted: boolean, downvoted: boolean, upCount: number, downCount: number, score: number) => void;
  onPostSelect?: (post: Post) => void;
  onPostHidden?: (postId: string) => void;
  onPostDeleted?: (postId: string) => void;
  onStatusChange?: (postId: string, newStatus: 'open' | 'closed', newReason: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onVoteChange, onPostSelect, onPostHidden, onPostDeleted, onStatusChange }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [contextMenu, setContextMenu] = useState<{ postId: string, postTitle: string, x: number, y: number } | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [topicOwner, setTopicOwner] = useState<{ id: string, username: string } | null>(null);
  const [topicModerators, setTopicModerators] = useState<Array<{ id: string, username: string }>>([]);
  const [followedPosts, setFollowedPosts] = useState<Set<string>>(new Set(
    JSON.parse(localStorage.getItem('followedPosts') || '[]')
  ));

  // Local state for admin actions
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<'open' | 'closed'>(post.status || 'open');
  const [currentReason, setCurrentReason] = useState(post.closure_reason || '');

  const { showBanner, bannerPos, selectedUser, handleMouseEnter, handleMouseLeave, handleClick, handleClose } = useUserBanner();

  const isOwner = user?.id === post.user_id;
  const isFollowed = followedPosts.has(post.id);

  const formatTimeAgo = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (seconds < 60) return t('notifications.justNow') || 'Just now';
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

  const handlePostClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPostSelect) {
      onPostSelect(post);
    }
  };

  return (
    <>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
        onClick={handlePostClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({
            postId: post.id,
            postTitle: post.title,
            x: e.clientX,
            y: e.clientY,
          });
        }}
      >
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
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 hover:text-blue-600 dark:hover:text-blue-400 no-underline">
                {post.title}
                {currentStatus === 'closed' && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full relative -top-[1px]">
                    {t('admin.closed') || 'Closed'}
                  </span>
                )}
              </h3>

              <div className="flex items-center gap-2">
                {user?.is_admin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAdminModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                    title={t('admin.managePost') || 'Manage Post'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setContextMenu({
                      postId: post.id,
                      postTitle: post.title,
                      x: rect.left,
                      y: rect.bottom + 5,
                    });
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="More options"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                </button>
              </div>
            </div>

            {post.gif_url ? (
              <div className="mb-3">
                <img
                  src={post.gif_url}
                  alt="GIF"
                  className="max-w-full max-h-64 rounded-lg"
                />
              </div>
            ) : (
              <p className="text-gray-700 dark:text-gray-300 mb-3 line-clamp-3 no-underline">
                {truncateContent(post.content)}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 no-underline">
              {post.topic_title && (
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded no-underline">
                  {post.topic_title}
                </span>
              )}
              <div className="flex items-center gap-2 no-underline flex-wrap">


                {post.is_anonymous ? (
                  <div
                    className={`w-6 h-6 rounded-full ${getUserColorClass(post.display_name || 'Anonymous')} flex items-center justify-center text-white font-semibold flex-shrink-0 text-xs cursor-pointer`}
                    onMouseEnter={(e) => handleMouseEnter(e, '', post.display_name || 'Anonymous')}
                    onMouseLeave={handleMouseLeave}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClick(e, '', post.display_name || 'Anonymous');
                    }}
                  >
                    {(post.display_name || 'Anonymous').charAt(0).toUpperCase()}
                  </div>
                ) : post.user_id ? (
                  <Avatar
                    userId={post.user_id}
                    username={post.author_username || post.display_name || 'Unknown'}
                    profilePicture={getUserProfilePicture(post.user_id)}
                    size="sm"
                  />
                ) : null}
                <span className="no-underline">
                  {t('posts.postedBy')}{' '}
                  {!post.is_anonymous && post.user_id && post.author_username ? (
                    <span
                      className="font-medium no-underline cursor-pointer hover:underline"
                      onMouseEnter={(e) => handleMouseEnter(e, post.user_id, post.author_username!)}
                      onMouseLeave={handleMouseLeave}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleClick(e, post.user_id, post.author_username!);
                      }}
                    >
                      {post.author_username}
                    </span>
                  ) : post.is_anonymous ? (
                    <span
                      className="font-medium no-underline cursor-pointer hover:underline"
                      onMouseEnter={(e) => handleMouseEnter(e, '', post.display_name || 'Anonymous')}
                      onMouseLeave={handleMouseLeave}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleClick(e, '', post.display_name || 'Anonymous');
                      }}
                    >
                      {post.display_name || 'Anonymous'}
                    </span>
                  ) : (
                    <span className="font-medium no-underline">
                      {post.author_username || 'Unknown'}
                    </span>
                  )}
                </span>
                <UserBadges
                  isFromMe={user?.id === post.user_id}
                  isAdmin={post.is_admin}
                  isOwner={post.is_owner}
                  isModerator={post.is_moderator}
                  isAnonymous={post.is_anonymous}
                />
              </div>
              <span className="no-underline">{formatTimeAgo(post.created_at)}</span>
              <span className="no-underline">
                {post.comment_count} {post.comment_count === 1 ? t('comments.comment') : t('comments.comments')}
              </span>
            </div>
          </div>
        </div>
      </div>
      {contextMenu && (
        <PostContextMenu
          postId={contextMenu.postId}
          postTitle={contextMenu.postTitle}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onReport={async (postId) => {
            setContextMenu(null);
            // Fetch topic owner and moderators
            try {
              const topicResponse = await api.get(API_ENDPOINTS.TOPICS.GET(post.topic_id));
              if (topicResponse.data.success) {
                const topic = topicResponse.data.data;
                if (topic.owner) {
                  setTopicOwner({ id: topic.owner.id, username: topic.owner.username });
                }
                // Get moderators
                const modsResponse = await api.get(API_ENDPOINTS.TOPICS.MODERATORS(post.topic_id));
                if (modsResponse.data.success) {
                  setTopicModerators(modsResponse.data.data.map((m: any) => ({ id: m.id, username: m.username })));
                }
              }
            } catch (error) {
              console.error('Failed to fetch topic info:', error);
            }
            setShowReportDialog(true);
          }}
          isHidden={false}
          isFollowed={isFollowed}
          onFollow={async (postId) => {
            try {
              const newFollowedPosts = new Set(followedPosts);
              if (isFollowed) {
                newFollowedPosts.delete(postId);
                toast.success(t('contextMenu.postUnfollowed') || 'Post unfollowed');
              } else {
                newFollowedPosts.add(postId);
                toast.success(t('contextMenu.postFollowed') || 'Post followed');
              }
              setFollowedPosts(newFollowedPosts);
              localStorage.setItem('followedPosts', JSON.stringify(Array.from(newFollowedPosts)));

              // TODO: Replace with backend API call
              // await api.post(isFollowed ? API_ENDPOINTS.POSTS.UNFOLLOW(postId) : API_ENDPOINTS.POSTS.FOLLOW(postId));
            } catch (error: any) {
              toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
            }
            setContextMenu(null);
          }}
          onHide={async (postId) => {
            try {
              const response = await api.post(API_ENDPOINTS.POSTS.HIDE(postId));
              if (response.data.success) {
                toast.success(t('contextMenu.postHidden') || 'Post hidden');
                if (onPostHidden) {
                  onPostHidden(postId);
                }
              } else {
                toast.error(response.data.errors?.[0] || t('errors.generic'));
              }
            } catch (error: any) {
              toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
            }
            setContextMenu(null);
          }}
          onDelete={async (postId) => {
            if (!confirm(t('posts.confirmDelete') || `Are you sure you want to delete "${post.title}"? It will be permanently deleted in 7 days pending admin approval.`)) {
              return;
            }

            try {
              const response = await api.delete(API_ENDPOINTS.POSTS.DELETE(postId));
              if (response.data.success) {
                toast.success(t('posts.deletionRequested') || 'Post deletion requested. It will be permanently deleted in 7 days pending admin approval.');
                if (onPostDeleted) {
                  onPostDeleted(postId);
                }
              } else {
                toast.error(response.data.errors?.[0] || t('errors.generic'));
              }
            } catch (error: any) {
              toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
            }
            setContextMenu(null);
          }}
          isOwner={isOwner}
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
      {showAdminModal && (
        <PostAdminModal
          postId={post.id}
          currentStatus={currentStatus}
          currentReason={currentReason}
          onClose={() => setShowAdminModal(false)}
          onStatusUpdate={(newStatus, newReason) => {
            setCurrentStatus(newStatus);
            setCurrentReason((newReason || '') as string);
            if (onStatusChange) {
              onStatusChange(post.id, newStatus, (newReason || '') as string);
            }
          }}
        />
      )}
      {showReportDialog && (
        <ReportUserDialog
          contentId={post.id}
          contentType="post"
          userId={post.user_id}
          username={post.author_username || post.display_name}
          onClose={() => {
            setShowReportDialog(false);
            setTopicOwner(null);
            setTopicModerators([]);
          }}
          ownerId={topicOwner?.id}
          ownerUsername={topicOwner?.username}
          moderators={topicModerators}
          topicId={post.topic_id}
        />
      )}
    </>
  );
};

export default PostCard;

