import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/UI/ThemeToggle';
import LanguageToggle from '@/components/UI/LanguageToggle';
import UserMenu from '@/components/UI/UserMenu';
import NotificationCenter from '@/components/UI/NotificationCenter';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const { theme } = useTheme();

  if (!user) {
    return <div className="min-h-screen theme-bg-primary">{children}</div>;
  }

  return (
    <div className={`min-h-screen theme-bg-primary ${theme}`} data-theme={theme}>
      {/* Header */}
      <header className="h-16 border-b theme-border flex items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold theme-text-primary">ChatHub</h1>
        </div>

        <div className="flex items-center space-x-4">
          <NotificationCenter />
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