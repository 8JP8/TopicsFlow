import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
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
  tags?: string[];
  is_followed?: boolean;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(new Set());
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
        let newPosts = response.data.data || [];

        // Filter by search query
        if (searchQuery) {
          newPosts = newPosts.filter((post: Post) =>
            post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.content.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }

        // Filter by tags
        if (selectedTags.length > 0) {
          newPosts = newPosts.filter((post: Post) =>
            post.tags && selectedTags.every(tag => post.tags!.includes(tag))
          );
        }

        if (reset) {
          setPosts(newPosts);
          setOffset(newPosts.length);
        } else {
          setPosts(prev => [...prev, ...newPosts]);
          setOffset(prev => prev + newPosts.length);
        }

        setHasMore(newPosts.length === limit);

        // Notify parent component of posts loaded (for navigation)
        if (onPostSelect && newPosts.length > 0) {
          // This will be used by parent to track available posts
        }
      } else {
        toast.error(response.data.errors?.[0] || t('posts.failedToCreatePost') || 'Failed to load posts');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || t('posts.failedToCreatePost') || 'Failed to load posts';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (topicId) {
      loadPosts(true);
    }
  }, [topicId, sortBy, searchQuery, selectedTags]);

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

  // Get unique tags from posts
  const allTags = Array.from(new Set(posts.flatMap(post => post.tags || []))).sort();

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Check if there are any posts or active filters to decide whether to show standard UI or empty state
  const hasContent = posts.length > 0 || searchQuery || selectedTags.length > 0;

  return (
    <div className="h-full flex flex-col p-4">
      {/* Search and Filters - Only show if there is content or filtering */}
      {hasContent && (
        <>
          <div className="mb-4 space-y-3">
            {/* Search with Create Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreatePost(true)}
                className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors flex-shrink-0"
                title={t('posts.createPost') || 'Create Post'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <input
                type="text"
                placeholder={t('common.search') || 'Search posts...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div>
                <p className="text-xs font-medium theme-text-secondary mb-2">{t('home.filterByTags') || 'Filter by tags'}</p>
                <div className="flex flex-wrap gap-1">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${selectedTags.includes(tag)
                        ? 'theme-blue-primary text-white'
                        : 'theme-bg-tertiary theme-text-secondary hover:theme-text-primary'
                        }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              className="px-3 pr-8 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="new">{t('posts.sortNew')}</option>
              <option value="hot">{t('posts.sortHot')}</option>
              <option value="top">{t('posts.sortTop')}</option>
              <option value="old">{t('posts.sortOld')}</option>
            </select>
          </div>
        </>
      )}

      {/* Edge case: Empty state but user clicked create from the big button */}
      {!hasContent && showCreatePost && (
        <div className="mb-4">
          <PostCreate
            topicId={topicId}
            onPostCreated={handlePostCreated}
            onCancel={() => setShowCreatePost(false)}
          />
        </div>
      )}

      {/* Posts List or Empty State */}
      <div className="flex-1 overflow-y-auto">
        {!hasContent && !showCreatePost ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-fade-in">
            <div className="mb-6 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-400 mb-2">{t('posts.noPosts') || 'No posts yet'}</h3>
            <p className="text-sm theme-text-muted max-w-sm mx-auto mb-6">
              {t('posts.beTheFirst') || "Be the first to post in this topic!"}
            </p>
            <button
              onClick={() => setShowCreatePost(true)}
              className="pw-full btn btn-primary flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('posts.createPost') || 'Create Post'}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4 p-4">
              {posts.filter(post => !hiddenPosts.has(post.id)).map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPostSelect={onPostSelect}
                  onVoteChange={(upvoted, downvoted, upCount, downCount, score) =>
                    handleVoteChange(post.id, upvoted, downvoted, upCount, downCount, score)
                  }
                  onPostHidden={(postId) => {
                    setHiddenPosts(prev => new Set(prev).add(postId));
                  }}
                  onPostDeleted={(postId) => {
                    setPosts(prev => prev.filter(p => p.id !== postId));
                  }}
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && hasContent && (
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

