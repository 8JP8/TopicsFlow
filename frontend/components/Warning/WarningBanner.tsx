import React, { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

interface WarningBannerProps {
  warning: {
    message: string;
    warned_at: string;
    dismissed_at?: string;
  };
}

const WarningBanner: React.FC<WarningBannerProps> = ({ warning }) => {
  const { t } = useLanguage();
  const { refreshUser } = useAuth();
  const [dismissed, setDismissed] = useState(!!warning.dismissed_at);
  const [timeRemaining, setTimeRemaining] = useState(10); // 10 seconds
  const [startTime] = useState(Date.now());
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, 10 - elapsed);
      setTimeRemaining(remaining);

      // Enable dismiss button after 10 seconds
      if (remaining === 0 && !canDismiss) {
        setCanDismiss(true);
        // Remove the blocking backdrop after 10 seconds
      }
    }, 100);

    return () => clearInterval(interval);
  }, [dismissed, startTime, canDismiss]);

  const handleDismiss = async () => {
    if (!canDismiss) return; // Prevent dismissal before 10 seconds
    
    try {
      await api.post('/api/users/dismiss-warning');
      setDismissed(true);
      refreshUser();
    } catch (error) {
      console.error('Failed to dismiss warning:', error);
    }
  };

  if (dismissed) return null;

  return (
    <>
      {/* Backdrop overlay that blocks all interaction for 10 seconds */}
      {!canDismiss && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[9998]"
          style={{ pointerEvents: 'auto' }}
        />
      )}
      
      {/* Warning Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-red-600 text-white rounded-lg shadow-2xl max-w-2xl w-full p-6 relative pointer-events-auto">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-xl mb-3">
                {t('warning.title') || 'Warning'}
              </h3>
              <p className="text-base mb-4 leading-relaxed">{warning.message}</p>
              
              <div className="flex items-center justify-between mt-6">
                {!canDismiss && (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">
                      {t('warning.timeRemaining') || 'Time remaining'}: {timeRemaining}s
                    </span>
                  </div>
                )}
                {canDismiss && (
                  <div className="flex-1"></div>
                )}
                <button
                  onClick={handleDismiss}
                  disabled={!canDismiss}
                  className={`px-6 py-2 rounded-lg transition-all text-sm font-medium ${
                    canDismiss
                      ? 'bg-red-700 hover:bg-red-800 cursor-pointer'
                      : 'bg-red-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  {t('warning.dismiss') || 'Dismiss'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WarningBanner;


