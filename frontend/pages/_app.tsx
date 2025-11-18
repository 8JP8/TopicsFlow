import type { AppProps } from 'next/app';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SocketProvider } from '@/contexts/SocketContext';
import '@/styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ThemeProvider>
          <SocketProvider>
            <Component {...pageProps} />
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
          </SocketProvider>
        </ThemeProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default MyApp;