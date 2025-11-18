import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Layout from '@/components/Layout/Layout';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { toast } from 'react-hot-toast';

const Profile: React.FC = () => {
  const router = useRouter();
  const { user, loading: authLoading, updateUser } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      setUsername(user.username);
      setProfilePicture(user.profile_picture || null);
      setPreviewImage(user.profile_picture || null);
    }
  }, [user, authLoading, router]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('toast.pleaseSelectImageFile'));
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('toast.imageMustBeLessThan2MB'));
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setProfilePicture(base64String);
      setPreviewImage(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setProfilePicture('');
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      toast.error(t('profile.usernameRequired'));
      return;
    }

    setLoading(true);

    try {
      const updates: any = {};

      // Only include changed fields
      if (username !== user?.username) {
        updates.username = username;
      }

      if (profilePicture !== user?.profile_picture) {
        updates.profile_picture = profilePicture;
      }

      if (Object.keys(updates).length === 0) {
        toast(t('profile.noChanges'));
        setLoading(false);
        return;
      }

      const response = await api.put(API_ENDPOINTS.USERS.PROFILE, updates);

      if (response.data.success) {
        toast.success(t('profile.profileUpdated'));
        // Update user context
        if (updateUser && response.data.data) {
          updateUser(response.data.data);
        }
      } else {
        toast.error(response.data.errors?.join(', ') || t('toast.failedToUpdateProfile'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.join(', ') || t('toast.failedToUpdateProfile'));
    } finally {
      setLoading(false);
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
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-8">
          <button
            onClick={() => router.push('/settings')}
            className="flex items-center text-sm theme-text-secondary hover:theme-text-primary mb-4 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('profile.backToSettings')}
          </button>
          <h1 className="text-3xl font-bold theme-text-primary mb-2">{t('profile.title')}</h1>
          <p className="theme-text-secondary">{t('profile.subtitle')}</p>
        </div>

        <div className="theme-bg-secondary rounded-lg shadow-sm p-6 space-y-6">
          {/* Profile Picture */}
          <div>
            <label className="block text-sm font-medium theme-text-primary mb-3">{t('profile.profilePicture')}</label>
            <div className="flex items-center space-x-6">
              <div className="relative">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 theme-border"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full theme-bg-tertiary flex items-center justify-center border-4 theme-border">
                    <span className="text-3xl theme-text-primary font-semibold">
                      {username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="profile-picture-input"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 btn btn-ghost"
                  >
                    <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {t('profile.uploadPhoto')}
                  </button>
                  {previewImage && (
                    <button
                      onClick={handleRemoveImage}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                    >
                      {t('profile.remove')}
                    </button>
                  )}
                </div>
                <p className="text-xs theme-text-muted mt-2">
                  {t('profile.imageFormat')}
                </p>
              </div>
            </div>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium theme-text-primary mb-1">
              {t('profile.username')}
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary"
              placeholder={t('profile.usernamePlaceholder')}
              maxLength={30}
            />
            <p className="text-xs theme-text-muted mt-1">
              {t('profile.usernameHint')}
            </p>
          </div>

          {/* Email (read-only) */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium theme-text-primary mb-1">
              {t('profile.email')}
            </label>
            <input
              type="email"
              id="email"
              value={user.email}
              disabled
              className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary cursor-not-allowed opacity-60"
            />
            <p className="text-xs theme-text-muted mt-1">
              {t('profile.emailCannotChange')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t theme-border">
            <button
              onClick={() => router.push('/settings')}
              disabled={loading}
              className="px-4 py-2 btn btn-ghost"
            >
              {t('profile.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 btn btn-primary"
            >
              {loading ? <LoadingSpinner size="sm" /> : t('profile.saveChanges')}
            </button>
          </div>
        </div>

        {/* Account Info */}
        <div className="mt-6 theme-bg-secondary rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold theme-text-primary mb-4">{t('profile.accountInformation')}</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm theme-text-secondary">{t('profile.accountCreated')}</span>
              <span className="text-sm theme-text-primary font-medium">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm theme-text-secondary">{t('profile.twoFactorAuth')}</span>
              <span className={`text-sm font-medium ${user.totp_enabled ? 'text-green-600 dark:text-green-400' : 'theme-text-muted'}`}>
                {user.totp_enabled ? t('profile.enabled') : t('profile.disabled')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
