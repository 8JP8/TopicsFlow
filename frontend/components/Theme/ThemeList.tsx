import React, { useState } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';

interface Theme {
  id: string;
  title: string;
  description: string;
  tags: string[];
  member_count: number;
  post_count?: number;
  last_activity: string;
  owner: {
    id: string;
    username: string;
  };
  user_permission_level?: number;
  settings: {
    allow_anonymous: boolean;
    require_approval: boolean;
  };
}

interface ThemeListProps {
  themes: Theme[];
  loading: boolean;
  onThemeSelect?: (theme: Theme) => void;
  onRefresh?: () => void;
  selectedThemeId?: string;
}

const ThemeList: React.FC<ThemeListProps> = ({
  themes,
  loading,
  onThemeSelect,
  onRefresh,
  selectedThemeId,
}) => {
  const { t } = useLanguage();
  const [sortBy, setSortBy] = useState<'last_activity' | 'member_count' | 'created_at' | 'post_count'>('last_activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Get unique tags from themes
  const allTags = Array.from(new Set(themes.flatMap(theme => theme.tags))).sort();

  // Filter themes
  const filteredThemes = themes.filter(theme => {
    const matchesSearch = !searchQuery ||
      theme.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      theme.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTags = selectedTags.length === 0 ||
      selectedTags.every(tag => theme.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  // Sort themes
  const sortedThemes = [...filteredThemes].sort((a, b) => {
    switch (sortBy) {
      case 'member_count':
        return b.member_count - a.member_count;
      case 'post_count':
        return (b.post_count || 0) - (a.post_count || 0);
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
      return t('chat.online');
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}${t('posts.minutes')} ${t('posts.ago')}`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}${t('posts.hours')} ${t('posts.ago')}`;
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (24 * 60 * 60 * 1000))}${t('posts.days')} ${t('posts.ago')}`;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">{t('posts.sortBy')}:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="last_activity">{t('topics.sortByLastActivity')}</option>
            <option value="member_count">{t('topics.sortByMembers')}</option>
            <option value="post_count">{t('themes.posts')}</option>
            <option value="created_at">{t('topics.sortByCreated')}</option>
          </select>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`
                  px-3 py-1 rounded-full text-sm transition-colors
                  ${selectedTags.includes(tag)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }
                `}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Theme List */}
      <div className="flex-1 overflow-y-auto">
        {sortedThemes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p>{t('themes.noThemes')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedThemes.map(theme => (
              <Link
                key={theme.id}
                href={`/theme/${theme.id}`}
                className={`
                  block p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                  ${selectedThemeId === theme.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                `}
                onClick={(e) => {
                  if (onThemeSelect) {
                    e.preventDefault();
                    onThemeSelect(theme);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {theme.title}
                    </h3>
                    {theme.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {theme.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{theme.member_count} {t('themes.members')}</span>
                      {theme.post_count !== undefined && (
                        <span>{theme.post_count} {t('themes.posts')}</span>
                      )}
                      <span>{formatLastActivity(theme.last_activity)}</span>
                    </div>
                    {theme.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {theme.tags.slice(0, 5).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                          >
                            #{tag}
                          </span>
                        ))}
                        {theme.tags.length > 5 && (
                          <span className="px-2 py-0.5 text-gray-500 dark:text-gray-500 text-xs">
                            +{theme.tags.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeList;


