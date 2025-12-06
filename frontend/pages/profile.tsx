import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Layout from '@/components/Layout/Layout';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { clearUserProfileCache, refreshUserProfile } from '@/hooks/useUserProfile';

const Profile: React.FC = () => {
  const router = useRouter();
  const { user, loading: authLoading, updateUser, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewBanner, setPreviewBanner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      setUsername(user.username);
      // Always use the latest profile_picture from user context
      const currentProfilePicture = user.profile_picture || null;
      setProfilePicture(currentProfilePicture);
      // Update preview from user context (will be overridden if user selects new image)
      setPreviewImage(currentProfilePicture);
      // Always use the latest banner from user context
      const currentBanner = user.banner || null;
      setBanner(currentBanner);
      setPreviewBanner(currentBanner);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('toast.pleaseSelectImageFile'));
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('toast.imageMustBeLessThan10MB') || 'Image must be less than 10MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      console.log('Image selected, base64 length:', base64String.length, 'starts with:', base64String.substring(0, 30));
      setProfilePicture(base64String);
      setPreviewImage(base64String);
    };
    reader.onerror = () => {
      console.error('Failed to read image file');
      toast.error(t('toast.failedToReadImage') || 'Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('toast.pleaseSelectImageFile'));
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('toast.imageMustBeLessThan10MB') || 'Image must be less than 10MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setBanner(base64String);
      setPreviewBanner(base64String);
    };
    reader.onerror = () => {
      console.error('Failed to read banner file');
      toast.error(t('toast.failedToReadImage') || 'Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBanner = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Send null to delete banner
      const response = await api.put(API_ENDPOINTS.USERS.PROFILE, {
        banner: null,
      });

      if (response.data.success) {
        toast.success(t('profile.bannerDeleted') || 'Banner deleted');
        
        // Clear local state
        setBanner(null);
        setPreviewBanner(null);
        if (bannerInputRef.current) {
          bannerInputRef.current.value = '';
        }
        
        // Clear cache and refresh
        if (user.id) {
          clearUserProfileCache(user.id);
          await refreshUserProfile(user.id);
        }
        
        // Refresh user data from server
        if (refreshUser) {
          await refreshUser();
        }
      } else {
        toast.error(response.data.errors?.join(', ') || t('toast.failedToDeleteBanner') || 'Failed to delete banner');
      }
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.join(', ') || t('toast.failedToDeleteBanner') || 'Failed to delete banner';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Send null to delete profile picture
      const response = await api.put(API_ENDPOINTS.USERS.PROFILE, {
        profile_picture: null,
      });

      if (response.data.success) {
        toast.success(t('profile.profilePictureDeleted') || 'Profile picture deleted');
        
        // Clear local state
        setProfilePicture(null);
        setPreviewImage(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Clear cache and refresh
        if (user.id) {
          clearUserProfileCache(user.id);
          await refreshUserProfile(user.id);
        }
        
        // Refresh user data from server
        if (refreshUser) {
          await refreshUser();
        }
        
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('profilePictureUpdated', {
          detail: { userId: user.id, profilePicture: null }
        }));
      } else {
        toast.error(response.data.errors?.join(', ') || t('toast.failedToDeleteProfilePicture') || 'Failed to delete profile picture');
      }
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.join(', ') || t('toast.failedToDeleteProfilePicture') || 'Failed to delete profile picture';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      toast.error(t('profile.usernameRequired'));
      return;
    }

    setLoading(true);

    try {
      const updates: { username?: string; profile_picture?: string | null; banner?: string | null } = {};

      // Only include changed fields
      if (username !== user?.username) {
        updates.username = username;
      }

      // Always include profile picture if it's set (even if it's the same, to handle format changes)
      if (profilePicture) {
        // Send the base64 string (with or without data URI prefix - backend handles both)
        updates.profile_picture = profilePicture;
        console.log('Sending profile picture update, length:', profilePicture.length, 'starts with:', profilePicture.substring(0, 30));
      } else if (profilePicture === null && user?.profile_picture) {
        // Explicitly set to null to remove profile picture
        updates.profile_picture = null;
      }

      // Always include banner if it's set (even if it's the same, to handle format changes)
      if (banner) {
        // Send the base64 string (with or without data URI prefix - backend handles both)
        updates.banner = banner;
        console.log('Sending banner update, length:', banner.length, 'starts with:', banner.substring(0, 30));
      } else if (banner === null && user?.banner) {
        // Explicitly set to null to remove banner
        updates.banner = null;
      }

      if (Object.keys(updates).length === 0) {
        toast(t('profile.noChanges'));
        setLoading(false);
        return;
      }

      const response = await api.put(API_ENDPOINTS.USERS.PROFILE, updates);

      if (response.data.success) {
        toast.success(t('profile.profileUpdated'));
        
        // Get the updated user data from response
        const updatedUserData = response.data.data;
        
        // Log for debugging
        console.log('Profile update response:', updatedUserData);
        console.log('Profile picture in response:', updatedUserData?.profile_picture ? `${updatedUserData.profile_picture.substring(0, 50)}...` : 'null/undefined');
        
        // Update local state immediately with the response data
        if (updatedUserData && updatedUserData.profile_picture !== undefined) {
          const newProfilePicture = updatedUserData.profile_picture || null;
          // Ensure it has data URI prefix if it's base64
          const normalizedPicture = newProfilePicture && !newProfilePicture.startsWith('data:') 
            ? `data:image/jpeg;base64,${newProfilePicture}` 
            : newProfilePicture;
          setProfilePicture(normalizedPicture);
          setPreviewImage(normalizedPicture);
          console.log('Updated local profile picture state:', normalizedPicture ? `has picture (${normalizedPicture.substring(0, 30)}...)` : 'no picture');
        }
        if (updatedUserData && updatedUserData.username) {
          setUsername(updatedUserData.username);
        }
        
        // Clear cache and force refresh from API to ensure we have the latest data
        if (user?.id) {
          clearUserProfileCache(user.id);
          // Force refresh from API to get the latest profile picture
          const refreshedProfile = await refreshUserProfile(user.id);
          console.log('Refreshed profile from API:', refreshedProfile?.profile_picture ? 'has picture' : 'no picture');
        }
        
        // Refresh user data from server to ensure consistency (this will update AuthContext)
        // This is important because /api/auth/me now includes profile_picture
        if (refreshUser) {
          await refreshUser();
          console.log('Refreshed user from AuthContext');
        }
        
        // Also update user context directly with the response data as a fallback
        if (updateUser && updatedUserData) {
          // Merge with current user data to preserve other fields
          const mergedUserData = {
            ...user,
            ...updatedUserData,
            profile_picture: updatedUserData.profile_picture !== undefined ? updatedUserData.profile_picture : user?.profile_picture,
          };
          updateUser(mergedUserData);
          console.log('Updated user context with profile picture:', mergedUserData.profile_picture ? 'has picture' : 'no picture');
        }
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('profilePictureUpdated', {
          detail: { userId: user?.id, profilePicture: updatedUserData?.profile_picture }
        }));
      } else {
        toast.error(response.data.errors?.join(', ') || t('toast.failedToUpdateProfile'));
      }
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.join(', ') || t('toast.failedToUpdateProfile');
      toast.error(errorMessage);
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
                    src={previewImage.startsWith('data:') ? previewImage : `data:image/jpeg;base64,${previewImage}`}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 theme-border"
                    onError={(e) => {
                      console.error('Failed to load profile image:', previewImage?.substring(0, 50));
                      e.currentTarget.style.display = 'none';
                    }}
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

          {/* Banner */}
          <div>
            <label className="block text-sm font-medium theme-text-primary mb-3">{t('profile.banner') || 'Banner Image'}</label>
            <div className="space-y-4">
              <div className="relative w-full h-32 rounded-lg overflow-hidden border theme-border">
                {previewBanner ? (
                  <img
                    src={previewBanner.startsWith('data:') ? previewBanner : `data:image/jpeg;base64,${previewBanner}`}
                    alt="Banner"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('Failed to load banner image:', previewBanner?.substring(0, 50));
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-sm theme-text-primary opacity-50">
                      {t('profile.noBanner') || 'No banner image'}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerSelect}
                  className="hidden"
                  id="banner-input"
                />
                <button
                  onClick={() => bannerInputRef.current?.click()}
                  className="px-4 py-2 btn btn-ghost"
                >
                  <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {t('profile.uploadBanner') || 'Upload Banner'}
                </button>
                {previewBanner && (
                  <button
                    onClick={handleRemoveBanner}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                  >
                    {t('profile.remove')}
                  </button>
                )}
              </div>
              <p className="text-xs theme-text-muted">
                {t('profile.bannerFormat') || 'Recommended: 1200x300px. Max 10MB. JPG, PNG, or GIF.'}
              </p>
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
