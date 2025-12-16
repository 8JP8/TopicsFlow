import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ThemeToggle from '@/components/UI/ThemeToggle';
import LanguageToggle from '@/components/UI/LanguageToggle';
import UserMenu from '@/components/UI/UserMenu';
import NotificationCenter from '@/components/UI/NotificationCenter';
import NotificationsModal from '@/components/UI/NotificationsModal';
import InvitationsButton from '@/components/UI/InvitationsButton';
import AdminDashboardButton from '@/components/Admin/AdminDashboardButton';
import { useState, useEffect, useRef } from 'react';
import SupportWidget from '@/components/Support/SupportWidget';

interface LayoutProps {
  children: ReactNode;
  transparentHeader?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, transparentHeader = false }) => {
  const router = useRouter();
  const { user } = useAuth();
  const { connected } = useSocket();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showSupportWidget, setShowSupportWidget] = useState(true);
  const driverRef = useRef<any>(null);

  // Preference listener for support widget
  useEffect(() => {
    // Initial check
    if (user?.preferences) {
      setShowSupportWidget((user.preferences as any).show_support_widget !== false);
    }

    // Listen for preference changes from Settings page
    const handlePrefChange = () => {
      const stored = localStorage.getItem('show_support_widget');
      if (stored !== null) {
        setShowSupportWidget(stored === 'true');
      }
    };

    window.addEventListener('preference:support-widget-changed', handlePrefChange);
    return () => window.removeEventListener('preference:support-widget-changed', handlePrefChange);
  }, [user]);

  // Tour listener
  useEffect(() => {
    const handleTourStart = (e: CustomEvent) => {
      // Logic to start tour same as initial effect
      const startTour = async () => {
        try {
          const { driver } = await import('driver.js');
          const { getTourSteps, tourConfig } = await import('@/utils/tour-config');
          // @ts-ignore
          import('driver.js/dist/driver.css');

          const driverObj = driver({
            ...tourConfig,
            steps: getTourSteps(t, router.pathname, user?.is_admin, (path: string) => router.push(path)),
            overlayColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.6)',
            popoverClass: theme === 'dark' ? 'driver-dark-popover' : 'driver-light-popover',
            nextBtnText: t('common.next') || 'Next',
            prevBtnText: t('common.previous') || 'Previous',
            doneBtnText: t('common.done') || 'Done',
            onDestroyed: () => {
              driverRef.current = null;
            }
          });

          driverRef.current = driverObj;
          driverObj.drive();
        } catch (error) {
          console.error('Failed to start tour manual:', error);
        }
      };
      startTour();
    };

    const handleTourEnd = () => {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };

    window.addEventListener('tour:start' as any, handleTourStart);
    window.addEventListener('tour:end', handleTourEnd);

    return () => {
      window.removeEventListener('tour:start' as any, handleTourStart);
      window.removeEventListener('tour:end', handleTourEnd);
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, [t, router.pathname, user?.is_admin, theme]);

  return (
    <div className={`min-h-screen theme-bg-primary ${theme}`} data-theme={theme} suppressHydrationWarning>
      {/* Header */}
      <header className={`h-16 flex items-center justify-between px-6 ${transparentHeader ? 'absolute top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-cyan-500/30' : 'border-b theme-border'}`}>
        {/* ... header content ... */}
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer no-underline text-decoration-none hover:no-underline">
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
          {showSupportWidget && <SupportWidget />}
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