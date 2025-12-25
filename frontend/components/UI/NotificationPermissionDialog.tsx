import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface NotificationPermissionDialogProps {
  onClose: () => void;
}

const NotificationPermissionDialog: React.FC<NotificationPermissionDialogProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [requesting, setRequesting] = useState(false);

  // Auto-close if permission is granted externally
  useEffect(() => {
    if (Notification.permission === 'granted') {
      onClose();
      return;
    }

    const checkPermission = async () => {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'notifications' });
        permissionStatus.onchange = () => {
          if (permissionStatus.state === 'granted') {
            onClose();
          }
        };
      } catch (error) {
        // Fallback polling for browsers that don't support permission query for notifications
        const interval = setInterval(() => {
          if (Notification.permission === 'granted') {
            onClose();
            clearInterval(interval);
          }
        }, 1000);
        return () => clearInterval(interval);
      }
    };

    checkPermission();
  }, [onClose]);

  const handleEnable = async () => {
    if (!('Notification' in window)) {
      alert(t('notificationDialog.browserNotSupported'));
      onClose();
      return;
    }

    setRequesting(true);
    try {
      const permission = await Notification.requestPermission();
      console.log('[NotificationPermissionDialog] Permission result:', permission);

      // Save to localStorage
      localStorage.setItem('notificationPermissionRequested', 'true');
      localStorage.setItem('notificationPermission', permission);

      if (permission === 'granted') {
        // Test notification
        new Notification(t('notificationDialog.notificationsEnabled'), {
          body: t('notificationDialog.notificationsEnabledBody'),
          icon: '/favicon.ico',
        });
      }

      onClose();
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notificationPermissionRequested', 'true');
    localStorage.setItem('notificationPermission', 'dismissed');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 border theme-border rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-full theme-blue-primary">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold theme-text-primary">{t('notificationDialog.title')}</h3>
        </div>

        <p className="text-sm theme-text-secondary mb-6">
          {t('notificationDialog.description')}
        </p>

        <div className="flex space-x-3">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-2 theme-bg-tertiary theme-text-primary rounded-lg hover:theme-bg-primary transition-colors"
            disabled={requesting}
          >
            {t('notificationDialog.notNow')}
          </button>
          <button
            onClick={handleEnable}
            disabled={requesting}
            className="flex-1 px-4 py-2 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {requesting ? t('notificationDialog.enabling') : t('notificationDialog.enable')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermissionDialog;

