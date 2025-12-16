import React, { useState } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { useLanguage } from '@/contexts/LanguageContext';
import TopicContextMenu from '@/components/UI/TopicContextMenu';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import TopicInviteModal from './TopicInviteModal';

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
  settings: {
    allow_anonymous: boolean;
    require_approval: boolean;
  };
}

interface TopicListProps {
  topics: Topic[];
  loading: boolean;
  onTopicSelect: (topic: Topic) => void;
  onRefresh: () => void;
  selectedTopicId?: string;
  unreadCounts?: { [topicId: string]: number };
}

const TopicList: React.FC<TopicListProps> = ({
  topics,
  loading,
  onTopicSelect,
  onRefresh,
  selectedTopicId,
  unreadCounts = {},
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<'last_activity' | 'member_count' | 'created_at'>('last_activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ topicId: string, topicTitle: string, x: number, y: number } | null>(null);
  const [silencedTopics, setSilencedTopics] = useState<Set<string>>(new Set());
  const [hiddenTopics, setHiddenTopics] = useState<Set<string>>(new Set());
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedTopicForInvite, setSelectedTopicForInvite] = useState<Topic | null>(null);

  // Indicator State
  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number, height: number, opacity: number }>({ top: 0, height: 0, opacity: 0 });
  const listRef = React.useRef<HTMLDivElement>(null);



  // Get unique tags from topics
  const allTags = React.useMemo(() =>
    Array.from(new Set(topics.flatMap(topic => topic.tags))).sort(),
    [topics]);

  // Filter topics
  const filteredTopics = React.useMemo(() => topics.filter(topic => {
    const matchesSearch = !searchQuery ||
      topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTags = selectedTags.length === 0 ||
      selectedTags.every(tag => topic.tags.includes(tag));

    return matchesSearch && matchesTags;
  }), [topics, searchQuery, selectedTags]);

  // Sort topics
  const sortedTopics = React.useMemo(() => {
    return [...filteredTopics].sort((a, b) => {
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
  }, [filteredTopics, sortBy]);

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

  const handleSilenceTopic = async (topicId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.TOPICS.SILENCE(topicId));
      if (response.data.success) {
        setSilencedTopics(prev => new Set(prev).add(topicId));
        toast.success(t('contextMenu.topicSilenced') || 'Topic silenced');
      } else {
        toast.error(response.data.errors?.[0] || t('errors.generic'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
  };

  const handleUnsilenceTopic = async (topicId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.TOPICS.UNSILENCE(topicId));
      if (response.data.success) {
        setSilencedTopics(prev => {
          const newSet = new Set(prev);
          newSet.delete(topicId);
          return newSet;
        });
        toast.success(t('contextMenu.topicUnsilenced') || 'Topic unsilenced');
      } else {
        toast.error(response.data.errors?.[0] || t('errors.generic'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
  };

  const handleHideTopic = async (topicId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.TOPICS.HIDE(topicId));
      if (response.data.success) {
        setHiddenTopics(prev => new Set(prev).add(topicId));
        toast.success(t('contextMenu.topicHidden') || 'Topic hidden');
      } else {
        toast.error(response.data.errors?.[0] || t('errors.generic'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
  };

  const handleUnhideTopic = async (topicId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.TOPICS.UNHIDE(topicId));
      if (response.data.success) {
        setHiddenTopics(prev => {
          const newSet = new Set(prev);
          newSet.delete(topicId);
          return newSet;
        });
        toast.success(t('contextMenu.topicUnhidden') || 'Topic unhidden');
      } else {
        toast.error(response.data.errors?.[0] || t('errors.generic'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    }
  };



  React.useEffect(() => {
    if (selectedTopicId && listRef.current) {
      const selectedEl = document.getElementById(`topic-item-${selectedTopicId}`);
      if (selectedEl) {
        setIndicatorStyle({
          top: selectedEl.offsetTop,
          height: selectedEl.offsetHeight,
          opacity: 1
        });
      }
    } else {
      setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
    }
  }, [selectedTopicId, sortedTopics]);

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filters */}
      <div className="p-4 border-b theme-border">
        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            id="topic-search-input"
            placeholder={t('home.searchTopics')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-muted"
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
          id="topic-sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="w-full p-2 theme-bg-secondary theme-border rounded-lg theme-text-primary text-sm"
        >
          <option value="last_activity">{t('home.mostRecent')}</option>
          <option value="member_count">{t('home.mostMembers')}</option>
          <option value="created_at">{t('home.newest')}</option>
        </select>
      </div>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div id="tags-filter-section" className="p-4 border-b theme-border">
          <p className="text-xs font-medium theme-text-secondary mb-2">{t('home.filterByTags')}</p>
          <div className="flex flex-wrap gap-1">
            {allTags.slice(0, 10).map(tag => (
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
            {allTags.length > 10 && (
              <button className="px-2 py-1 text-xs rounded-full theme-bg-tertiary theme-text-secondary">
                +{allTags.length - 10} more
              </button>
            )}
          </div>
        </div>
      )}

      {/* Topic List */}
      <div className="flex-1 overflow-y-auto relative" ref={listRef}>
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
            <p className="theme-text-secondary">{t('home.noTopics')}</p>
            <p className="text-sm theme-text-muted mt-1">
              {searchQuery || selectedTags.length > 0
                ? t('home.tryAdjustingFilters')
                : t('home.createFirstTopic')
              }
            </p>
          </div>
        ) : (
          <div className="divide-y theme-border relative">
            {/* Animated Blue Line Indicator */}
            <div
              className="absolute left-0 w-1 bg-blue-500 rounded-r-sm transition-all duration-300 ease-in-out z-10"
              style={{
                top: `${indicatorStyle.top}px`,
                height: `${indicatorStyle.height}px`,
                opacity: indicatorStyle.opacity
              }}
            />

            {sortedTopics
              .filter(topic => !hiddenTopics.has(topic.id))
              .map((topic) => (
                <div
                  key={topic.id}
                  id={`topic-item-${topic.id}`}
                  onClick={() => onTopicSelect(topic)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({
                      topicId: topic.id,
                      topicTitle: topic.title,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  className={`relative p-4 cursor-pointer hover:theme-bg-tertiary transition-colors ${selectedTopicId === topic.id ? 'theme-bg-tertiary' : ''
                    } ${silencedTopics.has(topic.id) ? 'opacity-60' : ''}`}
                >
                  {/* Title and Member Count */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <h3 className="font-medium theme-text-primary truncate">
                        {topic.title}
                      </h3>
                      {unreadCounts[topic.id] > 0 && (
                        <span className="flex-shrink-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadCounts[topic.id] > 9 ? '9+' : unreadCounts[topic.id]}
                        </span>
                      )}
                    </div>
                    {/* Member count or Public status */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs theme-bg-tertiary theme-text-secondary">
                        {!topic.settings?.require_approval ? (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t('home.publicTopic') || 'Public'}
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            {topic.member_count} {topic.member_count === 1 ? t('home.member') : t('home.members')}
                          </>
                        )}
                      </span>
                      {topic.settings?.require_approval && topic.user_permission_level >= 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowInviteModal(true);
                            setSelectedTopicForInvite(topic);
                          }}
                          className="px-2 py-1 text-xs btn btn-ghost text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-7"
                        >
                          <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          {t('topics.inviteUsers') || 'Invite Users'}
                        </button>
                      )}
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
                    <span>{t('home.by')} {topic.owner?.username || 'Unknown'}</span>
                    <span>{formatLastActivity(topic.last_activity)}</span>
                  </div>

                  {/* Permission Badge */}
                  {topic.user_permission_level > 1 && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs theme-blue-primary text-white">
                        {topic.user_permission_level === 3 ? t('home.owner') : t('home.moderator')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>


      {/* Topic Context Menu */}
      {contextMenu && (
        <TopicContextMenu
          topicId={contextMenu.topicId}
          topicTitle={contextMenu.topicTitle}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSilence={(topicId) => {
            if (silencedTopics.has(topicId)) {
              handleUnsilenceTopic(topicId);
            } else {
              handleSilenceTopic(topicId);
            }
          }}
          onHide={(topicId) => {
            if (hiddenTopics.has(topicId)) {
              handleUnhideTopic(topicId);
            } else {
              handleHideTopic(topicId);
            }
          }}
          onDelete={async (topicId) => {
            const topic = topics.find(t => t.id === topicId);
            if (!topic) return;

            if (!confirm(t('topics.confirmDelete') || `Are you sure you want to delete "${topic.title}"? This will request deletion and the topic will be permanently deleted in 7 days pending admin approval.`)) {
              return;
            }

            try {
              const response = await api.delete(API_ENDPOINTS.TOPICS.DELETE(topicId));
              if (response.data.success) {
                toast.success(response.data.message || t('topics.deletionRequested') || 'Topic deletion requested. It will be permanently deleted in 7 days pending admin approval.');
                onRefresh();
              } else {
                toast.error(response.data.errors?.[0] || t('errors.generic'));
              }
            } catch (error: any) {
              toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
            }
          }}
          isSilenced={silencedTopics.has(contextMenu.topicId)}
          isHidden={hiddenTopics.has(contextMenu.topicId)}
          isOwner={topics.find(t => t.id === contextMenu.topicId)?.user_permission_level === 3}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && selectedTopicForInvite && (
        <TopicInviteModal
          isOpen={showInviteModal}
          onClose={() => {
            setShowInviteModal(false);
            setSelectedTopicForInvite(null);
          }}
          topicId={selectedTopicForInvite.id}
          topicTitle={selectedTopicForInvite.title}
          onInviteSent={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
};

export default TopicList;