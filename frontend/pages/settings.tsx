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
import BackupCodesModal from '@/components/Settings/BackupCodesModal';
import DeleteAccountModal from '@/components/Settings/DeleteAccountModal';
import NotificationPermissionDialog from '@/components/UI/NotificationPermissionDialog';

interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'en' | 'pt';
  notifications_enabled?: boolean;
  browser_notifications_enabled?: boolean;
  sound_enabled?: boolean;
  show_support_widget?: boolean;
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
    show_support_widget: true,
  });
  const [_loading, _setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'privacy' | 'anonymous-identities'>('preferences');
  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);
  const [showHiddenItemsModal, setShowHiddenItemsModal] = useState(false);
  const [showFollowedPublicationsModal, setShowFollowedPublicationsModal] = useState(false);
  const [showFollowedChatroomsModal, setShowFollowedChatroomsModal] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [anonymousIdentities, setAnonymousIdentities] = useState<Array<{ id: string, topic_id: string, topic_title: string, identity_name: string, created_at: string, message_count: number }>>([]);
  const [loadingIdentities, setLoadingIdentities] = useState(false);
  const [deletingIdentityId, setDeletingIdentityId] = useState<string | null>(null);

  // Listen for tour events
  useEffect(() => {
    const handleSwitchTab = (e: CustomEvent) => {
      const tab = e.detail;
      if (['account', 'preferences', 'privacy', 'anonymous-identities'].includes(tab)) {
        setActiveTab(tab as any);
      }
    };

    window.addEventListener('tour:switch-settings-tab', handleSwitchTab as EventListener);
    return () => {
      window.removeEventListener('tour:switch-settings-tab', handleSwitchTab as EventListener);
    };
  }, []);

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
        browser_notifications_enabled: (user.preferences as any).browser_notifications_enabled || false,
        sound_enabled: user.preferences.sound_enabled !== false,
        show_support_widget: (user.preferences as any).show_support_widget !== false,
      });
    }

    // Check browser notification permission status
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = Notification.permission;
      if (permission === 'granted' && !preferences.browser_notifications_enabled) {
        setPreferences(prev => ({ ...prev, browser_notifications_enabled: true }));
      }
    }

    // Handle query param for tab
    if (router.query.tab) {
      const tab = router.query.tab as string;
      if (['account', 'preferences', 'privacy', 'anonymous-identities'].includes(tab)) {
        setActiveTab(tab as any);
      }
    }

  }, [user, authLoading, router]);



  // Load anonymous identities when tab is active
  useEffect(() => {
    if (user && activeTab === 'anonymous-identities') {
      loadAnonymousIdentities();
    }
  }, [user, activeTab]);

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

    setDeletingIdentityId(topicId);

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
    } finally {
      setDeletingIdentityId(null);
    }
  };

  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    // Apply theme immediately without showing toast
    // Apply theme immediately without showing toast
    if (key === 'theme') {
      // Use the context's setTheme (via explicit prop logic if we had access, but here we manually toggle class and fetch)
      // Actually, we should call standard logic.
      // Since we are in Settings, we WANT to save to backend.

      // Update local state (ui) and localStorage
      const themeValue = value as 'light' | 'dark';
      document.documentElement.setAttribute('data-theme', themeValue);
      document.documentElement.classList.toggle('dark', themeValue === 'dark');
      localStorage.setItem('theme', themeValue); // Explicitly ensure it's saved

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const updateTab = (tab: 'account' | 'preferences' | 'privacy' | 'anonymous-identities') => {
    setActiveTab(tab);
    // Optional: update URL shallowly
    router.push({ pathname: '/settings', query: { tab } }, undefined, { shallow: true });
  }

  if (authLoading || !user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  // Continue tour from dashboard
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shouldContinueTour = localStorage.getItem('continue_tour_settings');
      if (shouldContinueTour === 'true') {
        localStorage.removeItem('continue_tour_settings');
        // Small delay to ensure rendering
        setTimeout(() => {
          // Trigger settings tab switch logic if needed (e.g. tour might expect default tab)
          // But main tour start is enough as step 1 targets #settings-tabs
          window.dispatchEvent(new CustomEvent('tour:start'));
        }, 500);
      }
    }
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <button
            id="back-to-dashboard-btn"
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
        <div className="border-b theme-border mb-6 overflow-x-auto">
          <nav id="settings-tabs" className="flex space-x-8">
            <button
              id="preferences-tab-btn"
              onClick={() => updateTab('preferences')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'preferences'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300'
                }`}
            >
              {t('settings.preferences')}
            </button>
            <button
              id="account-tab-btn"
              onClick={() => updateTab('account')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'account'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300'
                }`}
            >
              {t('settings.account')}
            </button>
            <button
              id="anonymous-identities-tab-btn"
              onClick={() => updateTab('anonymous-identities')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'anonymous-identities'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300'
                }`}
            >
              {t('settings.anonymousIdentities') || 'Anonymous Identities'}
            </button>
            <button
              id="privacy-tab-btn"
              onClick={() => updateTab('privacy')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'privacy'
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
            <div className="space-y-8">
              {/* Profile Details Group */}
              <div>
                <h2 className="text-xl font-semibold theme-text-primary mb-4">{t('settings.profileDetails') || 'Profile Details'}</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium theme-text-primary">{t('settings.username')}</label>
                    <div className="p-3 theme-bg-tertiary theme-border border rounded-lg theme-text-primary opacity-75">
                      {user.username}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium theme-text-primary">{t('settings.email')}</label>
                    <div className="p-3 theme-bg-tertiary theme-border border rounded-lg theme-text-primary opacity-75">
                      {user.email}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/profile')}
                    id="edit-profile-btn"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    {t('settings.editProfile')}
                  </button>
                </div>
              </div>

              {/* Content & Safety Group */}
              <div className="pt-6 border-t theme-border">
                <h2 className="text-xl font-semibold theme-text-primary mb-4">{t('settings.contentAndSafety') || 'Content & Safety'}</h2>
                <div id="content-safety-group" className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                  <button
                    id="blocked-users-btn"
                    onClick={() => setShowBlockedUsersModal(true)}
                    className="flex items-center justify-between p-4 theme-bg-tertiary border theme-border rounded-lg hover:border-blue-500 transition-colors group text-left"
                  >
                    <div className="flex items-center">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg mr-3 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <span className="font-medium theme-text-primary">{t('settings.blockedUsers')}</span>
                    </div>
                  </button>

                  <button
                    id="hidden-items-btn"
                    onClick={() => setShowHiddenItemsModal(true)}
                    className="flex items-center justify-between p-4 theme-bg-tertiary border theme-border rounded-lg hover:border-blue-500 transition-colors group text-left"
                  >
                    <div className="flex items-center">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mr-3 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                        <svg className="w-5 h-5 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      </div>
                      <span className="font-medium theme-text-primary">{t('settings.hiddenItems')}</span>
                    </div>
                  </button>

                  <button
                    id="followed-publications-btn"
                    onClick={() => setShowFollowedPublicationsModal(true)}
                    className="flex items-center justify-between p-4 theme-bg-tertiary border theme-border rounded-lg hover:border-blue-500 transition-colors group text-left"
                  >
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                      </div>
                      <span className="font-medium theme-text-primary">{t('settings.followedPublications')}</span>
                    </div>
                  </button>

                  <button
                    id="followed-chatrooms-btn"
                    onClick={() => setShowFollowedChatroomsModal(true)}
                    className="flex items-center justify-between p-4 theme-bg-tertiary border theme-border rounded-lg hover:border-blue-500 transition-colors group text-left"
                  >
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mr-3 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                        </svg>
                      </div>
                      <span className="font-medium theme-text-primary">{t('settings.followedChatrooms')}</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Danger Zone Group */}
              <div className="pt-6 border-t theme-border">
                <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">{t('settings.dangerZone')}</h2>

                <div className="space-y-4">
                  {/* Logout Button */}
                  <div className="p-4 theme-bg-tertiary border theme-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium theme-text-primary">{t('settings.logout')}</h3>
                        <p className="text-sm theme-text-secondary mt-1">{t('settings.logoutDesc') || 'Sign out of your account on this device.'}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="px-4 py-2 theme-bg-secondary hover:theme-bg-hover text-red-600 border theme-border rounded-lg font-medium transition-colors"
                      >
                        {t('settings.logout')}
                      </button>
                    </div>
                  </div>

                  {/* Delete Account Button */}
                  <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-red-700 dark:text-red-300">{t('settings.deleteAccount') || 'Delete Account'}</h3>
                        <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                          {t('settings.deleteAccountDesc') || 'Permanently delete your account and all data. This action cannot be undone.'}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowDeleteAccountModal(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                      >
                        {t('settings.deleteAccount') || 'Delete Account'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'anonymous-identities' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold theme-text-primary mb-2">{t('settings.anonymousIdentities') || 'Anonymous Identities'}</h2>
                <p className="text-sm theme-text-secondary mb-6">
                  {t('anonymousIdentities.subtitle') || 'Manage your anonymous identities across different topics.'}
                </p>

                {/* Info Banner */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">{t('anonymousIdentities.infoTitle') || 'About Anonymous Identities'}</h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {t('anonymousIdentities.infoDesc') || 'Anonymous identities allow you to participate in topics without revealing your real username.'}
                      </p>
                    </div>
                  </div>
                </div>

                {loadingIdentities ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="md" />
                  </div>
                ) : anonymousIdentities.length === 0 ? (
                  <div className="text-center py-12 border theme-border rounded-lg theme-bg-tertiary">
                    <svg className="w-12 h-12 theme-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-sm theme-text-secondary">
                      {t('settings.noAnonymousIdentities') || 'You have no anonymous identities.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {anonymousIdentities.map((identity) => (
                      <div
                        key={identity.topic_id}
                        className="p-4 rounded-lg border theme-border theme-bg-tertiary hover:theme-bg-hover transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-1">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mr-3">
                                <span className="text-white font-semibold text-xs">
                                  {identity.identity_name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium theme-text-primary">
                                  {identity.identity_name}
                                </h4>
                                <p className="text-xs theme-text-secondary">
                                  in <span className="font-medium">{identity.topic_title}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-4 text-xs theme-text-muted mt-2 ml-11">
                              <span>{identity.message_count} {t('settings.messages') || 'messages'}</span>
                              <span>•</span>
                              <span>{t('anonymousIdentities.createdAt')} {formatDate(identity.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => router.push(`/?topic=${identity.topic_id}`)}
                              className="p-2 text-xs btn btn-ghost"
                              title={t('anonymousIdentities.viewTopic') || 'View Topic'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteIdentity(identity.topic_id)}
                              disabled={deletingIdentityId === identity.topic_id}
                              className="p-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                              title={t('common.delete') || 'Delete'}
                            >
                              {deletingIdentityId === identity.topic_id ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${preferences.theme === 'light'
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
                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${preferences.theme === 'dark'
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences.notifications_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences.browser_notifications_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences.browser_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences.sound_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences.sound_enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium theme-text-primary">{t('supportWidget.toggleLabel') || 'Support Button'}</h4>
                      <p className="text-sm theme-text-secondary">{t('supportWidget.toggleDescription') || 'Show the support button in the header toolbar'}</p>
                    </div>
                    <button
                      onClick={() => handlePreferenceChange('show_support_widget', !preferences.show_support_widget)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences.show_support_widget ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences.show_support_widget ? 'translate-x-6' : 'translate-x-1'
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
                        {user?.totp_enabled && (
                          <button
                            onClick={() => setShowBackupCodesModal(true)}
                            className="mt-3 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            {t('settings.viewRegenerateBackupCodes') || 'View/Regenerate Backup Codes'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Backup Codes Modal */}
                  <BackupCodesModal
                    isOpen={showBackupCodesModal}
                    onClose={() => setShowBackupCodesModal(false)}
                  />


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
      {showFollowedPublicationsModal && (
        <FollowedPublicationsModal
          isOpen={showFollowedPublicationsModal}
          onClose={() => setShowFollowedPublicationsModal(false)}
        />
      )}
      {showFollowedChatroomsModal && (
        <FollowedChatroomsModal
          isOpen={showFollowedChatroomsModal}
          onClose={() => setShowFollowedChatroomsModal(false)}
        />
      )}

      <DeleteAccountModal
        isOpen={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
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
