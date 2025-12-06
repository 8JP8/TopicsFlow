import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import {
  Ticket,
  getTicketStatusConfig,
  getTicketCategoryConfig,
  getTicketPriorityConfig,
  formatTicketDate,
} from '@/utils/ticketUtils';
import TicketDetailsModal from './TicketDetailsModal';

interface MyTicketsModalProps {
  onClose: () => void;
}

const MyTicketsModal: React.FC<MyTicketsModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchMyTickets();
  }, []);

  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.TICKETS.MY_TICKETS);
      if (response.data.success) {
        setTickets(response.data.data || []);
      }
    } catch (error) {
      toast.error(t('tickets.failedToLoad') || 'Failed to load your tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm(t('tickets.confirmDelete') || 'Are you sure you want to delete this ticket?')) {
      return;
    }

    try {
      const response = await api.delete(API_ENDPOINTS.TICKETS.DELETE(ticketId));
      if (response.data.success) {
        toast.success(t('tickets.deleted') || 'Ticket deleted successfully');
        fetchMyTickets();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('tickets.deleteFailed') || 'Failed to delete ticket');
    }
  };

  const handleViewDetails = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowDetails(true);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="theme-bg-secondary rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 border-b theme-border flex items-center justify-between">
            <h2 className="text-2xl font-semibold theme-text-primary">
              {t('tickets.myTickets') || 'My Support Tickets'}
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors">
              <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
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
                <p className="mb-2">{t('tickets.noTickets') || 'You have no support tickets'}</p>
                <p className="text-sm">{t('tickets.createFirstTicket') || 'Create a ticket if you need help'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map((ticket) => {
                  const statusConfig = getTicketStatusConfig(ticket.status);
                  const categoryConfig = getTicketCategoryConfig(ticket.category);
                  const priorityConfig = getTicketPriorityConfig(ticket.priority);

                  return (
                    <div
                      key={ticket.id}
                      className="theme-bg-tertiary rounded-lg p-4 border theme-border hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-lg">{categoryConfig.icon}</span>
                            <h3 className="font-semibold theme-text-primary">{ticket.subject}</h3>
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                            >
                              {statusConfig.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${priorityConfig.bgColor} ${priorityConfig.color}`}
                            >
                              {priorityConfig.label}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium theme-bg-primary theme-text-muted">
                              {categoryConfig.label}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs theme-text-muted whitespace-nowrap">
                          {formatTicketDate(ticket.created_at)}
                        </span>
                      </div>

                      <p className="text-sm theme-text-muted mb-4 line-clamp-2">{ticket.description}</p>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(ticket)}
                          className="px-3 py-1.5 text-sm btn btn-primary"
                        >
                          {t('tickets.viewDetails') || 'View Details'}
                        </button>
                        {ticket.status === 'open' && (
                          <button
                            onClick={() => handleDeleteTicket(ticket.id)}
                            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:theme-bg-secondary rounded-lg transition-colors"
                          >
                            {t('common.delete') || 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDetails && selectedTicket && (
        <TicketDetailsModal
          ticketId={selectedTicket.id}
          onClose={() => {
            setShowDetails(false);
            fetchMyTickets();
          }}
        />
      )}
    </>
  );
};

export default MyTicketsModal;
