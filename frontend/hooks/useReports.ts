import { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { Report, ReportStatus } from '@/utils/reportUtils';

interface UseReportsParams {
  status?: ReportStatus | 'all';
  limit?: number;
  autoFetch?: boolean;
}

interface UseReportsReturn {
  reports: Report[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    hasMore: boolean;
  };
  nextPage: () => void;
  prevPage: () => void;
  setStatus: (status: ReportStatus | 'all') => void;
  refetch: () => Promise<void>;
}

export const useReports = ({
  status = 'all',
  limit = 20,
  autoFetch = true,
}: UseReportsParams = {}): UseReportsReturn => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ReportStatus | 'all'>(status);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        limit,
        offset: (page - 1) * limit,
      };

      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }

      const response = await api.get(API_ENDPOINTS.ADMIN.REPORTS, { params });

      if (response.data.success) {
        setReports(response.data.data || []);
        setHasMore(response.data.pagination?.has_more || false);
      } else {
        setError('Failed to load reports');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchReports();
    }
  }, [filterStatus, page]);

  const nextPage = () => {
    if (hasMore) {
      setPage((p) => p + 1);
    }
  };

  const prevPage = () => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  };

  const setStatus = (newStatus: ReportStatus | 'all') => {
    setFilterStatus(newStatus);
    setPage(1); // Reset to first page when changing filter
  };

  return {
    reports,
    loading,
    error,
    pagination: {
      page,
      hasMore,
    },
    nextPage,
    prevPage,
    setStatus,
    refetch: fetchReports,
  };
};
