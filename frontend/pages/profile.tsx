import { getUserBannerGradient, getUserColorClass } from '@/utils/colorUtils';

// ... (imports)

// In avatar section
                  <div className={`w-24 h-24 rounded-full ${getUserColorClass(username)} flex items-center justify-center border-4 theme-border`}>
                    <span className="text-3xl text-white font-semibold">
                      {username.charAt(0).toUpperCase()}
                    </span>
                  </div>

// ... (in banner section)
                  <div className="w-full h-full flex items-center justify-center" style={getUserBannerGradient(user?.id || user?.username)}>
                    <span className="text-sm text-white opacity-80 font-medium">
                      {t('profile.noBanner') || 'No banner image'}
                    </span>
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
            </div >
          </div >

  {/* Username */ }
  < div >
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
          </div >

  {/* Email (read-only) */ }
  < div >
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
          </div >

  {/* Action Buttons */ }
  < div className = "flex justify-end space-x-3 pt-4 border-t theme-border" >
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
          </div >
        </div >

  {/* Account Info */ }
  < div className = "mt-6 theme-bg-secondary rounded-lg shadow-sm p-6" >
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
        </div >
      </div >
    </Layout >
  );
};

export default Profile;
