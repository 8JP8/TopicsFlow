import { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { Ticket, TicketStatus, TicketCategory } from '@/utils/ticketUtils';

interface UseTicketsParams {
  status?: TicketStatus | 'all';
  category?: TicketCategory | 'all';
  limit?: number;
  autoFetch?: boolean;
  myTickets?: boolean; // If true, fetch only user's tickets
}

interface UseTicketsReturn {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    hasMore: boolean;
  };
  nextPage: () => void;
  prevPage: () => void;
  setStatus: (status: TicketStatus | 'all') => void;
  setCategory: (category: TicketCategory | 'all') => void;
  refetch: () => Promise<void>;
}

export const useTickets = ({
  status = 'all',
  category = 'all',
  limit = 20,
  autoFetch = true,
  myTickets = false,
}: UseTicketsParams = {}): UseTicketsReturn => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>(status);
  const [filterCategory, setFilterCategory] = useState<TicketCategory | 'all'>(category);

  const fetchTickets = async () => {
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

      if (filterCategory !== 'all') {
        params.category = filterCategory;
      }

      const endpoint = myTickets ? API_ENDPOINTS.TICKETS.MY_TICKETS : API_ENDPOINTS.ADMIN.TICKETS;
      const response = await api.get(endpoint, { params });

      if (response.data.success) {
        setTickets(response.data.data || []);
        setHasMore(response.data.pagination?.has_more || false);
      } else {
        setError('Failed to load tickets');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchTickets();
    }
  }, [filterStatus, filterCategory, page, myTickets]);

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

  const setStatus = (newStatus: TicketStatus | 'all') => {
    setFilterStatus(newStatus);
    setPage(1); // Reset to first page when changing filter
  };

  const setCategory = (newCategory: TicketCategory | 'all') => {
    setFilterCategory(newCategory);
    setPage(1); // Reset to first page when changing filter
  };

  return {
    tickets,
    loading,
    error,
    pagination: {
      page,
      hasMore,
    },
    nextPage,
    prevPage,
    setStatus,
    setCategory,
    refetch: fetchTickets,
  };
};
