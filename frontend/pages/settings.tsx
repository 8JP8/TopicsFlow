import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Layout from '@/components/Layout/Layout';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { toast } from 'react-hot-toast';

interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'en' | 'pt';
  notifications_enabled?: boolean;
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
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'privacy'>('preferences');

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
        sound_enabled: user.preferences.sound_enabled !== false,
      });
    }
  }, [user, authLoading, router]);

  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    // Apply theme immediately
    if (key === 'theme') {
      document.documentElement.classList.toggle('dark', value === 'dark');
    }

    // Save to backend
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

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
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
                    onClick={() => router.push('/settings/anonymous-identities')}
                    className="w-full sm:w-auto px-4 py-2 btn btn-ghost"
                  >
                    {t('settings.manageAnonymousIdentities')}
                  </button>
                </div>
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
                    <h4 className="font-medium theme-text-primary mb-2">{t('settings.anonymousPosting')}</h4>
                    <p className="text-sm theme-text-secondary mb-3">
                      {t('settings.anonymousPostingDesc')}
                    </p>
                    <button
                      onClick={() => router.push('/settings/anonymous-identities')}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t('settings.viewAnonymousIdentities')}
                    </button>
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
    </Layout>
  );
};

export default Settings;
