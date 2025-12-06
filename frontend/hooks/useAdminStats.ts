import { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';

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

interface UseAdminStatsReturn {
  stats: AdminStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useAdminStats = (autoRefreshInterval?: number): UseAdminStatsReturn => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(API_ENDPOINTS.ADMIN.STATS);
      if (response.data.success) {
        setStats(response.data.data);
      } else {
        setError('Failed to load statistics');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Auto-refresh if interval is provided
    if (autoRefreshInterval) {
      const interval = setInterval(fetchStats, autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefreshInterval]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
};
