import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import CreateTicketModal from '@/components/Tickets/CreateTicketModal';
import MyTicketsModal from '@/components/Tickets/MyTicketsModal';
import Avatar from '@/components/UI/Avatar';
import { getUserColorClass } from '@/utils/colorUtils';

interface CurrentTopicAnonymousState {
  topicId: string;
  isAnonymous: boolean;
  name?: string;
}

const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showMyTickets, setShowMyTickets] = useState(false);
  const [currentTopicAnonymousState, setCurrentTopicAnonymousState] = useState<CurrentTopicAnonymousState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Check for current topic's anonymous state from localStorage
  useEffect(() => {
    const checkAnonymousState = () => {
      if (typeof window === 'undefined') return;
      try {
        const stored = localStorage.getItem('current_topic_anonymous_state');
        if (stored) {
          const state = JSON.parse(stored) as CurrentTopicAnonymousState;
          setCurrentTopicAnonymousState(prev => {
            if (JSON.stringify(prev) === JSON.stringify(state)) return prev;
            return state;
          });
        } else {
          setCurrentTopicAnonymousState(prev => prev ? null : prev);
        }
      } catch (error) {
        console.error('Failed to read current topic anonymous state:', error);
        setCurrentTopicAnonymousState(null);
      }
    };

    // Check on mount
    checkAnonymousState();

    // Listen for storage events (when anonymous state changes in another tab/window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'current_topic_anonymous_state') {
        checkAnonymousState();
      }
    };

    // Listen for custom event when anonymous state changes in same window
    const handleAnonymousStateChange = () => {
      checkAnonymousState();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('anonymousStateChanged', handleAnonymousStateChange);

    // Check periodically as fallback (reduced frequency)
    const interval = setInterval(checkAnonymousState, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('anonymousStateChanged', handleAnonymousStateChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const menuItems = [
    {
      label: t('userMenu.profile') || 'Profile',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      onClick: () => {
        setIsOpen(false);
        router.push('/profile');
      },
    },
    {
      label: t('userMenu.startTour') || 'Start Tour',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => {
        setIsOpen(false);
        const path = router.pathname;
        if (path === '/') {
          // Restart dashboard tour
          // We need a way to trigger the tour again. Best way is to dispatch an event or use a global context/hook.
          // Since existing tour uses `driver.js` initialized in `index.tsx` or `Layout.tsx` which often runs on mount or via a prop,
          // we might need to expose a trigger.
          // Assuming `driver.drive()` can be called if we can access the driver instance, or we can reload with a query param, or dispatch an event.
          // Let's try dispatching a custom event that Layout or Index listens to.
          window.dispatchEvent(new CustomEvent('tour:start', { detail: 'dashboard' }));
        } else if (path === '/settings') {
          window.dispatchEvent(new CustomEvent('tour:start', { detail: 'settings' }));
        }
      },
    },
    {
      label: t('userMenu.openTicket') || 'Open Ticket',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => {
        setIsOpen(false);
        setShowCreateTicket(true);
      },
    },
    {
      label: t('userMenu.myTickets') || 'My Tickets',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      onClick: () => {
        setIsOpen(false);
        setShowMyTickets(true);
      },
    },
    {
      label: t('userMenu.settings') || 'Settings',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      onClick: () => {
        setIsOpen(false);
        router.push('/settings');
      },
    },
    {
      label: t('userMenu.anonymousIdentities') || 'Anonymous Identities',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      onClick: () => {
        setIsOpen(false);
        router.push('/settings?tab=anonymous-identities');
      },
    },
  ];

  if (!user) {
    return null;
  }

  // Determine if we should show anonymous identity
  const showAnonymous = currentTopicAnonymousState?.isAnonymous || false;
  const anonymousName = currentTopicAnonymousState?.name || '';
  const displayName = showAnonymous ? anonymousName : user.username;
  const displayProfilePicture = showAnonymous ? undefined : user.profile_picture;

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          id="user-menu-btn"
          className="flex items-center space-x-3 p-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors"
          aria-label="User menu"
        >


          {showAnonymous ? (
            // Show default avatar with initial when anonymous
            <div className={`w-8 h-8 rounded-full ${getUserColorClass(anonymousName || 'Anonymous')} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
              {anonymousName ? anonymousName.charAt(0).toUpperCase() : 'A'}
            </div>
          ) : (
            <Avatar
              userId={user.id}
              username={user.username}
              profilePicture={displayProfilePicture}
              size="md"
            />
          )}
          <span className="text-sm font-medium theme-text-primary hidden sm:block">
            {displayName}
          </span>
          <svg
            className={`w-4 h-4 theme-text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 theme-bg-secondary border theme-border rounded-lg shadow-lg z-20">
            {/* User Info */}
            <div className="px-4 py-3 border-b theme-border">
              <p className="text-sm font-medium theme-text-primary">{displayName}</p>
              {showAnonymous ? (
                <p className="text-xs theme-text-muted italic mt-1">
                  {t('userBanner.anonymousUser') || 'Anonymous User'}
                </p>
              ) : (
                <>
                  <p className="text-xs theme-text-secondary">{user.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    {user.totp_enabled && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {t('userMenu.twoFactorEnabled') || '2FA Enabled'}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  onClick={item.onClick}
                  className="w-full flex items-center space-x-3 px-4 py-2 text-sm theme-text-primary hover:theme-bg-tertiary transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="border-t theme-border py-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-2 text-sm theme-text-primary hover:theme-bg-tertiary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>{t('userMenu.logout') || 'Logout'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateTicket && (
        <CreateTicketModal onClose={() => setShowCreateTicket(false)} />
      )}
      {showMyTickets && (
        <MyTicketsModal onClose={() => setShowMyTickets(false)} />
      )}
    </>
  );
};

export default UserMenu;