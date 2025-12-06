import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import LoadingSpinner from '../UI/LoadingSpinner';

interface FollowedPost {
  id: string;
  title: string;
  content: string;
  topic_id: string;
  author_username: string;
  created_at: string;
  followed_at: string;
  comment_count: number;
}

interface FollowedPublicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FollowedPublicationsModal: React.FC<FollowedPublicationsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const router = useRouter();
  const [followedPosts, setFollowedPosts] = useState<FollowedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowing, setUnfollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadFollowedPosts();
    }
  }, [isOpen]);

  const loadFollowedPosts = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.NOTIFICATION_SETTINGS.FOLLOWED_POSTS);
      if (response.data.success) {
        setFollowedPosts(response.data.data || []);
      } else {
        toast.error(response.data.errors?.[0] || t('settings.failedToLoadFollowedPosts') || 'Failed to load followed posts');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('settings.failedToLoadFollowedPosts') || 'Failed to load followed posts');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (postId: string) => {
    setUnfollowing(prev => new Set(prev).add(postId));
    try {
      const response = await api.post(API_ENDPOINTS.NOTIFICATION_SETTINGS.UNFOLLOW_POST(postId));
      if (response.data.success) {
        setFollowedPosts(prev => prev.filter(p => p.id !== postId));
        toast.success(t('posts.unfollowed') || 'You are no longer following this post');
      } else {
        toast.error(response.data.errors?.[0] || t('posts.failedToUnfollow') || 'Failed to unfollow post');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('posts.failedToUnfollow') || 'Failed to unfollow post');
    } finally {
      setUnfollowing(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="theme-bg-secondary rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b theme-border">
          <h2 className="text-2xl font-bold theme-text-primary">
            {t('settings.followedPublications') || 'Followed Publications'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
          >
            <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : followedPosts.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 theme-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-lg theme-text-secondary">
                {t('settings.noFollowedPublications') || 'You are not following any publications yet.'}
              </p>
              <p className="text-sm theme-text-muted mt-2">
                {t('settings.followPublicationsHint') || 'Follow publications to receive notifications for new comments.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {followedPosts.map((post) => (
                <div
                  key={post.id}
                  className="theme-bg-primary rounded-lg border theme-border p-4 hover:theme-bg-tertiary transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => {
                      router.push(`/post/${post.id}`);
                      onClose();
                    }}>
                      <h3 className="text-lg font-semibold theme-text-primary mb-2 hover:underline">
                        {post.title}
                      </h3>
                      <p className="text-sm theme-text-secondary mb-3 line-clamp-2">
                        {post.content}
                      </p>
                      <div className="flex items-center gap-4 text-xs theme-text-muted">
                        <span>{t('posts.postedBy')} {post.author_username}</span>
                        <span>{formatDate(post.created_at)}</span>
                        <span>{post.comment_count} {post.comment_count === 1 ? t('comments.comment') : t('comments.comments')}</span>
                        <span>{t('settings.followedSince')} {formatDate(post.followed_at)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnfollow(post.id)}
                      disabled={unfollowing.has(post.id)}
                      className="ml-4 p-2 rounded-lg theme-bg-tertiary hover:theme-bg-primary transition-colors disabled:opacity-50"
                      title={t('posts.unfollow') || 'Unfollow'}
                    >
                      {unfollowing.has(post.id) ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <svg className="w-5 h-5 theme-text-primary" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowedPublicationsModal;

