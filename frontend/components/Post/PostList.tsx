import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { translate } from '@/utils/translations';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import PostCard from './PostCard';
import PostCreate from './PostCreate';
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
}

interface PostListProps {
  topicId: string;
  onPostSelect?: (post: Post) => void;
}

const PostList: React.FC<PostListProps> = ({ topicId, onPostSelect }) => {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'new' | 'hot' | 'top' | 'old'>('new');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const limit = 20;

  const loadPosts = async (reset: boolean = false) => {
    if (!topicId) return;
    
    try {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;
      
      const response = await api.get(API_ENDPOINTS.POSTS.LIST_BY_TOPIC(topicId), {
        sort_by: sortBy,
        limit,
        offset: currentOffset,
      });

      if (response.data.success) {
        const newPosts = response.data.data || [];
        
        if (reset) {
          setPosts(newPosts);
          setOffset(newPosts.length);
        } else {
          setPosts(prev => [...prev, ...newPosts]);
          setOffset(prev => prev + newPosts.length);
        }

        setHasMore(newPosts.length === limit);
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

  useEffect(() => {
    if (topicId) {
      loadPosts(true);
    }
  }, [topicId, sortBy]);

  const handleVoteChange = (postId: string, upvoted: boolean, downvoted: boolean, upCount: number, downCount: number, score: number) => {
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? { 
              ...post, 
              upvote_count: upCount, 
              downvote_count: downCount,
              score: score,
              user_has_upvoted: upvoted,
              user_has_downvoted: downvoted
            }
          : post
      )
    );
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadPosts(false);
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const handlePostCreated = (newPost: Post) => {
    setPosts(prev => [newPost, ...prev]);
    setShowCreatePost(false);
    // Reset offset to show new post at top
    setOffset(0);
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Create Post Button */}
      <div className="mb-4">
        <button
          onClick={() => setShowCreatePost(true)}
          className="w-full btn btn-primary"
        >
          {t('posts.createPost') || 'Create Post'}
        </button>
      </div>

      {/* Create Post Form */}
      {showCreatePost && (
        <div className="mb-4">
          <PostCreate
            topicId={topicId}
            onPostCreated={handlePostCreated}
            onCancel={() => setShowCreatePost(false)}
          />
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-2 p-4 mb-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('posts.sortBy')}:
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="new">{t('posts.sortNew')}</option>
          <option value="hot">{t('posts.sortHot')}</option>
          <option value="top">{t('posts.sortTop')}</option>
          <option value="old">{t('posts.sortOld')}</option>
        </select>
      </div>

      {/* Posts List */}
      <div className="flex-1 overflow-y-auto">
        {posts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>{t('posts.noPosts')}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 p-4">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onVoteChange={(upvoted, downvoted, upCount, downCount, score) =>
                  handleVoteChange(post.id, upvoted, downvoted, upCount, downCount, score)
                }
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center py-4">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('common.loading') : t('common.loadMore')}
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
};

export default PostList;

