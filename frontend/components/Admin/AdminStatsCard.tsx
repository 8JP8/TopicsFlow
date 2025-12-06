import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

interface AdminStatsCardProps {
  onClose: () => void;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  banned_users: number;
  total_reports: number;
  pending_reports: number;
  resolved_reports: number;
  total_tickets: number;
  open_tickets: number;
  pending_tickets: number;
  resolved_tickets: number;
  total_topics: number;
  total_messages: number;
}

const AdminStatsCard: React.FC<AdminStatsCardProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.ADMIN.STATS);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      toast.error(t('admin.failedToLoadStats') || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats
    ? [
        {
          title: t('admin.totalUsers') || 'Total Users',
          value: stats.total_users.toLocaleString(),
          icon: '👥',
          color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        },
        {
          title: t('admin.activeUsers') || 'Active Users',
          value: stats.active_users.toLocaleString(),
          icon: '✓',
          color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
        },
        {
          title: t('admin.bannedUsers') || 'Banned Users',
          value: stats.banned_users.toLocaleString(),
          icon: '🚫',
          color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
        },
        {
          title: t('admin.pendingReports') || 'Pending Reports',
          value: stats.pending_reports.toLocaleString(),
          icon: '⚠️',
          color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
        },
        {
          title: t('admin.totalReports') || 'Total Reports',
          value: stats.total_reports.toLocaleString(),
          icon: '📋',
          color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
        },
        {
          title: t('admin.pendingTickets') || 'Pending Tickets',
          value: stats.pending_tickets.toLocaleString(),
          icon: '🎫',
          color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
        },
        {
          title: t('admin.totalTickets') || 'Total Tickets',
          value: stats.total_tickets.toLocaleString(),
          icon: '📝',
          color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
        },
        {
          title: t('admin.totalTopics') || 'Total Topics',
          value: stats.total_topics.toLocaleString(),
          icon: '💬',
          color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
        },
        {
          title: t('admin.totalMessages') || 'Total Messages',
          value: stats.total_messages.toLocaleString(),
          icon: '✉️',
          color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
        },
      ]
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="theme-bg-secondary rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold theme-text-primary">
              {t('admin.statistics') || 'Admin Statistics'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
            >
              <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stats Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((stat, index) => (
                <div key={index} className="theme-bg-tertiary rounded-lg p-6 border theme-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl">{stat.icon}</span>
                    <div className={`px-3 py-1 rounded-lg ${stat.color} font-bold text-2xl`}>
                      {stat.value}
                    </div>
                  </div>
                  <h3 className="text-sm font-medium theme-text-muted">{stat.title}</h3>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 theme-text-muted">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p>{t('admin.noStatsAvailable') || 'No statistics available'}</p>
            </div>
          )}

          {/* Additional Info */}
          {stats && (
            <div className="mt-6 p-4 theme-bg-tertiary rounded-lg border theme-border">
              <h3 className="text-sm font-semibold theme-text-primary mb-2">
                {t('admin.quickStats') || 'Quick Stats'}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="theme-text-muted">{t('admin.resolvedReports') || 'Resolved Reports'}:</span>
                  <span className="theme-text-primary font-semibold ml-2">{stats.resolved_reports}</span>
                </div>
                <div>
                  <span className="theme-text-muted">{t('admin.openTickets') || 'Open Tickets'}:</span>
                  <span className="theme-text-primary font-semibold ml-2">{stats.open_tickets}</span>
                </div>
                <div>
                  <span className="theme-text-muted">{t('admin.resolvedTickets') || 'Resolved Tickets'}:</span>
                  <span className="theme-text-primary font-semibold ml-2">{stats.resolved_tickets}</span>
                </div>
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <div className="mt-6 flex justify-end">
            <button onClick={fetchStats} disabled={loading} className="px-4 py-2 btn btn-primary">
              {loading ? <LoadingSpinner size="sm" /> : t('admin.refreshStats') || 'Refresh Statistics'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStatsCard;
