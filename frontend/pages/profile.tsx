import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Layout from '@/components/Layout/Layout';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import Avatar from '@/components/UI/Avatar';
import CountryFlag from '@/components/UI/CountryFlag';
import { toast } from 'react-hot-toast';
import { getUserBannerGradient, getUserColorClass } from '@/utils/colorUtils';
import { COUNTRIES, getCountryFlagUrl, searchCountries } from '@/utils/countries';

const Profile: React.FC = () => {
  const router = useRouter();
  const { user, loading: authLoading, updateUser } = useAuth();
  const { t, language } = useLanguage();

  const [username, setUsername] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [previewBanner, setPreviewBanner] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const search = countrySearch.toLowerCase();
    const lang = language as 'en' | 'pt';
    return COUNTRIES.filter(c =>
      c.name[lang].toLowerCase().includes(search) ||
      c.name.en.toLowerCase().includes(search) ||
      c.code.toLowerCase().includes(search)
    );
  }, [countrySearch, language]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle country selection
  const handleCountrySelect = (code: string) => {
    setCountryCode(code);
    const country = COUNTRIES.find(c => c.code === code);
    const lang = language as 'en' | 'pt';
    setCountrySearch(country ? country.name[lang] : '');  // Localized name
    setCountryDropdownOpen(false);
  };


  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setCountryCode(user.country_code || '');
      // Initialize country search display with existing country name only
      if (user.country_code) {
        const country = COUNTRIES.find(c => c.code === user.country_code);
        const lang = language as 'en' | 'pt';
        if (country) {
          setCountrySearch(country.name[lang]);  // Localized name
        }
      }

      if (user.profile_picture) {
        setPreviewAvatar(user.profile_picture.startsWith('data:')
          ? user.profile_picture
          : `data:image/jpeg;base64,${user.profile_picture}`);
      }
      if (user.banner) {
        setPreviewBanner(user.banner.startsWith('data:')
          ? user.banner
          : `data:image/jpeg;base64,${user.banner}`);
      }
    }
  }, [user]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('toast.imageMustBeLessThan2MB') || 'Image must be less than 2MB');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('toast.imageMustBeLessThan10MB') || 'Image must be less than 10MB');
      return;
    }

    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewBanner(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setPreviewAvatar(null);
    setAvatarFile(null);
  };

  const handleRemoveBanner = () => {
    setPreviewBanner(null);
    setBannerFile(null);
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Update profile
      const response = await api.put(API_ENDPOINTS.USERS.PROFILE, {
        username: username.trim(),
        country_code: countryCode || null,
        profile_picture: previewAvatar,
        banner: previewBanner,
      });

      if (response.data.success) {
        toast.success(t('profile.profileUpdated') || 'Profile updated successfully');
        updateUser({
          ...user,
          username: username.trim(),
          country_code: countryCode || null,
          profile_picture: previewAvatar || undefined,
          banner: previewBanner || undefined,
        });
      } else {
        toast.error(response.data.error || t('profile.updateFailed') || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error(error.response?.data?.error || t('profile.updateFailed') || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <Head>
        <title>{t('profile.title') || 'Edit Profile'} | TopicsFlow</title>
      </Head>

      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold theme-text-primary mb-6">{t('profile.title') || 'Edit Profile'}</h1>

        <div className="theme-bg-secondary rounded-lg shadow-sm p-6 space-y-6">
          {/* Avatar Section */}
          <div>
            <label className="block text-sm font-medium theme-text-primary mb-3">
              {t('profile.profilePicture') || 'Profile Picture'}
            </label>
            <div className="flex items-center space-x-4">
              <div className="relative">
                {previewAvatar ? (
                  <img
                    src={previewAvatar}
                    alt="Avatar preview"
                    className="w-24 h-24 rounded-full object-cover border-4 theme-border"
                  />
                ) : (
                  <div className={`w-24 h-24 rounded-full ${getUserColorClass(username)} flex items-center justify-center border-4 theme-border`}>
                    <span className="text-3xl text-white font-semibold">
                      {username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col space-y-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-4 py-2 btn btn-ghost"
                >
                  {t('profile.uploadPhoto') || 'Upload Photo'}
                </button>
                {previewAvatar && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    {t('profile.remove') || 'Remove'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Banner Section */}
          <div>
            <label className="block text-sm font-medium theme-text-primary mb-3">
              {t('profile.banner') || 'Profile Banner'}
            </label>
            <div className="w-full h-32 rounded-lg overflow-hidden border theme-border mb-3">
              {previewBanner ? (
                <img
                  src={previewBanner}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={getUserBannerGradient(user?.id || user?.username)}>
                  <span className="text-sm text-white opacity-80 font-medium">
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
              />
              <button
                onClick={() => bannerInputRef.current?.click()}
                className="px-4 py-2 btn btn-ghost"
              >
                {t('profile.uploadBanner') || 'Upload Banner'}
              </button>
              {previewBanner && (
                <button
                  onClick={handleRemoveBanner}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  {t('profile.remove') || 'Remove'}
                </button>
              )}
            </div>
            <p className="text-xs theme-text-muted mt-1">
              {t('profile.bannerFormat') || 'Recommended: 1200x300px. Max 10MB.'}
            </p>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium theme-text-primary mb-1">
              {t('profile.username') || 'Username'}
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary"
              maxLength={30}
            />
          </div>

          {/* Country */}
          <div>
            <label htmlFor="country" className="block text-sm font-medium theme-text-primary mb-1">
              {t('profile.country') || 'Country'}
            </label>
            <div className="relative" ref={countryDropdownRef}>
              <div className="relative flex items-center">
                {/* Flag indicator */}
                {countryCode && (
                  <span className="absolute left-3 pointer-events-none">
                    <CountryFlag countryCode={countryCode} size="sm" />
                  </span>
                )}

                <input
                  type="text"
                  id="country"
                  value={countrySearch}
                  onChange={(e) => {
                    setCountrySearch(e.target.value);
                    setCountryDropdownOpen(true);
                    // If user clears the field, clear the selection
                    if (!e.target.value.trim()) {
                      setCountryCode('');
                    }
                  }}
                  onFocus={() => setCountryDropdownOpen(true)}
                  placeholder={t('profile.searchCountry') || 'Search country...'}
                  className={`w-full py-2 pr-10 theme-bg-tertiary theme-border rounded-lg theme-text-primary ${countryCode ? 'pl-11' : 'pl-4'
                    }`}
                  autoComplete="off"
                />
                <div className="absolute right-3 pointer-events-none">
                  <svg className="w-5 h-5 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {/* Dropdown */}
              {countryDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 theme-bg-secondary theme-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredCountries.length === 0 ? (
                    <div className="px-4 py-2 theme-text-muted text-sm">
                      {t('profile.noCountriesFound') || 'No countries found'}
                    </div>
                  ) : (
                    filteredCountries.map((country) => {
                      const lang = language as 'en' | 'pt';
                      return (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => handleCountrySelect(country.code)}
                          className={`w-full px-4 py-2 text-left hover:theme-bg-hover flex items-center gap-2 transition-colors ${countryCode === country.code ? 'theme-bg-tertiary' : ''}`}
                        >
                          <CountryFlag countryCode={country.code} size="sm" />
                          <span className="theme-text-primary">{country.name[lang]}</span>
                        </button>
                      )
                    })

                  )}
                </div>
              )}
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium theme-text-primary mb-1">
              {t('profile.email') || 'Email'}
            </label>
            <input
              type="email"
              id="email"
              value={user.email}
              disabled
              className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary cursor-not-allowed opacity-60"
            />
            <p className="text-xs theme-text-muted mt-1">
              {t('profile.emailCannotChange') || 'Email cannot be changed'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t theme-border">
            <button
              onClick={() => router.push('/settings')}
              disabled={loading}
              className="px-4 py-2 btn btn-ghost"
            >
              {t('profile.cancel') || 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 btn btn-primary"
            >
              {loading ? <LoadingSpinner size="sm" /> : t('profile.saveChanges') || 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Account Info */}
        <div className="mt-6 theme-bg-secondary rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold theme-text-primary mb-4">{t('profile.accountInformation') || 'Account Information'}</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm theme-text-secondary">{t('profile.accountCreated') || 'Account Created'}</span>
              <span className="text-sm theme-text-primary font-medium">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm theme-text-secondary">{t('profile.twoFactorAuth') || '2FA Status'}</span>
              <span className={`text-sm font-medium ${user.totp_enabled ? 'text-green-600 dark:text-green-400' : 'theme-text-muted'}`}>
                {user.totp_enabled ? t('profile.enabled') || 'Enabled' : t('profile.disabled') || 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
