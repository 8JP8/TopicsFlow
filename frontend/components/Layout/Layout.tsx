import { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useTheme } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/UI/ThemeToggle';
import LanguageToggle from '@/components/UI/LanguageToggle';
import UserMenu from '@/components/UI/UserMenu';
import NotificationCenter from '@/components/UI/NotificationCenter';
import FriendRequestsButton from '@/components/UI/FriendRequestsButton';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const { connected } = useSocket();
  const { theme } = useTheme();

  if (!user) {
    return <div className="min-h-screen theme-bg-primary">{children}</div>;
  }

  return (
    <div className={`min-h-screen theme-bg-primary ${theme}`} data-theme={theme} suppressHydrationWarning>
      {/* Header */}
      <header className="h-16 border-b theme-border flex items-center justify-between px-6">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h1 className="text-xl font-bold theme-text-primary">TopicsFlow</h1>
          </Link>

          {/* Connection Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
                 title={connected ? 'Connected' : 'Disconnected'} />
            <span className="text-xs theme-text-muted hidden sm:inline">
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <NotificationCenter />
          <FriendRequestsButton />
          <LanguageToggle />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="h-[calc(100vh-4rem)]">
        {children}
      </main>
    </div>
  );
};

export default Layout;