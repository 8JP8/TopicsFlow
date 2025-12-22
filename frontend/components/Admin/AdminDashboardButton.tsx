import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSocket } from '@/contexts/SocketContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import toast from 'react-hot-toast';
import ReportsModal from './ReportsModal';
import TicketsModal from './TicketsModal';
import BannedUsersModal from './BannedUsersModal';
import DeletedMessagesModal from './DeletedMessagesModal';
import PendingDeletionsModal from './PendingDeletionsModal';

const AdminDashboardButton: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket } = useSocket();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [showBannedUsers, setShowBannedUsers] = useState(false);
  const [showDeletedMessages, setShowDeletedMessages] = useState(false);
  const [showPendingDeletions, setShowPendingDeletions] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.is_admin) {
      fetchPendingCount();
      // Refresh count every 30 seconds
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Listen for admin notifications via WebSocket
  useEffect(() => {
    if (!user?.is_admin || !socket) return;

    const handleAdminNotification = (data: any) => {
      console.log('[Admin] Received notification:', data);
      // Refresh stats
      fetchPendingCount();

      // Show toast notification
      if (data.type === 'new_report') {
        toast(t('admin.newReportReceived') || 'New report received', { icon: '📋' });
      } else if (data.type === 'new_ticket') {
        toast(t('admin.newTicketReceived') || 'New support ticket received', { icon: '🎫' });
      }
    };

    socket.on('admin_notification', handleAdminNotification);

    return () => {
      socket.off('admin_notification', handleAdminNotification);
    };
  }, [user, socket, t]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const fetchPendingCount = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.ADMIN.STATS);
      if (response.data.success) {
        const statsData = response.data.data;
        setStats(statsData);
        // Get pending counts from nested stats objects
        const pendingReports = statsData.reports?.pending || 0;
        const pendingTickets = statsData.tickets?.pending || 0;
        const pending = pendingReports + pendingTickets;
        setPendingCount(pending);
      }
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    }
  };

  const handleReportsClick = () => {
    setShowDropdown(false);
    setShowReports(true);
  };

  const handleTicketsClick = () => {
    setShowDropdown(false);
    setShowTickets(true);
  };

  const handleBannedUsersClick = () => {
    setShowDropdown(false);
    setShowBannedUsers(true);
  };

  const handleDeletedMessagesClick = () => {
    setShowDropdown(false);
    setShowDeletedMessages(true);
  };

  const handlePendingDeletionsClick = () => {
    setShowDropdown(false);
    setShowPendingDeletions(true);
  };

  if (!user?.is_admin) {
    return null;
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          id="admin-dashboard-btn"
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative px-3 py-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors flex items-center gap-2"
          title={t('tooltips.adminDashboard') || 'Admin Dashboard'}
        >
          <span className="text-sm font-medium theme-text-primary hidden sm:inline">
            {t('admin.controls') || 'Admin Controls'}
          </span>
          <svg
            className="w-5 h-5 theme-text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>

        {showDropdown && (
          <div className="fixed top-16 right-0 w-full sm:w-80 md:absolute md:top-full md:right-0 md:mt-2 theme-bg-secondary border theme-border rounded-lg shadow-xl z-50">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold theme-text-primary">
                  {t('admin.controls') || 'Admin Controls'}
                </h3>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
                >
                  <svg className="w-4 h-4 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Stats Summary */}
              {stats && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 theme-bg-tertiary rounded-lg">
                    <div className="text-2xl font-bold theme-text-primary">
                      {stats.reports?.total || 0}
                    </div>
                    <div className="text-xs theme-text-muted">
                      {t('admin.totalReports') || 'Total Reports'}
                    </div>
                  </div>
                  <div className="p-3 theme-bg-tertiary rounded-lg">
                    <div className="text-2xl font-bold theme-text-primary">
                      {stats.tickets?.total || 0}
                    </div>
                    <div className="text-xs theme-text-muted">
                      {t('admin.totalTickets') || 'Total Tickets'}
                    </div>
                  </div>
                  <div className="p-3 theme-bg-tertiary rounded-lg">
                    <div className="text-2xl font-bold text-red-500">
                      {stats.reports?.pending || 0}
                    </div>
                    <div className="text-xs theme-text-muted">
                      {t('admin.pendingReports') || 'Pending Reports'}
                    </div>
                  </div>
                  <div className="p-3 theme-bg-tertiary rounded-lg">
                    <div className="text-2xl font-bold text-yellow-500">
                      {stats.tickets?.pending || 0}
                    </div>
                    <div className="text-xs theme-text-muted">
                      {t('admin.pendingTickets') || 'Pending Tickets'}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleReportsClick}
                  className="w-full flex items-center justify-between p-3 theme-bg-tertiary hover:theme-bg-hover rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium theme-text-primary">
                      {t('admin.manageReports') || 'Manage Reports'}
                    </span>
                  </div>
                  {stats && stats.pending_reports > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      {stats.pending_reports}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleTicketsClick}
                  className="w-full flex items-center justify-between p-3 theme-bg-tertiary hover:theme-bg-hover rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    <span className="font-medium theme-text-primary">
                      {t('admin.manageTickets') || 'Manage Tickets'}
                    </span>
                  </div>
                  {stats && stats.pending_tickets > 0 && (
                    <span className="bg-yellow-500 text-white text-xs rounded-full px-2 py-1">
                      {stats.pending_tickets}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleBannedUsersClick}
                  className="w-full flex items-center justify-between p-3 theme-bg-tertiary hover:theme-bg-hover rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span className="font-medium theme-text-primary">
                      {t('admin.bannedUsers') || 'Banned Users'}
                    </span>
                  </div>
                  {stats && stats.users?.banned > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      {stats.users.banned}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleDeletedMessagesClick}
                  className="w-full flex items-center justify-between p-3 theme-bg-tertiary hover:theme-bg-hover rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="font-medium theme-text-primary">
                      {t('admin.deletedMessages') || 'Deleted Messages'}
                    </span>
                  </div>
                </button>

                <button
                  onClick={handlePendingDeletionsClick}
                  className="w-full flex items-center justify-between p-3 theme-bg-tertiary hover:theme-bg-hover rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium theme-text-primary">
                      {t('admin.pendingDeletions') || 'Pending Deletions'}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showReports && <ReportsModal onClose={() => setShowReports(false)} />}
      {showTickets && <TicketsModal onClose={() => setShowTickets(false)} />}
      {showBannedUsers && <BannedUsersModal isOpen={showBannedUsers} onClose={() => setShowBannedUsers(false)} />}
      {showDeletedMessages && <DeletedMessagesModal onClose={() => setShowDeletedMessages(false)} />}
      {showPendingDeletions && <PendingDeletionsModal onClose={() => setShowPendingDeletions(false)} />}
    </>
  );
};

export default AdminDashboardButton;
