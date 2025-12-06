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

interface TicketDetailsModalProps {
  ticketId: string;
  onClose: () => void;
}

const TicketDetailsModal: React.FC<TicketDetailsModalProps> = ({ ticketId, onClose }) => {
  const { t } = useLanguage();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTicketDetails();
  }, [ticketId]);

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.TICKETS.GET_TICKET(ticketId));
      if (response.data.success) {
        setTicket(response.data.data);
      }
    } catch (error) {
      toast.error(t('tickets.failedToLoadDetails') || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.put(API_ENDPOINTS.TICKETS.UPDATE(ticketId), {
        message: newMessage.trim(),
      });
      if (response.data.success) {
        toast.success(t('tickets.messageAdded') || 'Message added successfully');
        setNewMessage('');
        fetchTicketDetails();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('tickets.failedToAddMessage') || 'Failed to add message');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="theme-bg-secondary rounded-lg shadow-xl p-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  const statusConfig = getTicketStatusConfig(ticket.status);
  const categoryConfig = getTicketCategoryConfig(ticket.category);
  const priorityConfig = getTicketPriorityConfig(ticket.priority);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="theme-bg-secondary rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b theme-border">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">{categoryConfig.icon}</span>
                <h2 className="text-xl font-semibold theme-text-primary">{ticket.subject}</h2>
              </div>
              <div className="flex items-center space-x-2">
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
                <span className="px-2 py-0.5 rounded text-xs font-medium theme-bg-tertiary theme-text-muted">
                  {categoryConfig.label}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors">
              <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="text-sm theme-text-muted">
            {t('tickets.createdAt') || 'Created'}: {new Date(ticket.created_at).toLocaleString()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Indicator */}
          <div className={`p-4 rounded-lg border ${statusConfig.bgColor} ${statusConfig.color.replace('text-', 'border-')}`}>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">
                {ticket.status === 'open' && (t('tickets.statusOpenInfo') || 'Your ticket is open and awaiting review')}
                {ticket.status === 'in_progress' && (t('tickets.statusInProgressInfo') || 'Our team is working on your ticket')}
                {ticket.status === 'resolved' && (t('tickets.statusResolvedInfo') || 'This ticket has been resolved')}
                {ticket.status === 'closed' && (t('tickets.statusClosedInfo') || 'This ticket is closed')}
              </span>
            </div>
          </div>

          {/* Messages/Conversation */}
          {ticket.messages && ticket.messages.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold theme-text-primary mb-3">
                {t('tickets.conversation') || 'Conversation'}
              </h3>
              <div className="space-y-3">
                {[...ticket.messages]
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-lg ${
                      msg.is_admin
                        ? 'bg-blue-100 dark:bg-blue-900/30 ml-8'
                        : 'theme-bg-tertiary mr-8'
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
                              {t('tickets.supportTeam') || 'Support Team'}
                            </>
                          ) : (
                            msg.username || t('common.you') || 'You'
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

          {/* Add Message Form */}
          {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
            <div>
              <h3 className="text-sm font-semibold theme-text-primary mb-2">
                {t('tickets.addMessage') || 'Add Additional Information'}
              </h3>
              <form onSubmit={handleAddMessage} className="space-y-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={submitting}
                  rows={4}
                  placeholder={t('tickets.messagePlaceholder') || 'Add more details or ask a question...'}
                  className="w-full px-3 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted resize-none"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || submitting}
                  className="w-full px-4 py-2 btn btn-primary disabled:opacity-50"
                >
                  {submitting ? <LoadingSpinner size="sm" /> : t('tickets.sendMessage') || 'Send Message'}
                </button>
              </form>
            </div>
          )}

          {/* Resolution Info */}
          {ticket.status === 'resolved' && ticket.resolved_at && (
            <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
              <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">
                {t('tickets.resolved') || 'Resolved'}
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                {t('tickets.resolvedAt') || 'Resolved at'}: {new Date(ticket.resolved_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
