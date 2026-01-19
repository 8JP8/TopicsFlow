import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import CreateTicketModal from '@/components/Tickets/CreateTicketModal';
import MyTicketsModal from '@/components/Tickets/MyTicketsModal';
import Avatar from '@/components/UI/Avatar';
import CountryFlag from '@/components/UI/CountryFlag';

interface UserMenuProps {
  placement?: 'bottom' | 'top' | 'mobile-bottom';
}

const UserMenu: React.FC<UserMenuProps> = ({ placement = 'bottom' }) => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showMyTickets, setShowMyTickets] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleOpenMenu = () => setIsOpen(true);
    window.addEventListener('tour:open-user-menu', handleOpenMenu);
    return () => window.removeEventListener('tour:open-user-menu', handleOpenMenu);
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
      // This item is now a direct Link component
      type: 'link',
      component: (
        <Link
          href="/settings"
          id="user-menu-item-settings"
          className="w-full flex items-center space-x-3 px-4 py-2 text-sm theme-text-primary hover:theme-bg-tertiary hover:no-underline hover:theme-text-primary transition-colors"
          onClick={() => setIsOpen(false)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{t('userMenu.settings') || 'Settings'}</span>
        </Link>
      ),
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
      onClick: () => {
        setIsOpen(false);
        setShowMyTickets(true);
      },
    },
    {
      label: t('userMenu.anonymousIdentities') || 'Anonymous Identities',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M14 18a2 2 0 0 0-4 0" /><path d="m19 11-2.11-6.657a2 2 0 0 0-2.752-1.148l-1.276.61A2 2 0 0 1 12 4H8.5a2 2 0 0 0-1.925 1.456L5 11" /><path d="M2 11h20" /><circle cx="17" cy="18" r="3" /><circle cx="7" cy="18" r="3" /></svg>
      ),
      onClick: () => {
        setIsOpen(false);
        router.push('/settings?tab=anonymous-identities');
      },
    },
    {
      label: t('userMenu.about') || 'About',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      onClick: () => {
        setIsOpen(false);
        router.push('/about');
      },
    },
  ];

  if (!user) {
    return null;
  }

  // Always show real user info in the top-right menu
  // Anonymous mode only affects posts/message display within specific topics
  const displayName = user.username;
  const displayProfilePicture = user.profile_picture;

  return (
    <>
      <div className={`relative ${placement === 'mobile-bottom' ? 'w-full h-full' : ''}`} ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          id="user-menu-btn"
          className={`flex ${placement === 'mobile-bottom' ? 'flex-col items-center justify-center w-full h-full space-y-1' : 'items-center space-x-3 p-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors'}`}
          aria-label="User menu"
        >
          <div className="relative">
            <Avatar
              userId={user.id}
              username={user.username}
              profilePicture={displayProfilePicture}
              size={placement === 'mobile-bottom' ? 'sm' : 'md'}
            />
            {placement === 'mobile-bottom' && isOpen && (
              <div className="absolute -top-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-[1px] shadow-sm">
                <svg
                  className="w-3 h-3 theme-text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
          </div>

          {placement === 'mobile-bottom' ? (
            <span className="text-[10px] font-medium theme-text-primary">
              {t('userMenu.profile') || 'Profile'}
            </span>
          ) : (
            <div className="flex items-center">
              <span className="text-sm font-medium theme-text-primary truncate hidden sm:block mr-1">
                {displayName}
              </span>
              <svg
                className={`w-4 h-4 theme-text-primary transition-transform ml-auto ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </button>

        {isOpen && (
          <div className={`
            ${placement === 'mobile-bottom'
              ? 'fixed bottom-[5rem] right-2 w-[50vw] min-w-[280px] max-w-sm h-auto max-h-[60vh] overflow-y-auto shadow-2xl border theme-border rounded-xl z-50 animate-in slide-in-from-bottom-2 duration-200'
              : `absolute right-0 ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} w-80 shadow-lg z-20 rounded-lg border theme-border`
            } 
            theme-bg-secondary
          `}>
            {/* User Info */}
            <div className="px-4 py-3 border-b theme-border">
              <p className="text-sm font-medium theme-text-primary">{displayName}</p>
              <p className="text-xs theme-text-secondary">{user.email}</p>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center space-x-2">
                  {user.preferences?.email_2fa_enabled ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {t('userMenu.twoFactorEnabled') || '2FA Enabled'}
                    </span>
                  ) : user.totp_enabled ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {t('userMenu.totpEnabled') || 'TOTP Enabled'}
                    </span>
                  ) : null}
                </div>
                {(user as any).country_code && (
                  <CountryFlag countryCode={(user as any).country_code} size="sm" showName={true} />
                )}
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {menuItems.map((item: any, index) => (
                item.component ? (
                  <React.Fragment key={index}>
                    {item.component}
                  </React.Fragment>
                ) : (
                  <button
                    key={index}
                    onClick={item.onClick}
                    className="w-full flex items-center space-x-3 px-4 py-2 text-sm theme-text-primary hover:theme-bg-tertiary transition-colors"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                )
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