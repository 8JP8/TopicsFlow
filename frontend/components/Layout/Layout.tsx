import { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useTheme } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/UI/ThemeToggle';
import LanguageToggle from '@/components/UI/LanguageToggle';
import UserMenu from '@/components/UI/UserMenu';
import NotificationCenter from '@/components/UI/NotificationCenter';
import NotificationsModal from '@/components/UI/NotificationsModal';
import InvitationsButton from '@/components/UI/InvitationsButton';
import AdminDashboardButton from '@/components/Admin/AdminDashboardButton';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const { connected } = useSocket();
  const { theme } = useTheme();
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  if (!user) {
    return <div className="min-h-screen theme-bg-primary">{children}</div>;
  }

  return (
    <div className={`min-h-screen theme-bg-primary ${theme}`} data-theme={theme} suppressHydrationWarning>
      {/* Header */}
      <header className="h-16 border-b theme-border flex items-center justify-between px-6">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <img 
              src="https://i.postimg.cc/FY5shL9w/chat.png" 
              alt="TopicsFlow Logo" 
              className="h-8 w-8"
            />
            <h1 className="text-xl font-bold theme-text-primary">TopicsFlow</h1>
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <AdminDashboardButton />
          <InvitationsButton />
          <NotificationCenter onOpenNotificationsModal={() => setShowNotificationsModal(true)} />
          <LanguageToggle />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="h-[calc(100vh-4rem)]">
        {children}
      </main>

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
      />
    </div>
  );
};

export default Layout;