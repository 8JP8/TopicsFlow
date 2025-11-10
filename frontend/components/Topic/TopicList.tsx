import React, { useState } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

interface Topic {
  id: string;
  title: string;
  description: string;
  tags: string[];
  member_count: number;
  last_activity: string;
  owner: {
    id: string;
    username: string;
  };
  user_permission_level: number;
}

interface TopicListProps {
  topics: Topic[];
  loading: boolean;
  onTopicSelect: (topic: Topic) => void;
  onRefresh: () => void;
  selectedTopicId?: string;
}

const TopicList: React.FC<TopicListProps> = ({
  topics,
  loading,
  onTopicSelect,
  onRefresh,
  selectedTopicId,
}) => {
  const [sortBy, setSortBy] = useState<'last_activity' | 'member_count' | 'created_at'>('last_activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Get unique tags from topics
  const allTags = Array.from(new Set(topics.flatMap(topic => topic.tags))).sort();

  // Filter topics
  const filteredTopics = topics.filter(topic => {
    const matchesSearch = !searchQuery ||
      topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTags = selectedTags.length === 0 ||
      selectedTags.every(tag => topic.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  // Sort topics
  const sortedTopics = [...filteredTopics].sort((a, b) => {
    switch (sortBy) {
      case 'member_count':
        return b.member_count - a.member_count;
      case 'created_at':
        return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
      case 'last_activity':
      default:
        return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
    }
  });

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60 * 1000) {
      return 'Active now';
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}m ago`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filters */}
      <div className="p-4 border-b theme-border">
        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 theme-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="w-full p-2 theme-bg-secondary theme-border rounded-lg theme-text-primary text-sm"
        >
          <option value="last_activity">Most Recent</option>
          <option value="member_count">Most Members</option>
          <option value="created_at">Newest</option>
        </select>
      </div>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="p-4 border-b theme-border">
          <p className="text-xs font-medium theme-text-secondary mb-2">Filter by tags:</p>
          <div className="flex flex-wrap gap-1">
            {allTags.slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  selectedTags.includes(tag)
                    ? 'theme-blue-primary text-white'
                    : 'theme-bg-tertiary theme-text-secondary hover:theme-text-primary'
                }`}
              >
                #{tag}
              </button>
            ))}
            {allTags.length > 10 && (
              <button className="px-2 py-1 text-xs rounded-full theme-bg-tertiary theme-text-secondary">
                +{allTags.length - 10} more
              </button>
            )}
          </div>
        </div>
      )}

      {/* Topic List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : sortedTopics.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 theme-text-muted mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="theme-text-secondary">No topics found</p>
            <p className="text-sm theme-text-muted mt-1">
              {searchQuery || selectedTags.length > 0
                ? 'Try adjusting your filters'
                : 'Create the first topic to get started'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y theme-border">
            {sortedTopics.map((topic) => (
              <div
                key={topic.id}
                onClick={() => onTopicSelect(topic)}
                className={`p-4 cursor-pointer hover:theme-bg-tertiary transition-colors ${
                  selectedTopicId === topic.id ? 'theme-bg-tertiary' : ''
                }`}
              >
                {/* Title and Member Count */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium theme-text-primary truncate pr-2">
                    {topic.title}
                  </h3>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs theme-bg-tertiary theme-text-secondary">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                      {topic.member_count}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {topic.description && (
                  <p className="text-sm theme-text-secondary mb-2 line-clamp-2">
                    {topic.description}
                  </p>
                )}

                {/* Tags */}
                {topic.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {topic.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="inline-block px-2 py-0.5 text-xs rounded-full theme-bg-tertiary theme-text-secondary"
                      >
                        #{tag}
                      </span>
                    ))}
                    {topic.tags.length > 3 && (
                      <span className="inline-block px-2 py-0.5 text-xs rounded-full theme-bg-tertiary theme-text-secondary">
                        +{topic.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs theme-text-muted">
                  <span>by {topic.owner.username}</span>
                  <span>{formatLastActivity(topic.last_activity)}</span>
                </div>

                {/* Permission Badge */}
                {topic.user_permission_level > 1 && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs theme-blue-primary text-white">
                      {topic.user_permission_level === 3 ? 'Owner' : 'Moderator'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="p-4 border-t theme-border">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="w-full btn btn-ghost"
        >
          {loading ? <LoadingSpinner size="sm" /> : 'Refresh'}
        </button>
      </div>
    </div>
  );
};

export default TopicList;