import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';

const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
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

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const menuItems = [
    {
      label: 'Profile',
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
      label: 'Settings',
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
      label: 'Anonymous Identities',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      onClick: () => {
        setIsOpen(false);
        router.push('/anonymous');
      },
    },
  ];

  if (!user) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors"
        aria-label="User menu"
      >
        <div className="w-8 h-8 rounded-full theme-blue-primary flex items-center justify-center">
          <span className="text-white font-semibold text-sm">
            {user.username.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="text-sm font-medium theme-text-primary hidden sm:block">
          {user.username}
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
            <p className="text-sm font-medium theme-text-primary">{user.username}</p>
            <p className="text-xs theme-text-secondary">{user.email}</p>
            <div className="flex items-center space-x-2 mt-1">
              {user.totp_enabled && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  2FA Enabled
                </span>
              )}
            </div>
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
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;