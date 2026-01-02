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
import dynamic from 'next/dynamic';
import InvitationsButton from '@/components/UI/InvitationsButton';
import AdminDashboardButton from '@/components/Admin/AdminDashboardButton';

const NotificationsModal = dynamic(() => import('@/components/UI/NotificationsModal'), { ssr: false });
const SupportWidget = dynamic(() => import('@/components/Support/SupportWidget'), { ssr: false });
const MyTicketsModal = dynamic(() => import('@/components/Tickets/MyTicketsModal'), { ssr: false });
import { useState, useEffect, useRef } from 'react';
import { Menu, X, LifeBuoy, Settings } from 'lucide-react'; // Import LifeBuoy and Settings icons

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
  const [showMyTickets, setShowMyTickets] = useState(false); // State for MyTicketsModal
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const driverRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null); // Ref for mobile menu

  // Click outside listener for mobile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        // Also ignore clicks on the toggle button itself (if possible, by class or id, but simpler is just outside menu)
        !(event.target as Element).closest('button[aria-label="Toggle menu"]') // Assuming we add aria-label to toggle
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Swipe handlers for mobile menu
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    // Edge Swipe Logic: Only allow swipe starting from the right edge (last 40px)
    // to prevent conflicts with carousel or other horizontal swipes
    if (e.targetTouches[0].clientX < window.innerWidth - 40) {
      touchStart.current = null;
      return;
    }
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // Swipe Left (Open Menu) - DISABLED to prevent conflicts with content swipes (e.g. Carousel)
    // if (isLeftSwipe && !mobileMenuOpen) {
    //   setMobileMenuOpen(true);
    // }

    // Swipe Right (Close Menu) - Only if menu is open
    if (isRightSwipe && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };


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

  // Handle startTour query param
  useEffect(() => {
    if (router.isReady && router.query.startTour === 'true') {
      // Remove the query param from URL without reloading
      const { startTour, ...rest } = router.query;
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });

      // Small delay to ensure the page has settled
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tour:start', { detail: 'dashboard' }));
      }, 500);
    }
  }, [router.isReady, router.query]);

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
    <div
      className={`min-h-screen theme-bg-primary ${theme}`}
      data-theme={theme}
      suppressHydrationWarning
    >
      {/* Header */}
      <header className={`h-16 flex items-center justify-between px-3 md:px-6 ${transparentHeader ? 'absolute top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-cyan-500/30' : 'border-b theme-border'}`}>
        {/* Logo Section */}
        <div className="flex items-center space-x-3 z-50">
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (router.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                router.push('/');
              }
            }}
            className="flex items-center space-x-2 md:space-x-3 hover:opacity-80 transition-opacity cursor-pointer no-underline text-decoration-none hover:no-underline"
          >
            <img
              src="https://i.postimg.cc/FY5shL9w/chat.png"
              alt="TopicsFlow Logo"
              className="h-8 w-8"
            />
            <h1 className={`text-xl font-bold truncate hidden min-[370px]:block ${router.pathname === '/about' ? 'text-white' : 'theme-text-primary'}`}>TopicsFlow</h1>
          </Link>
        </div>

        {/* Right Actions Section */}
        <div className="flex items-center space-x-1 md:space-x-4">

          {/* Always Visible Actions (Admin, Invitations, Notifications) */}
          {user?.is_admin && <AdminDashboardButton />}
          <InvitationsButton />
          <NotificationCenter onOpenNotificationsModal={() => setShowNotificationsModal(true)} />

          {/* Desktop Only Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {showSupportWidget && <SupportWidget />}
            <LanguageToggle />
            <ThemeToggle />
            <UserMenu />
          </div>

          {/* Mobile Hamburger */}
          <div className="md:hidden flex items-center z-50 ml-1">
            <button
              onClick={(e) => {
                e.stopPropagation(); // Stop propagation to prevent immediate close
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              aria-label="Toggle menu"
              className="p-2 theme-text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown (Floating Popup) */}
        {mobileMenuOpen && (
          <div ref={menuRef} className="absolute top-16 right-2 w-64 theme-bg-secondary border theme-border rounded-xl shadow-2xl z-50 animate-in slide-in-from-top-2 duration-200 overflow-y-auto">
            <div className="p-2 space-y-0.5 flex flex-col">

              {/* Settings */}
              <button
                className="w-full flex items-center justify-between p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push('/settings');
                }}
              >
                <span className="text-sm font-medium theme-text-primary">{t('userMenu.settings') || 'Settings'}</span>
                <div className="p-2 rounded-lg theme-bg-secondary">
                  <Settings size={18} className="theme-text-primary" />
                </div>
              </button>

              {/* Theme */}
              <div
                role="button"
                className="w-full flex items-center justify-between p-2 rounded-lg hover:theme-bg-tertiary transition-colors cursor-pointer"
                onClick={() => document.getElementById('theme-toggle-btn')?.click()}
              >
                <span className="text-sm font-medium theme-text-primary">{t('settings.appearance') || 'Theme'}</span>
                <div onClick={(e) => e.stopPropagation()}>
                  <ThemeToggle />
                </div>
              </div>

              {/* Language */}
              <div
                role="button"
                className="w-full flex items-center justify-between p-2 rounded-lg hover:theme-bg-tertiary transition-colors cursor-pointer"
                onClick={() => document.getElementById('language-toggle-btn')?.click()}
              >
                <span className="text-sm font-medium theme-text-primary">{t('settings.language') || 'Language'}</span>
                <div onClick={(e) => e.stopPropagation()}>
                  <LanguageToggle />
                </div>
              </div>

              <div className="h-px theme-border my-1 mx-2" />

              {/* Support - Opens MyTicketsModal */}
              {showSupportWidget && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowMyTickets(true);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:theme-bg-tertiary transition-colors text-left"
                >
                  <span className="text-sm font-medium theme-text-primary">{t('supportWidget.title') || 'Support'}</span>
                  <div className="p-2 rounded-lg theme-bg-secondary">
                    <LifeBuoy size={18} className="theme-text-primary" />
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
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

      {/* My Tickets Modal (for Mobile usage mostly) */}
      {
        showMyTickets && (
          <MyTicketsModal onClose={() => setShowMyTickets(false)} />
        )
      }
    </div >
  );
};

export default Layout;