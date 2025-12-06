import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Layout from '@/components/Layout/Layout';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { toast } from 'react-hot-toast';
import BlockedUsersModal from '@/components/Settings/BlockedUsersModal';
import HiddenItemsModal from '@/components/Settings/HiddenItemsModal';
import FollowedPublicationsModal from '@/components/Settings/FollowedPublicationsModal';
import FollowedChatroomsModal from '@/components/Settings/FollowedChatroomsModal';
import NotificationPermissionDialog from '@/components/UI/NotificationPermissionDialog';

interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'en' | 'pt';
  notifications_enabled?: boolean;
  browser_notifications_enabled?: boolean;
  sound_enabled?: boolean;
}

const Settings: React.FC = () => {
  const router = useRouter();
  const { user, loading: authLoading, updateUser } = useAuth();
  const { t } = useLanguage();
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'dark',
    language: 'en',
    notifications_enabled: true,
    sound_enabled: true,
  });
  const [_loading, _setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'privacy'>('preferences');
  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);
  const [showHiddenItemsModal, setShowHiddenItemsModal] = useState(false);
  const [showFollowedPublicationsModal, setShowFollowedPublicationsModal] = useState(false);
  const [showFollowedChatroomsModal, setShowFollowedChatroomsModal] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [anonymousIdentities, setAnonymousIdentities] = useState<Array<{id: string, topic_id: string, topic_title: string, identity_name: string, created_at: string, message_count: number}>>([]);
  const [loadingIdentities, setLoadingIdentities] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user?.preferences) {
      setPreferences({
        theme: user.preferences.theme || 'dark',
        language: user.preferences.language || 'en',
        notifications_enabled: user.preferences.notifications_enabled !== false,
        browser_notifications_enabled: user.preferences.browser_notifications_enabled || false,
        sound_enabled: user.preferences.sound_enabled !== false,
      });
    }

    // Check browser notification permission status
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = Notification.permission;
      if (permission === 'granted' && !preferences.browser_notifications_enabled) {
        setPreferences(prev => ({ ...prev, browser_notifications_enabled: true }));
      }
    }

  }, [user, authLoading, router, activeTab]);


  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    // Apply theme immediately without showing toast
    if (key === 'theme') {
      document.documentElement.classList.toggle('dark', value === 'dark');
      // Save to backend silently (no toast)
      try {
        const response = await api.put(API_ENDPOINTS.AUTH.PREFERENCES, {
          preferences: newPreferences,
        });

        if (response.data.success) {
          // Update user context silently
          if (user) {
            updateUser({ 
              ...user, 
              preferences: { 
                ...user.preferences, 
                ...newPreferences 
              } 
            });
          }
        }
      } catch (error) {
        // Silently fail for theme changes
        console.error('Failed to save theme preference:', error);
      }
      return;
    }

    // For other preferences, show toast when saved
    try {
      const response = await api.put(API_ENDPOINTS.AUTH.PREFERENCES, {
        preferences: newPreferences,
      });

      if (response.data.success) {
        toast.success(t('settings.settingsSaved'));
        // Update user context
        if (user) {
          updateUser({ 
            ...user, 
            preferences: { 
              ...user.preferences, 
              ...newPreferences 
            } 
          });
        }
      } else {
        toast.error(t('settings.settingsSaveFailed'));
      }
    } catch (error) {
      toast.error(t('settings.settingsSaveFailed'));
    }
  };

  const handleLogout = async () => {
    try {
      await api.post(API_ENDPOINTS.AUTH.LOGOUT);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
    }
  };

  const loadAnonymousIdentities = async () => {
    try {
      setLoadingIdentities(true);
      const response = await api.get(API_ENDPOINTS.USERS.ANONYMOUS_IDENTITIES);
      if (response.data.success) {
        setAnonymousIdentities(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load anonymous identities:', error);
    } finally {
      setLoadingIdentities(false);
    }
  };

  const handleDeleteIdentity = async (topicId: string) => {
    if (!confirm(t('anonymousIdentities.deleteConfirm') || 'Are you sure you want to delete this anonymous identity?')) {
      return;
    }

    try {
      const response = await api.delete(API_ENDPOINTS.USERS.DELETE_ANONYMOUS_IDENTITY(topicId));
      if (response.data.success) {
        toast.success(t('anonymousIdentities.deleteSuccess') || 'Anonymous identity deleted');
        setAnonymousIdentities(prev => prev.filter(identity => identity.topic_id !== topicId));
      } else {
        toast.error(t('anonymousIdentities.deleteFailed') || 'Failed to delete anonymous identity');
      }
    } catch (error) {
      console.error('Failed to delete identity:', error);
      toast.error(t('anonymousIdentities.deleteFailed') || 'Failed to delete anonymous identity');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-sm theme-text-secondary hover:theme-text-primary mb-4 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('settings.backToDashboard') || 'Back to Dashboard'}
          </button>
          <h1 className="text-3xl font-bold theme-text-primary mb-2">{t('settings.title')}</h1>
          <p className="theme-text-secondary">{t('settings.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="border-b theme-border mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('account')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'account'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300'
              }`}
            >
              {t('settings.account')}
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'preferences'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300'
              }`}
            >
              {t('settings.preferences')}
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'privacy'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300'
              }`}
            >
              {t('settings.privacy')}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="theme-bg-secondary rounded-lg shadow-sm p-6">
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold theme-text-primary mb-4">{t('settings.accountInformation')}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-1">{t('settings.username')}</label>
                    <input
                      type="text"
                      value={user.username}
                      disabled
                      className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-1">{t('settings.email')}</label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t theme-border">
                <h3 className="text-lg font-medium theme-text-primary mb-2">{t('settings.manageAccount')}</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/profile')}
                    className="w-full sm:w-auto px-4 py-2 btn btn-primary mb-2"
                  >
                    {t('settings.editProfile')}
                  </button>
                  <button
                    onClick={() => setShowBlockedUsersModal(true)}
                    className="w-full sm:w-auto px-4 py-2 btn btn-ghost mb-2"
                  >
                    {t('settings.blockedUsers') || 'Blocked Users'}
                  </button>
                  <button
                    onClick={() => setShowHiddenItemsModal(true)}
                    className="w-full sm:w-auto px-4 py-2 btn btn-ghost mb-2"
                  >
                    {t('settings.hiddenItems') || 'Hidden Items'}
                  </button>
                  <button
                    onClick={() => setShowFollowedPublicationsModal(true)}
                    className="w-full sm:w-auto px-4 py-2 btn btn-ghost mb-2"
                  >
                    {t('settings.followedPublications') || 'Followed Publications'}
                  </button>
                  <button
                    onClick={() => setShowFollowedChatroomsModal(true)}
                    className="w-full sm:w-auto px-4 py-2 btn btn-ghost"
                  >
                    {t('settings.followedChatrooms') || 'Followed Chatrooms'}
                  </button>
                </div>
              </div>

              {/* Anonymous Identities Section */}
              <div className="pt-4 border-t theme-border">
                <h3 className="text-lg font-medium theme-text-primary mb-4">{t('settings.anonymousIdentities') || 'Anonymous Identities'}</h3>
                {loadingIdentities ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : anonymousIdentities.length === 0 ? (
                  <p className="text-sm theme-text-secondary mb-4">
                    {t('settings.noAnonymousIdentities') || 'You have no anonymous identities.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {anonymousIdentities.map((identity) => (
                      <div
                        key={identity.topic_id}
                        className="p-4 rounded-lg border theme-border theme-bg-tertiary"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium theme-text-primary mb-1">
                              {identity.topic_title}
                            </h4>
                            <p className="text-xs theme-text-secondary mb-2">
                              {t('settings.identityName') || 'Identity'}: {identity.identity_name}
                            </p>
                            <div className="flex items-center space-x-4 text-xs theme-text-muted">
                              <span>{identity.message_count} {t('settings.messages') || 'messages'}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteIdentity(identity.topic_id)}
                            className="px-3 py-1 text-xs btn btn-secondary ml-4"
                          >
                            {t('common.delete') || 'Delete'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t theme-border">
                <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">{t('settings.dangerZone')}</h3>
                <button
                  onClick={handleLogout}
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  {t('settings.logout')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold theme-text-primary mb-4">{t('settings.appearance')}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">{t('settings.theme')}</label>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => handlePreferenceChange('theme', 'light')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                          preferences.theme === 'light'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                            : 'theme-border theme-bg-tertiary'
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span className="font-medium">{t('settings.light')}</span>
                        </div>
                      </button>
                      <button
                        onClick={() => handlePreferenceChange('theme', 'dark')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                          preferences.theme === 'dark'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                            : 'theme-border theme-bg-tertiary'
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                          </svg>
                          <span className="font-medium">{t('settings.dark')}</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">{t('settings.language')}</label>
                    <select
                      value={preferences.language}
                      onChange={(e) => handlePreferenceChange('language', e.target.value)}
                      className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary"
                    >
                      <option value="en">English</option>
                      <option value="pt">Português</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t theme-border">
                <h2 className="text-xl font-semibold theme-text-primary mb-4">{t('settings.notifications')}</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium theme-text-primary">{t('settings.enableNotifications')}</h4>
                      <p className="text-sm theme-text-secondary">{t('settings.enableNotificationsDesc')}</p>
                    </div>
                    <button
                      onClick={() => handlePreferenceChange('notifications_enabled', !preferences.notifications_enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences.notifications_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium theme-text-primary">{t('settings.enableBrowserNotifications')}</h4>
                      <p className="text-sm theme-text-secondary">{t('settings.enableBrowserNotificationsDesc')}</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!preferences.browser_notifications_enabled) {
                          // Check if browser supports notifications
                          if (typeof window !== 'undefined' && 'Notification' in window) {
                            const permission = Notification.permission;
                            if (permission === 'default') {
                              // Show permission dialog
                              setShowNotificationDialog(true);
                              return;
                            } else if (permission === 'granted') {
                              // Already granted, just enable
                              handlePreferenceChange('browser_notifications_enabled', true);
                            } else {
                              // Permission denied, inform user
                              toast.error(t('notifications.permissionDenied') || 'Notification permission was denied. Please enable it in your browser settings.');
                            }
                          } else {
                            toast.error(t('notifications.notSupported') || 'Browser notifications are not supported in your browser.');
                          }
                        } else {
                          // Disable browser notifications
                          handlePreferenceChange('browser_notifications_enabled', false);
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences.browser_notifications_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences.browser_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium theme-text-primary">{t('settings.soundEffects')}</h4>
                      <p className="text-sm theme-text-secondary">{t('settings.soundEffectsDesc')}</p>
                    </div>
                    <button
                      onClick={() => handlePreferenceChange('sound_enabled', !preferences.sound_enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences.sound_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences.sound_enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold theme-text-primary mb-4">{t('settings.privacy')}</h2>
                <div className="space-y-4">
                  <div className="p-4 theme-bg-tertiary rounded-lg">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="font-medium theme-text-primary">{t('settings.twoFactorAuth')}</h4>
                        <p className="text-sm theme-text-secondary mt-1">{t('settings.twoFactorAuthDesc')}</p>
                      </div>
                    </div>
                  </div>


                  <div className="p-4 theme-bg-tertiary rounded-lg">
                    <h4 className="font-medium theme-text-primary mb-2">{t('settings.dataPrivacy')}</h4>
                    <p className="text-sm theme-text-secondary">
                      {t('settings.dataPrivacyDesc')}
                    </p>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <BlockedUsersModal
        isOpen={showBlockedUsersModal}
        onClose={() => setShowBlockedUsersModal(false)}
      />
      <HiddenItemsModal
        isOpen={showHiddenItemsModal}
        onClose={() => setShowHiddenItemsModal(false)}
      />
      <FollowedPublicationsModal
        isOpen={showFollowedPublicationsModal}
        onClose={() => setShowFollowedPublicationsModal(false)}
      />
      <FollowedChatroomsModal
        isOpen={showFollowedChatroomsModal}
        onClose={() => setShowFollowedChatroomsModal(false)}
      />
      {showNotificationDialog && (
        <NotificationPermissionDialog
          onClose={() => {
            setShowNotificationDialog(false);
            // Check if permission was granted
            if (typeof window !== 'undefined' && 'Notification' in window) {
              if (Notification.permission === 'granted') {
                handlePreferenceChange('browser_notifications_enabled', true);
              }
            }
          }}
        />
      )}
    </Layout>
  );
};

export default Settings;
