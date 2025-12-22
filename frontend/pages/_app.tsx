import '@/styles/globals.css';
import React, { useState, useEffect } from 'react';
import type { AppProps } from 'next/app';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SocketProvider, useSocket } from '@/contexts/SocketContext';
import { VoipProvider } from '@/contexts/VoipContext';
import WarningBanner from '@/components/Warning/WarningBanner';
import PWAInstallPrompt from '@/components/UI/PWAInstallPrompt';
import { IncomingCallDialog, VoipControlBar } from '@/components/Voip';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import Snowfall from 'react-snowfall';

function AppContent({ Component, pageProps }: { Component: AppProps['Component']; pageProps: AppProps['pageProps'] }) {
  const { user, refreshUser } = useAuth();
  const { socket } = useSocket();
  const [warning, setWarning] = useState<{ message: string; warned_at: string; dismissed_at?: string } | null>(null);
  const router = useRouter();

  // Check for active warning on mount and when user data changes
  useEffect(() => {
    console.log('[AppContent] User data changed, checking for warnings:', {
      hasUser: !!user,
      hasActiveWarning: !!user?.active_warning,
      warningDismissed: user?.active_warning?.dismissed_at
    });

    if (user?.active_warning && !user.active_warning.dismissed_at) {
      console.log('[AppContent] Setting warning:', user.active_warning);
      setWarning(user.active_warning);
    } else {
      console.log('[AppContent] No active warning or warning dismissed');
      setWarning(null);
    }
  }, [user?.active_warning, user?.id]);

  // Listen for real-time warning events via WebSocket
  useEffect(() => {
    if (!socket) {
      // console.log('[AppContent] Socket not available');
      return;
    }

    const handleWarning = async (data: any) => {
      console.log('[AppContent] Warning received via WebSocket:', data);
      // Refresh user data to get the full warning details
      await refreshUser();
      // The warning will be set by the useEffect above when user data updates
    };

    // Listen to the custom event dispatched by SocketContext
    const eventHandler = (event: CustomEvent) => {
      console.log('[AppContent] Received user_warning window event:', event.detail);
      handleWarning(event.detail);
    };

    window.addEventListener('user_warning', eventHandler as EventListener);

    return () => {
      window.removeEventListener('user_warning', eventHandler as EventListener);
    };
  }, [socket, refreshUser]);

  // Also check on initial mount
  useEffect(() => {
    if (user?.id && !warning) {
      console.log('[AppContent] Initial mount check for warnings');
      refreshUser();
    }
  }, [user?.id]);

  const showFloatingControl = router.pathname !== '/';
  // Show snowfall on all pages EXCEPT root ('/') and settings ('/settings')
  const showSnowfall = router.pathname !== '/' && !router.pathname.startsWith('/settings');

  return (
    <>
      {warning && <WarningBanner warning={warning} />}
      {showSnowfall && (
        <div style={{ position: 'fixed', width: '100vw', height: '100vh', top: 0, left: 0, pointerEvents: 'none', zIndex: 10 }}>
          <Snowfall
            snowflakeCount={100}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />
        </div>
      )}
      <PWAInstallPrompt />
      <IncomingCallDialog />
      {showFloatingControl && (
        <motion.div
          drag
          dragMomentum={false}
          dragConstraints={{ left: 16, right: 16, top: 16, bottom: 16 }}
          className="fixed bottom-4 left-4 z-50 cursor-move"
          whileDrag={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
        >
          <VoipControlBar variant="floating" />
        </motion.div>
      )}
      <Component {...pageProps} />
    </>
  );
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ThemeProvider>
          <SocketProvider>
            <VoipProvider>
              <AppContent Component={Component} pageProps={pageProps} />
              <Toaster
                position="top-center"
                containerStyle={{
                  top: '20px',
                }}
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'var(--theme-bg-secondary)',
                    color: 'var(--theme-text-primary)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  },
                  success: {
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#ffffff',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#ffffff',
                    },
                  },
                }}
              />
            </VoipProvider>
          </SocketProvider>
        </ThemeProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default MyApp;