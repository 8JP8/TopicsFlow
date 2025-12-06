import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ReportsModal from './ReportsModal';
import TicketsModal from './TicketsModal';
import AdminStatsCard from './AdminStatsCard';
import DeletedMessagesModal from './DeletedMessagesModal';
import PendingDeletionsModal from './PendingDeletionsModal';

interface AdminMenuProps {
  onClose: () => void;
}

const AdminMenu: React.FC<AdminMenuProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [showReports, setShowReports] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showDeletedMessages, setShowDeletedMessages] = useState(false);
  const [showPendingDeletions, setShowPendingDeletions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const menuItems = [
    {
      label: t('admin.reports') || 'Reports',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      onClick: () => {
        setShowReports(true);
        onClose();
      },
    },
    {
      label: t('admin.tickets') || 'Support Tickets',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
          />
        </svg>
      ),
      onClick: () => {
        setShowTickets(true);
        onClose();
      },
    },
    {
      label: t('admin.stats') || 'Statistics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
      onClick: () => {
        setShowStats(true);
        onClose();
      },
    },
    {
      label: t('admin.deletedMessages') || 'Deleted Messages',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
      onClick: () => {
        setShowDeletedMessages(true);
        onClose();
      },
    },
    {
      label: t('admin.pendingDeletions') || 'Pending Deletions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      onClick: () => {
        setShowPendingDeletions(true);
        onClose();
      },
    },
  ];

  return (
    <>
      <div
        ref={menuRef}
        className="absolute right-0 mt-2 w-64 theme-bg-secondary rounded-lg shadow-lg border theme-border z-50"
      >
        <div className="py-2">
          <div className="px-4 py-2 border-b theme-border">
            <h3 className="font-semibold theme-text-primary">{t('admin.controls') || 'Admin Controls'}</h3>
          </div>
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full px-4 py-3 flex items-center space-x-3 hover:theme-bg-tertiary transition-colors theme-text-primary"
            >
              <span className="theme-text-muted">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {showReports && <ReportsModal onClose={() => setShowReports(false)} />}
      {showTickets && <TicketsModal onClose={() => setShowTickets(false)} />}
      {showStats && <AdminStatsCard onClose={() => setShowStats(false)} />}
      {showDeletedMessages && <DeletedMessagesModal onClose={() => setShowDeletedMessages(false)} />}
      {showPendingDeletions && <PendingDeletionsModal onClose={() => setShowPendingDeletions(false)} />}
    </>
  );
};

export default AdminMenu;
