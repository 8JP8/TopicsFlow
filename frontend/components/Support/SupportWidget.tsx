import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import CreateTicketModal from '@/components/Tickets/CreateTicketModal';
import MyTicketsModal from '@/components/Tickets/MyTicketsModal';
import TicketDetailsModal from '@/components/Tickets/TicketDetailsModal';

interface Ticket {
    id: string;
    subject: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    created_at: string;
}

const SupportWidget: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showCreateTicket, setShowCreateTicket] = useState(false);
    const [showMyTickets, setShowMyTickets] = useState(false);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(false);
    const widgetRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const fetchRecentTickets = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const response = await api.get(API_ENDPOINTS.TICKETS.MY_TICKETS, {
                params: { limit: 3 }
            });
            if (response.data.success) {
                setRecentTickets(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch recent tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = () => {
        if (!isOpen) {
            fetchRecentTickets();
        }
        setIsOpen(!isOpen);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            case 'resolved': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (!user) return null;

    return (
        <div className="relative" ref={widgetRef}>
            {/* Header Button */}
            <button
                onClick={handleToggle}
                className="relative p-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors"
                aria-label={t('supportWidget.toggleLabel')}
                title={t('tooltips.support') || 'Support'}
            >
                <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            </button>

            {/* Dropdown Popup */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 theme-bg-secondary border theme-border rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in origin-top-right">
                    <div className="p-3 border-b theme-border flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <h3 className="font-semibold text-sm theme-text-primary">{t('supportWidget.title')}</h3>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto">
                        {loading ? (
                            <div className="p-8 flex justify-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                            </div>
                        ) : recentTickets.length > 0 ? (
                            <div className="divide-y theme-border">
                                {recentTickets.map(ticket => (
                                    <div
                                        key={ticket.id}
                                        onClick={() => { setIsOpen(false); setSelectedTicketId(ticket.id); }}
                                        className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer border-l-4 border-transparent hover:border-blue-500 group"
                                    >
                                        <div className="flex justify-between items-start mb-1.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${getStatusColor(ticket.status)}`}>
                                                {ticket.status.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs theme-text-muted group-hover:theme-text-primary transition-colors">
                                                {new Date(ticket.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-sm theme-text-primary font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {ticket.subject}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center flex flex-col items-center justify-center text-sm theme-text-secondary">
                                <svg className="w-10 h-10 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p>{t('supportWidget.noTickets')}</p>
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t theme-border grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800/50">
                        <button
                            onClick={() => { setIsOpen(false); setShowCreateTicket(true); }}
                            className="px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-center shadow-sm"
                        >
                            {t('supportWidget.createTicket')}
                        </button>
                        <button
                            onClick={() => { setIsOpen(false); setShowMyTickets(true); }}
                            className="px-3 py-2 text-xs font-medium theme-bg-white hover:theme-bg-tertiary theme-text-primary border theme-border rounded-lg transition-colors text-center shadow-sm"
                        >
                            {t('supportWidget.viewAll')}
                        </button>
                    </div>
                </div>
            )}

            {showCreateTicket && (
                <CreateTicketModal onClose={() => setShowCreateTicket(false)} />
            )}
            {showMyTickets && (
                <MyTicketsModal onClose={() => setShowMyTickets(false)} />
            )}
            {selectedTicketId && (
                <TicketDetailsModal
                    ticketId={selectedTicketId}
                    onClose={() => setSelectedTicketId(null)}
                />
            )}
        </div>
    );
};

export default SupportWidget;
