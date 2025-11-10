import type { AppProps } from 'next/app';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SocketProvider } from '@/contexts/SocketContext';
import '@/styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <Component {...pageProps} />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
                border: '1px solid var(--theme-border)',
                borderRadius: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: '500',
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
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default MyApp;