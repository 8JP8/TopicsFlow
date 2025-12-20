import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import {
  Ticket,
  TicketStatus,
  TicketCategory,
  TicketPriority,
  getTicketStatusConfig,
  getTicketCategoryConfig,
  getTicketPriorityConfig,
  formatTicketDate,
} from '@/utils/ticketUtils';

interface TicketsModalProps {
  onClose: () => void;
}

const TicketsModal: React.FC<TicketsModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<TicketCategory | 'all'>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [response, setResponse] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  useEffect(() => {
    fetchTickets();
  }, [filterStatus, filterCategory, page]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params: any = {
        limit,
        offset: (page - 1) * limit,
      };
      // Only add filters if they're not 'all'
      if (filterStatus && filterStatus !== 'all') {
        params.status = filterStatus;
      }
      if (filterCategory && filterCategory !== 'all') {
        params.category = filterCategory;
      }

      console.log('[TicketsModal] Fetching tickets with params:', params);
      const response = await api.get(API_ENDPOINTS.ADMIN.TICKETS, { params });
      if (response.data.success) {
        let ticketsData = response.data.data || [];

        // Frontend-side filtering as fallback (in case backend doesn't filter correctly)
        if (filterStatus && filterStatus !== 'all') {
          ticketsData = ticketsData.filter((ticket: Ticket) => ticket.status === filterStatus);
        }
        if (filterCategory && filterCategory !== 'all') {
          ticketsData = ticketsData.filter((ticket: Ticket) => ticket.category === filterCategory);
        }

        console.log('[TicketsModal] Received tickets:', ticketsData.length, 'with filters:', { status: filterStatus, category: filterCategory });
        setTickets(ticketsData);
        // Update pagination based on filtered results
        const currentOffset = (page - 1) * limit;
        const filteredCount = ticketsData.length;
        const totalFromBackend = response.data.pagination?.total || 0;
        setHasMore(filteredCount === limit && (currentOffset + limit < totalFromBackend));
      }
    } catch (error) {
      console.error('[TicketsModal] Error fetching tickets:', error);
      toast.error(t('admin.failedToLoadTickets') || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      setUpdatingStatus(true);
      const res = await api.put(API_ENDPOINTS.ADMIN.TICKET_UPDATE(ticketId), {
        status: newStatus,
      });
      if (res.data.success) {
        toast.success(t('admin.ticketUpdated') || 'Ticket updated successfully');
        fetchTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket({ ...selectedTicket, status: newStatus });
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('admin.failedToUpdateTicket') || 'Failed to update ticket');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReopenTicket = async (ticketId: string) => {
    try {
      setUpdatingStatus(true);
      const res = await api.put(API_ENDPOINTS.ADMIN.TICKET_UPDATE(ticketId), {
        reopen: true,
        reason: 'Ticket reopened by admin',
      });
      if (res.data.success) {
        toast.success(t('admin.ticketReopened') || 'Ticket reopened successfully');
        fetchTickets();
        if (selectedTicket?.id === ticketId) {
          const detailsRes = await api.get(API_ENDPOINTS.TICKETS.GET_TICKET(ticketId));
          if (detailsRes.data.success) {
            setSelectedTicket(detailsRes.data.data);
          }
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('admin.failedToReopenTicket') || 'Failed to reopen ticket');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddResponse = async () => {
    if (!selectedTicket || !response.trim()) {
      return;
    }

    try {
      const res = await api.put(API_ENDPOINTS.ADMIN.TICKET_UPDATE(selectedTicket.id), {
        admin_response: response.trim(),
      });
      if (res.data.success) {
        toast.success(t('admin.responseAdded') || 'Response added successfully');
        setResponse('');
        fetchTickets();
        // Refresh ticket details
        const detailsRes = await api.get(API_ENDPOINTS.TICKETS.GET_TICKET(selectedTicket.id));
        if (detailsRes.data.success) {
          setSelectedTicket(detailsRes.data.data);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('admin.failedToAddResponse') || 'Failed to add response');
    }
  };

  const statusOptions: Array<{ value: TicketStatus | 'all'; label: string }> = [
    { value: 'all', label: t('admin.allTickets') || 'All' },
    { value: 'open', label: t(getTicketStatusConfig('open').label) },
    { value: 'in_progress', label: t(getTicketStatusConfig('in_progress').label) },
    { value: 'resolved', label: t(getTicketStatusConfig('resolved').label) },
    { value: 'closed', label: t(getTicketStatusConfig('closed').label) },
  ];

  const categoryOptions: Array<{ value: TicketCategory | 'all'; label: string }> = [
    { value: 'all', label: t('admin.allCategories') || 'All Categories' },
    { value: 'bug', label: t(getTicketCategoryConfig('bug').label) },
    { value: 'feature', label: t(getTicketCategoryConfig('feature').label) },
    { value: 'account', label: t(getTicketCategoryConfig('account').label) },
    { value: 'abuse', label: t(getTicketCategoryConfig('abuse').label) },
    { value: 'other', label: t(getTicketCategoryConfig('other').label) },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b theme-border flex items-center justify-between">
          <h2 className="text-2xl font-semibold theme-text-primary">
            {t('admin.tickets') || 'Support Tickets'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors">
            <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b theme-border">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium theme-text-primary">
                {t('admin.status') || 'Status:'}
              </label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as TicketStatus | 'all');
                  setPage(1);
                }}
                className="px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary text-sm"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium theme-text-primary">
                {t('admin.category') || 'Category:'}
              </label>
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value as TicketCategory | 'all');
                  setPage(1);
                }}
                className="px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary text-sm"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Tickets List */}
          <div className={`${selectedTicket ? 'w-1/2' : 'w-full'} border-r theme-border overflow-y-auto`}>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 theme-text-muted">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                  />
                </svg>
                <p>{t('admin.noTickets') || 'No tickets found'}</p>
              </div>
            ) : (
              <div className="divide-y theme-border">
                {tickets.map((ticket) => {
                  const statusConfig = getTicketStatusConfig(ticket.status);
                  const categoryConfig = getTicketCategoryConfig(ticket.category);
                  const priorityConfig = getTicketPriorityConfig(ticket.priority);
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`w-full p-4 text-left hover:theme-bg-tertiary transition-colors ${selectedTicket?.id === ticket.id ? 'theme-bg-tertiary' : ''
                        }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg">{categoryConfig.icon}</span>
                            <span className="font-semibold theme-text-primary">{ticket.subject}</span>
                          </div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                              {t(statusConfig.label)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityConfig.bgColor} ${priorityConfig.color}`}>
                              {t(priorityConfig.label)}
                            </span>
                          </div>
                          <p className="text-sm theme-text-muted">
                            {t('admin.user') || 'User'}: {ticket.username || 'Unknown'}
                          </p>
                        </div>
                        <span className="text-xs theme-text-muted whitespace-nowrap">
                          {formatTicketDate(ticket.created_at)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ticket Details */}
          {selectedTicket && (
            <div className="w-1/2 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold theme-text-primary mb-4">
                    {t('admin.ticketDetails') || 'Ticket Details'}
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.subject') || 'Subject'}
                    </label>
                    <p className="theme-text-primary font-semibold">{selectedTicket.subject}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.category') || 'Category'}
                    </label>
                    <p className="theme-text-primary">{t(getTicketCategoryConfig(selectedTicket.category).label)}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.priority') || 'Priority'}
                    </label>
                    <p className="theme-text-primary">{t(getTicketPriorityConfig(selectedTicket.priority).label)}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.status') || 'Status'}
                    </label>
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value as TicketStatus)}
                      disabled={updatingStatus}
                      className="mt-1 px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary text-sm"
                    >
                      <option value="open">{t(getTicketStatusConfig('open').label)}</option>
                      <option value="in_progress">{t(getTicketStatusConfig('in_progress').label)}</option>
                      <option value="resolved">{t(getTicketStatusConfig('resolved').label)}</option>
                      <option value="closed">{t(getTicketStatusConfig('closed').label)}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.user') || 'User'}
                    </label>
                    <p className="theme-text-primary">{selectedTicket.username || 'Unknown'}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.description') || 'Description'}
                    </label>
                    <p className="theme-text-primary whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      {t('admin.createdAt') || 'Created at'}
                    </label>
                    <p className="theme-text-primary">
                      {new Date(selectedTicket.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Messages/Conversation */}
                  {selectedTicket.messages && selectedTicket.messages.length > 0 && (
                    <div>
                      <label className="text-sm font-medium theme-text-primary mb-3 block">
                        {t('admin.conversation') || 'Conversation'}
                      </label>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {[...selectedTicket.messages]
                          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                          .map((msg) => (
                            <div
                              key={msg.id}
                              className={`p-4 rounded-lg border ${msg.is_admin
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ml-8'
                                : 'theme-bg-tertiary theme-border mr-8'
                                }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-semibold theme-text-primary">
                                    {msg.is_admin ? (
                                      <>
                                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                          />
                                        </svg>
                                        {t('admin.admin') || 'Admin'}
                                      </>
                                    ) : (
                                      msg.username || t('admin.user') || 'User'
                                    )}
                                  </span>
                                </div>
                                <span className="text-xs theme-text-muted">
                                  {formatTicketDate(msg.created_at)}
                                </span>
                              </div>
                              <p className="text-sm theme-text-primary whitespace-pre-wrap">{msg.message}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 space-y-2">
                  {/* Reopen button for closed/resolved tickets */}
                  {(selectedTicket.status === 'closed' || selectedTicket.status === 'resolved') && (
                    <button
                      onClick={() => handleReopenTicket(selectedTicket.id)}
                      disabled={updatingStatus}
                      className="w-full px-4 py-2 btn btn-secondary disabled:opacity-50"
                    >
                      {t('admin.reopenTicket') || 'Reopen Ticket'}
                    </button>
                  )}

                  {/* Add Response */}
                  {selectedTicket.status !== 'closed' && (
                    <>
                      <label className="text-sm font-medium theme-text-primary">
                        {t('admin.addResponse') || 'Add Response'}
                      </label>
                      <textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        rows={4}
                        placeholder={t('admin.responsePlaceholder') || 'Type your response...'}
                        className="w-full px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted resize-none"
                      />
                      <button
                        onClick={handleAddResponse}
                        disabled={!response.trim()}
                        className="w-full px-4 py-2 btn btn-primary disabled:opacity-50"
                      >
                        {t('admin.sendResponse') || 'Send Response'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && tickets.length > 0 && (
          <div className="p-4 border-t theme-border flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 btn btn-ghost disabled:opacity-50"
            >
              {t('common.previous') || 'Previous'}
            </button>
            <span className="text-sm theme-text-muted">
              {t('common.page') || 'Page'} {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="px-4 py-2 btn btn-ghost disabled:opacity-50"
            >
              {t('common.next') || 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketsModal;
