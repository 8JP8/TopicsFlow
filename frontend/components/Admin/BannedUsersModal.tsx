import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../UI/LoadingSpinner';
import Avatar from '../UI/Avatar';

interface BannedUser {
  id: string;
  username: string;
  email: string;
  profile_picture?: string;
  ban_reason: string;
  banned_at: string | null;
  ban_expiry: string | null;
  banned_by: {
    id: string;
    username: string;
  } | null;
  is_permanent: boolean;
}

interface BannedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BannedUsersModal: React.FC<BannedUsersModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [unbanning, setUnbanning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBannedUsers();
    }
  }, [isOpen]);

  const loadBannedUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.ADMIN.BANNED_USERS);
      if (response.data.success) {
        setBannedUsers(response.data.data || []);
        // Only show error if we expected data but got none AND there was an error
        if (response.data.data && response.data.data.length === 0 && response.data.errors) {
          // Don't show error for empty list - that's normal
        }
      } else {
        const errorMsg = response.data.errors?.[0] || t('admin.failedToLoadBannedUsers') || 'Failed to load banned users';
        toast.error(errorMsg);
        setBannedUsers([]); // Set empty array on error
      }
    } catch (error: any) {
      console.error('Failed to load banned users:', error);
      const errorMsg = error.response?.data?.errors?.[0] || t('admin.failedToLoadBannedUsers') || 'Failed to load banned users';
      // Only show toast if it's not a 401/403 (auth issues)
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        toast.error(errorMsg);
      }
      setBannedUsers([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleUnbanUser = async (userId: string, username: string) => {
    if (!confirm(t('admin.confirmUnban', { username }) || `Are you sure you want to unban ${username}?`)) {
      return;
    }

    try {
      setUnbanning(userId);
      const response = await api.post(API_ENDPOINTS.ADMIN.UNBAN_USER(userId));
      if (response.data.success) {
        toast.success(t('admin.userUnbanned', { username }) || `${username} has been unbanned`);
        loadBannedUsers();
      } else {
        toast.error(response.data.errors?.[0] || t('admin.failedToUnban') || 'Failed to unban user');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('admin.failedToUnban') || 'Failed to unban user');
    } finally {
      setUnbanning(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const isBanExpired = (banExpiry: string | null) => {
    if (!banExpiry) return false; // Permanent ban
    const expiry = new Date(banExpiry);
    return expiry < new Date();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="theme-bg-secondary border theme-border rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b theme-border">
            <div>
              <h2 className="text-xl font-bold theme-text-primary">
                {t('admin.bannedUsers') || 'Banned Users'}
              </h2>
              <p className="text-sm theme-text-muted mt-1">
                {t('admin.bannedUsersDesc') || 'View and manage banned users'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
            >
              <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : bannedUsers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 theme-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-lg theme-text-primary mb-2">
                  {t('admin.noBannedUsers') || 'No banned users'}
                </p>
                <p className="text-sm theme-text-muted">
                  {t('admin.noBannedUsersDesc') || 'There are currently no banned users.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bannedUsers.map((user) => {
                  const expired = isBanExpired(user.ban_expiry);
                  return (
                    <div
                      key={user.id}
                      className={`p-4 theme-bg-tertiary rounded-lg border theme-border ${
                        expired ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1">
                          <Avatar
                            userId={user.id}
                            username={user.username}
                            profilePicture={user.profile_picture}
                            size="md"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-lg font-semibold theme-text-primary">
                                {user.username}
                              </h3>
                              {expired && (
                                <span className="px-2 py-1 text-xs bg-yellow-500 text-white rounded">
                                  {t('admin.banExpired') || 'Expired'}
                                </span>
                              )}
                              {user.is_permanent && (
                                <span className="px-2 py-1 text-xs bg-red-500 text-white rounded">
                                  {t('admin.permanentBan') || 'Permanent'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm theme-text-muted">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnbanUser(user.id, user.username)}
                          disabled={unbanning === user.id}
                          className="px-4 py-2 btn btn-primary disabled:opacity-50"
                        >
                          {unbanning === user.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            t('admin.unban') || 'Unban'
                          )}
                        </button>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium theme-text-primary">
                            {t('admin.banReason') || 'Reason'}:{' '}
                          </span>
                          <span className="theme-text-secondary">{user.ban_reason}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-xs theme-text-muted">
                          <div>
                            <span className="font-medium">{t('admin.bannedAt') || 'Banned at'}: </span>
                            {formatDate(user.banned_at) || t('admin.unknown') || 'Unknown'}
                          </div>
                          {user.ban_expiry && (
                            <div>
                              <span className="font-medium">{t('admin.banExpires') || 'Expires'}: </span>
                              {formatDate(user.ban_expiry)}
                            </div>
                          )}
                          {user.banned_by && (
                            <div>
                              <span className="font-medium">{t('admin.bannedBy') || 'Banned by'}: </span>
                              {user.banned_by.username}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default BannedUsersModal;

